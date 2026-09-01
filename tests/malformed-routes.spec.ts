import { expect, test } from "@playwright/test";

import { probe, type ProbeResult } from "./qa-http";
import { REPO_ROOT } from "./qa-source";

/**
 * Contract, "Routing and error boundaries": no error response may disclose an
 * exception message, stack frame, absolute filesystem path, SQL fragment,
 * database identifier, environment variable name, or whether a record exists.
 *
 * Status assertions use raw `fetch` with `redirect: "manual"` (via `probe`), not
 * Playwright's APIRequestContext, which throws once redirects exceed maxRedirects
 * and would make a status assertion impossible on any redirecting input.
 */

/**
 * NOTE on the raw `..` entries: WHATWG URL parsing collapses dot segments and
 * rewrites `\` to `/` before the bytes leave the client, so those probes reach the
 * server as the already-resolved path. They are kept because the resolved target
 * (`/etc/passwd`) must still not be served. The percent-encoded and
 * double-encoded variants are the ones that arrive verbatim, and they are the
 * realistic traversal vector anyway: the bug being hunted is decode-then-join.
 */
const MALFORMED: ReadonlyArray<{ label: string; path: string; query?: true }> = [
  { label: "dot-dot traversal", path: "/products/../../../etc/passwd" },
  { label: "encoded traversal", path: "/products/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd" },
  { label: "encoded traversal to repo file", path: "/collections/..%2f..%2f..%2fnext.config.ts" },
  { label: "traversal into .env", path: "/products/..%2f..%2f.env" },
  { label: "traversal under _next", path: "/_next/static/../../../../etc/passwd" },
  { label: "bare encoded null", path: "/products/%00" },
  { label: "embedded encoded null", path: "/products/ease-fit%00trouser" },
  { label: "null in query", path: "/shop?q=%00", query: true },
  { label: "double-encoded slash", path: "/products/foo%252fbar" },
  { label: "double-encoded traversal", path: "/products/%252e%252e%252f%252e%252e%252fetc%252fpasswd" },
  { label: "backslash separator", path: "/products/..\\..\\etc\\passwd" },
  { label: "very long segment", path: `/products/${"a".repeat(6000)}` },
  { label: "very long query", path: `/shop?q=${"b".repeat(9000)}`, query: true },
  { label: "deeply nested segments", path: `/products${"/x".repeat(300)}` },
  { label: "unicode handle", path: "/products/日本語テスト" },
  { label: "rtl and combining marks", path: "/products/%D8%A7%D8%AE%D8%AA%D8%A8%D8%A7%D8%B1-e%CC%81" },
  { label: "emoji handle", path: "/collections/%F0%9F%94%A5%F0%9F%92%A5" },
  { label: "crlf injection attempt", path: "/products/foo%0d%0aX-Injected:%20yes" },
  { label: "semicolon path parameter", path: "/products/ease-fit-trouser;jsessionid=1" },
  { label: "protocol-relative handle", path: "//evil.example.com/products/x" },
  { label: "unknown api child", path: "/api/health/../../etc/passwd" },
  { label: "unknown api route", path: "/api/definitely-not-a-route" },
];

const results = new Map<string, ProbeResult>();

test.beforeAll(async () => {
  for (const { label, path } of MALFORMED) {
    results.set(label, await probe(path));
  }
});

/**
 * Fails if any malformed input produces a 5xx. A 500 on a hand-crafted URL means
 * the request reached code that threw on its shape rather than being rejected or
 * routed to a 404, and in production that is the class of response that leaks a
 * digest and burns a boundary.
 */
test("no malformed route produces a 5xx", async () => {
  const failures = MALFORMED.filter(({ label }) => (results.get(label) as ProbeResult).status >= 500).map(
    ({ label, path }) => `${label} (${path.slice(0, 80)}) -> ${(results.get(label) as ProbeResult).status}`,
  );
  expect(failures, "a malformed route crashed the server").toEqual([]);
});

/**
 * Fails if any malformed input is answered with 2xx or with a redirect to another
 * origin. A 200 on `/products/<6000 chars>` would mean the handle reached a query;
 * an off-origin 3xx on `//evil.example.com/...` would be an open redirect.
 */
test("no malformed route is answered with a success or an off-origin redirect", async () => {
  const problems: string[] = [];

  for (const { label, path, query } of MALFORMED) {
    const result = results.get(label) as ProbeResult;
    // `query: true` entries hit a route that legitimately exists (`/shop`) through
    // an approved public filter, so a 200 there is correct - they are in this list
    // for the 5xx and disclosure sweeps, not for this one.
    if (!query && result.status >= 200 && result.status < 300) problems.push(`${label} (${path.slice(0, 80)}) -> ${result.status}`);
    const location = result.headers.get("location");
    if (location && /^(?:https?:)?\/\//i.test(location) && !location.startsWith("http://localhost:3001")) {
      problems.push(`${label} -> off-origin redirect to ${location}`);
    }
  }

  expect(problems, "a malformed route was accepted or redirected off-origin").toEqual([]);
});

/**
 * Fails if a traversal input ever returns the bytes of a file outside the served
 * roots. Each marker is a string that only appears in the file the input is
 * reaching for, so a match means the file was actually read and served.
 */
test("no traversal input serves the contents of a file off the public root", async () => {
  const markers: ReadonlyArray<{ name: string; pattern: RegExp }> = [
    { name: "/etc/passwd", pattern: /^root:.*:0:0:/m },
    { name: "next.config.ts source", pattern: /const\s+securityHeaders\s*=|NextConfig/ },
    { name: ".env contents", pattern: /^(?:DATABASE_URL|SUPABASE_[A-Z_]+)\s*=/m },
    { name: "package.json manifest", pattern: /"name"\s*:\s*"delta-gym-wear"/ },
  ];

  const leaks = MALFORMED.flatMap(({ label }) => {
    const body = (results.get(label) as ProbeResult).body;
    return markers.filter(({ pattern }) => pattern.test(body)).map(({ name }) => `${label} served ${name}`);
  });

  expect(leaks, "a traversal input served a file off the public root").toEqual([]);
});

/**
 * Every `at <name> (<location>)` frame in a body, with its location truncated at
 * the query string. The dev overlay's frames point at turbopack chunks under
 * `.next/` and at `node_modules/next/dist`, and the chunk URL's `?id=` query
 * carries the source path of the module that threw - that whole shape is the
 * measured framework development artifact, so a frame is judged by the FILE it
 * names, not by whether the string "src/" occurs anywhere inside it.
 */
const stackFrameFiles = (body: string): string[] =>
  [...body.matchAll(/\bat\s+[\w.$<>[\]]+\s+\(([^)\n]*)\)/g)].map((match) => match[1].split("?")[0]);

/**
 * Fails if a malformed input's response body carries an exception message, a
 * stack frame naming a file outside `.next/` and `node_modules/`, a SQL fragment,
 * or a server-only env var name. Distinct from `error-boundary.spec.ts`, which
 * sweeps well-formed routes: this one covers the inputs that reach Next's
 * pre-routing pipeline, where a different (pages-router) error renderer produces
 * the body. A frame like `at getPublishedProduct (/…/src/server/db/products.ts)`
 * is the concrete break; a turbopack chunk frame is not.
 */
test("no malformed route discloses an exception, a SQL fragment, or an env var name", async () => {
  const patterns: ReadonlyArray<{ name: string; pattern: RegExp }> = [
    { name: "SQL fragment", pattern: /\bselect\b[\s\S]{0,150}\bfrom\b\s+"?(?:products|product_variants|tenants|memberships|audit_events)\b/i },
    { name: "server-only env name", pattern: /\b(?:SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DELTA_TENANT_ID)\b/ },
    { name: "connection string", pattern: /postgres(?:ql)?:\/\// },
    { name: "postgres error", pattern: /\bPostgresError\b|\berror: permission denied\b/ },
    { name: "zod env validation", pattern: /Invalid server environment/ },
  ];

  let scanned = 0;
  let framesSeen = 0;

  const leaks = MALFORMED.flatMap(({ label }) => {
    const body = (results.get(label) as ProbeResult).body;
    if (body.length > 0) scanned += 1;

    const frames = stackFrameFiles(body);
    framesSeen += frames.length;
    // A frame is a leak only when it names a real filesystem path that is neither a
    // build artifact nor a dependency. `node:internal/...` builtins carry no app
    // information; `.next/` and `node_modules/` are the measured dev-overlay shape.
    const appFrames = frames
      .filter((file) => /^\/|file:\/\/\//.test(file) && !/\/(?:\.next|node_modules)\//.test(file))
      .map((file) => `${label} leaked an application stack frame: ${file.slice(-140)}`);

    return [
      ...appFrames,
      ...patterns
        .map(({ name, pattern }) => ({ name, match: pattern.exec(body) }))
        .filter((entry) => entry.match !== null)
        .map((entry) => `${label} leaked ${entry.name}: ${(entry.match as RegExpExecArray)[0].slice(0, 140)}`),
    ];
  });

  expect(scanned, "no response bodies were scanned - this sweep proves nothing").toBeGreaterThan(MALFORMED.length / 2);
  // Anti-vacuity for the frame half: if no frame was ever parsed, the filter above
  // is trivially empty and would stay green over a body full of raw stack text.
  expect(framesSeen, "no stack frames were parsed at all - the frame scanner matched nothing").toBeGreaterThan(0);
  expect([...new Set(leaks)], "a malformed route disclosed server internals").toEqual([]);
});

/**
 * Absolute filesystem paths, scoped deliberately rather than ignored.
 *
 * Known dev-runtime artifact: on every `notFound()` response `next dev` emits a
 * <template data-next-error-stack="..."> and an RSC flight payload containing
 * `resolveErrorDev` frames and turbopack chunk URLs under
 * `<repo>/.next/...` and `<repo>/node_modules/next/dist/...`. Measured, and it is
 * the framework's development overlay, not this application's output. It is
 * therefore tolerated by TARGET, not by wholesale suppression: an absolute path
 * is allowed only when it points into `.next/` or `node_modules/`.
 *
 * Fails if any served body contains an absolute path into `src/`, `db/`, `docs/`,
 * `.env`, or the repository root itself - which is what a genuinely leaking error
 * message or a mis-serialised import would look like, and which no framework
 * artifact produces.
 */
test("no response discloses an absolute path outside .next and node_modules", async () => {
  const routes = [
    "/",
    "/shop",
    "/products/ease-fit-trouser",
    "/products/not-a-real-product",
    "/collections/not-a-real-collection",
    "/collections/ALL",
    "/zzz-definitely-not-a-route",
    "/products/%E0%A4%A",
    "/api/health",
    "/admin",
    "/cart",
  ];

  // Escaped for a regex; also matched with `/` escaped as `\/`, the form a JSON
  // string inside the flight payload uses.
  const root = REPO_ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const anyPath = new RegExp(`${root}\\\\?/([A-Za-z0-9._@()%~-]+)`, "g");

  const leaks: string[] = [];
  let scanned = 0;

  const bodies = [...routes.map((route) => ({ route, result: null as ProbeResult | null })), ...MALFORMED.map((entry) => ({ route: entry.path, result: results.get(entry.label) as ProbeResult }))];

  for (const entry of bodies) {
    const route = entry.route;
    const result = entry.result ?? (await probe(route));
    if (result.body.length > 0) scanned += 1;
    for (const match of result.body.matchAll(anyPath)) {
      const head = match[1];
      if (head !== ".next" && head !== "node_modules") {
        leaks.push(`${route} discloses ${match[0].slice(0, 120)}`);
      }
    }
  }

  expect(scanned, "no bodies were scanned - this sweep proves nothing").toBeGreaterThan(routes.length);
  expect([...new Set(leaks)], "a response disclosed an absolute path into application source").toEqual([]);
});

/**
 * The second half of the same scoping: the tolerated artifact must stay confined
 * to the two dev-only carriers. Fails if an absolute path appears in rendered
 * markup - a paragraph, a heading, an alt text, a visible attribute - after the
 * <script> blocks and the <template data-next-error-*> element are removed. That
 * is what an error boundary printing `error.stack` onto the page would look like,
 * and it is not something the framework's overlay does.
 */
test("no absolute path reaches rendered markup outside the dev-only error carriers", async () => {
  const routes = ["/", "/products/not-a-real-product", "/collections/not-a-real-collection", "/zzz-definitely-not-a-route", "/products/%E0%A4%A"];
  const leaks: string[] = [];

  for (const route of routes) {
    const result = await probe(route);
    expect(result.body.length, `${route} returned no bytes to scan`).toBeGreaterThan(200);
    const stripped = result.body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<template\b[^>]*\bdata-next-error-[\s\S]*?<\/template>/gi, "");
    for (const match of stripped.matchAll(/\/Users\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/@()%~-]*/g)) {
      leaks.push(`${route} renders ${match[0].slice(0, 120)}`);
    }
  }

  expect([...new Set(leaks)], "an absolute filesystem path is rendered into the page markup").toEqual([]);
});
