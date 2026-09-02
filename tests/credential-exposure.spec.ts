import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { QA_BASE_URL, probe } from "./qa-http";
import {
  REPO_ROOT,
  importSpecifiers,
  isClientModule,
  listFiles,
  relative,
  resolveLocalImport,
  sourceFiles,
} from "./qa-source";

/**
 * Contract H: "Nothing that reaches the browser may import `src/server/**`" and "No secret,
 * connection string, or service-role key in source, tests, fixtures, or documentation."
 *
 * Method, so the result is reproducible:
 *   1. Drive a real browser over six routes and capture EVERY response body the browser
 *      received (documents, chunks, css, json) — this covers lazily-imported chunks that a
 *      static HTML scrape would miss.
 *   2. Grep the client bundle directories on disk (`.next/static`, `.next/dev/static`),
 *      which covers chunks the crawl never happened to request. Server output
 *      (`.next/server`, `.next/dev/server`) is deliberately NOT scanned: it is allowed to
 *      hold server-only material.
 *   3. Walk the static import graph from every `"use client"` module and assert nothing
 *      under `src/server/**` is reachable.
 */

const CREDENTIAL_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "SUPABASE_SERVICE_ROLE_KEY", pattern: /SUPABASE_SERVICE_ROLE_KEY/ },
  { name: "service_role", pattern: /service_role/ },
  { name: "sb_secret", pattern: /sb_secret/ },
  // A three-segment JWT. The Supabase anon key is public by design, but a legacy anon key is
  // also JWT-shaped, so any JWT in a browser payload is reported and triaged by hand.
  { name: "jwt", pattern: /eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/ },
  { name: "credentialed postgres url", pattern: /postgres(?:ql)?:\/\/[^\s"'`]*:[^\s"'`@]+@/ },
  { name: "getServiceRoleKey", pattern: /getServiceRoleKey/ },
  { name: "createSupabaseServiceClient", pattern: /createSupabaseServiceClient/ },
];

const ROUTES = ["/", "/shop", "/collections/all", "/products/ease-fit-trouser", "/cart", "/admin"];

function scan(label: string, body: string): string[] {
  return CREDENTIAL_PATTERNS.flatMap(({ name, pattern }) => {
    const match = pattern.exec(body);
    return match ? [`${label}: ${name} -> ${body.slice(Math.max(0, match.index - 40), match.index + 80)}`] : [];
  });
}

/**
 * Fails if any byte the browser actually downloads — document, chunk, stylesheet or JSON —
 * contains a service-role key, a JWT, or a credentialed connection string.
 */
test("no asset served to the browser carries a service-role credential", async ({ page }) => {
  const findings: string[] = [];
  const scanned = new Set<string>();
  // Every body read is awaited before asserting; otherwise the handler would still be
  // resolving when the expectation runs and the sweep would pass by racing itself.
  const bodies: Promise<void>[] = [];

  page.on("response", (response) => {
    const url = response.url();
    if (!url.startsWith(QA_BASE_URL) || scanned.has(url)) return;
    scanned.add(url);
    bodies.push(
      response
        .text()
        .then((body) => {
          findings.push(...scan(url.replace(QA_BASE_URL, ""), body));
        })
        .catch(() => undefined),
    );
  });

  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: "networkidle" });
  }
  await Promise.all(bodies);

  // Anti-vacuity guard: if nothing was captured, the sweep proves nothing.
  expect(scanned.size, "no responses were captured — the scan examined nothing").toBeGreaterThan(20);
  expect(findings, "a credential pattern reached the browser").toEqual([]);
});

/**
 * Fails if a client bundle on disk contains a credential pattern, including chunks the crawl
 * above never requested.
 */
test("no client bundle on disk carries a service-role credential", async () => {
  const roots = [path.join(REPO_ROOT, ".next", "static"), path.join(REPO_ROOT, ".next", "dev", "static")];
  const bundles = roots.flatMap((root) => listFiles(root, [".js", ".mjs", ".css", ".json", ".map"]));
  expect(bundles.length, "no client bundles found on disk — nothing was scanned").toBeGreaterThan(10);

  const findings = bundles.flatMap((file) => scan(relative(file), fs.readFileSync(file, "utf8")));
  expect(findings, "a credential pattern is present in a client bundle").toEqual([]);
});

/**
 * Fails if the storefront HTML ever inlines a non-public env var. Only `NEXT_PUBLIC_*` may
 * cross to the browser; a bare `DATABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `DELTA_TENANT_ID`
 * appearing in a document is the classic Next.js env-inlining mistake.
 */
test("no server-only environment variable name is inlined into a document", async () => {
  const serverOnlyNames = ["SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "DELTA_TENANT_ID", "LOG_LEVEL"];
  const leaks: string[] = [];

  for (const route of ROUTES) {
    const result = await probe(route);
    expect(result.body.length, `${route} returned no bytes to scan`).toBeGreaterThan(500);
    for (const name of serverOnlyNames) {
      if (result.body.includes(name)) leaks.push(`${route} inlines ${name}`);
    }
  }

  expect(leaks, "a server-only environment variable name reached a document").toEqual([]);
});

/**
 * Fails if any `"use client"` module can transitively reach `src/server/**`. Such an import
 * is what drags `getServiceRoleKey`, the postgres client or the env schema into a browser
 * bundle; `import "server-only"` turns it into a build error, but only after it is written.
 */
test("no \"use client\" module transitively imports src/server", async () => {
  const files = sourceFiles();
  const graph = new Map(files.map((file) => [relative(file), fs.readFileSync(file, "utf8")]));
  const clientEntries = files.filter((file) => isClientModule(graph.get(relative(file)) as string)).map(relative);
  expect(clientEntries.length, "no \"use client\" modules found — nothing was walked").toBeGreaterThan(5);

  const violations: string[] = [];
  const seen = new Set<string>();
  const trail = new Map<string, string>(clientEntries.map((entry) => [entry, entry]));
  const queue = [...clientEntries];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    if (current.startsWith("src/server/")) {
      violations.push(trail.get(current) as string);
      continue;
    }
    const source = graph.get(current);
    if (source === undefined) continue;
    // A "use server" module is a boundary, not a hop. Next compiles the client's
    // import of a server action into a reference id; the module and everything it
    // imports stay on the server and never enter a client bundle. Walking through
    // it would report `checkout-view -> orders/actions -> src/server/db` as a leak
    // that the on-disk bundle scan in this same file disproves. The action's own
    // server-side imports are covered by that scan and by the server-only guard.
    if (current !== trail.get(current) && /^\s*["']use server["']/.test(source)) continue;
    for (const specifier of importSpecifiers(source)) {
      const resolved = resolveLocalImport(specifier, path.join(REPO_ROOT, current));
      if (!resolved) continue;
      const next = relative(resolved);
      if (!trail.has(next)) trail.set(next, `${trail.get(current)} -> ${next}`);
      queue.push(next);
    }
  }

  expect(seen.size, "the walk never left the client entry points — the resolver is not working").toBeGreaterThan(
    clientEntries.length,
  );
  expect(violations, "a client module reaches src/server").toEqual([]);
});
