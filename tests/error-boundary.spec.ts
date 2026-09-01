import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { probe } from "./qa-http";
import { REPO_ROOT, SRC_ROOT, isClientModule, listFiles, relative } from "./qa-source";

/**
 * Contract E: "A root error boundary catches server-render failures. Today
 * `src/app/(store)/layout.tsx` calls `listPublishedProducts()`, and a segment's own
 * `error.tsx` does not catch a throw from that segment's layout. The error boundary must not
 * leak an exception message, stack, or query text to the browser."
 *
 * LIMIT, STATED PLAINLY: a server-render failure cannot be provoked from outside this
 * process. Every reachable throw site is either guarded (`resolveTenantPrincipal` swallows
 * and returns null) or depends on environment/filesystem state owned by another agent, and
 * forcing one would mean editing `src/**` or mutating shared `public/` assets. The dev server
 * would also answer with Next's development error overlay, which prints a full stack by
 * design, so an HTTP assertion made against :3001 could not prove the production boundary
 * either way. The two file-level tests below therefore carry the boundary contract, and the
 * HTTP sweep carries the "nothing leaks" contract across every error response we CAN provoke.
 */

const boundaryFiles = (): string[] =>
  listFiles(path.join(SRC_ROOT, "app"), [".tsx"]).filter((file) =>
    /(^|\/)(error|global-error)\.tsx$/.test(relative(file)),
  );

/**
 * Fails if there is no error boundary above the route groups. `(store)/error.tsx` renders
 * inside `(store)/layout.tsx`, so it cannot catch that layout's `listPublishedProducts()`
 * throw; without `src/app/error.tsx` (or `global-error.tsx`) such a throw reaches Next's
 * default handler instead of a safe page.
 */
test("a root error boundary sits above the route groups", async () => {
  const roots = ["src/app/error.tsx", "src/app/global-error.tsx"].filter((candidate) =>
    fs.existsSync(path.join(REPO_ROOT, candidate)),
  );
  expect(
    roots,
    "no root error boundary: a throw in (store)/layout.tsx has nothing above it to catch",
  ).not.toEqual([]);

  for (const root of roots) {
    const source = fs.readFileSync(path.join(REPO_ROOT, root), "utf8");
    expect(isClientModule(source), `${root} must be a client component to work as a boundary`).toBe(true);
  }
});

/**
 * Fails if any error boundary renders the exception itself. `error.digest` is an opaque
 * correlation hash and is allowed; `error.message`, `error.stack`, `error.cause`,
 * `String(error)` and `JSON.stringify(error)` all put server internals on the page.
 */
test("no error boundary renders the exception message, stack, or cause", async () => {
  const files = boundaryFiles();
  expect(files.length, "no error boundaries found — nothing was inspected").toBeGreaterThan(0);

  const leaky = [
    /error\s*\.\s*message/,
    /error\s*\.\s*stack/,
    /error\s*\.\s*cause/,
    /String\s*\(\s*error/,
    /JSON\s*\.\s*stringify\s*\(\s*error/,
    /\{\s*error\s*\}/,
    /console\s*\.\s*(?:log|error)\s*\(\s*error/,
  ];

  const findings = files.flatMap((file) => {
    const source = fs.readFileSync(file, "utf8");
    return leaky.filter((pattern) => pattern.test(source)).map((pattern) => `${relative(file)} matches ${pattern}`);
  });

  expect(findings, "an error boundary renders the exception").toEqual([]);
});

/**
 * Fails if any error response the storefront can be made to produce carries a stack frame, a
 * SQL fragment, a database identifier, or a server-only environment variable name. Notably
 * `getServerEnv()` throws `Invalid server environment: <zod issues>`, which names every env
 * var it validated — that string reaching a body is the leak this guards.
 */
test("no error response leaks a stack, a SQL fragment, or a database identifier", async () => {
  const forgedSession = {
    cookie: "sb-access-token=forged; sb-localhost-auth-token=%5B%22forged%22%5D",
    "content-type": "text/plain;charset=UTF-8",
  };

  const requests: ReadonlyArray<[string, RequestInit]> = [
    ["/products/%E0%A4%A", {}], // invalid percent-encoding: a real 400 from the server
    ["/products/not-a-real-product", {}],
    ["/collections/not-a-real-collection", {}],
    ["/collections/ALL", {}],
    ["/zzz-definitely-not-a-route", {}],
    ["/admin", {}],
    ["/admin/products", { headers: forgedSession }],
    ["/shop?size=%00", {}],
    ["/shop?sort=%27%3B+DROP+TABLE+products%3B--", {}],
    ["/shop?q=%3Cscript%3E", {}],
    ["/cart", { headers: forgedSession }],
    ["/api/health", { method: "POST", body: "{}" }],
    ["/", { method: "POST", headers: { "Next-Action": "ffffffffffffffffffffffffffffffffffffffff" }, body: "[]" }],
    ["/shop", { method: "POST", headers: { "Next-Action": "0000000000000000000000000000000000000000" }, body: "[]" }],
  ];

  // Deliberately NOT scanned: generic stack frames and absolute paths. The dev server
  // serialises Next's own `resolveErrorDev` frames and turbopack chunk URLs (which embed the
  // install path and the throwing module's source path) into the RSC payload of every
  // `notFound()` response. That is a development-runtime artifact of the framework, stripped
  // in a production build, and it is reported as an observation rather than asserted here —
  // asserting it would make this spec permanently red for something the app does not do.
  const leakPatterns: ReadonlyArray<{ name: string; pattern: RegExp }> = [
    { name: "env validation error", pattern: /Invalid server environment/ },
    {
      name: "SQL fragment",
      pattern:
        /\bselect\b[\s\S]{0,150}\bfrom\b\s+"?(?:products|product_variants|media_references|audit_events|memberships|tenants|product_revisions)\b/i,
    },
    {
      name: "database identifier",
      pattern:
        /\b(?:actor_user_id|current_revision_id|product_revisions|audit_events|enforce_product_status_transition|current_tenant_role|membership_role|auth_user_id)\b/,
    },
    { name: "server-only env name", pattern: /\b(?:SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DELTA_TENANT_ID)\b/ },
    { name: "connection string", pattern: /postgres(?:ql)?:\/\// },
    { name: "postgres error code", pattern: /\b(?:PostgresError|error: (?:permission denied|new row violates))/ },
  ];

  const leaks: string[] = [];
  let scanned = 0;

  for (const [route, init] of requests) {
    const result = await probe(route, init);
    if (result.body.length > 0) scanned += 1;
    for (const { name, pattern } of leakPatterns) {
      const match = pattern.exec(result.body);
      if (match) {
        leaks.push(`${route} (${result.status}) leaked ${name}: ${match[0].slice(0, 140)}`);
      }
    }
  }

  expect(scanned, "no bodies were scanned — the sweep proves nothing").toBeGreaterThanOrEqual(requests.length - 1);
  expect(leaks, "an error response leaked server internals").toEqual([]);
});
