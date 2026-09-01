import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { probe, type ProbeResult } from "./qa-http";
import { REPO_ROOT } from "./qa-source";

/**
 * Pass-3 contract, "Headers": the four pass-2 headers are kept unchanged, a
 * Content-Security-Policy and a Strict-Transport-Security are added, and
 * "Headers must be present on HTML, API, 404, and error responses - the 404 and
 * error paths are the ones frameworks most often miss."
 *
 * Everything here asserts per response *class*, never only on `/`, because
 * `next.config.ts` `headers()` and a `middleware.ts` matcher cover different
 * sets of responses and the difference only shows on the classes nobody probes.
 *
 * SCOPE LIMIT, STATED: every wire observation below is against `next dev` on
 * :3001. A dev server cannot prove production behaviour. The one production
 * claim in this file - that the production header set drops `'unsafe-eval'` and
 * gates HSTS - is made by evaluating `next.config.ts`'s own `headers()` in a
 * child process with `NODE_ENV=production`, which is the header-building
 * function itself, not an HTTPS observation. No HTTPS observation is faked.
 */

const BASELINE_HEADERS = [
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["permissions-policy", "camera=(), microphone=(), geolocation=()"],
] as const;

type Klass = {
  label: string;
  path: string;
  init?: RequestInit;
  status: number;
  /** Contract line: "HTML, API, 404, and error". Static bytes are not named there. */
  cspRequired: boolean;
};

/** Filled by beforeAll: chunk / stylesheet / font URLs are content-hashed and must be discovered. */
let CLASSES: Klass[] = [];
const responses = new Map<string, ProbeResult>();

const first = (body: string, pattern: RegExp): string => {
  const match = pattern.exec(body);
  if (match === null) throw new Error(`could not discover an asset URL with ${pattern} - the homepage HTML changed`);
  return match[1];
};

test.beforeAll(async () => {
  const home = await probe("/");
  expect(home.status, "the homepage must render or nothing below can be discovered").toBe(200);

  const script = first(home.body, /src="(\/_next\/static\/chunks\/[^"]+\.js)"/);
  const stylesheet = first(home.body, /href="(\/_next\/static\/chunks\/[^"]+\.css)"/);
  const font = first(home.headers.get("link") ?? "", /<(\/_next\/static\/media\/[^>]+\.woff2)>/);

  CLASSES = [
    { label: "html 200 home", path: "/", status: 200, cspRequired: true },
    { label: "html 200 product", path: "/products/ease-fit-trouser", status: 200, cspRequired: true },
    { label: "html 200 collection", path: "/collections/all", status: 200, cspRequired: true },
    { label: "html 404 unknown route", path: "/zzz-definitely-not-a-route", status: 404, cspRequired: true },
    { label: "html 404 unknown product", path: "/products/not-a-real-product", status: 404, cspRequired: true },
    { label: "html 404 unknown collection", path: "/collections/not-a-real-collection", status: 404, cspRequired: true },
    // Invalid percent-encoding. Next answers this before app routing, from its
    // legacy pages-router error renderer - a different pipeline from `headers()`.
    { label: "html 400 malformed encoding", path: "/products/%E0%A4%A", status: 400, cspRequired: true },
    { label: "api 200 json", path: "/api/health", status: 200, cspRequired: true },
    { label: "api 405 method", path: "/api/health", init: { method: "DELETE" }, status: 405, cspRequired: true },
    { label: "static js chunk", path: script, status: 200, cspRequired: false },
    { label: "static css chunk", path: stylesheet, status: 200, cspRequired: false },
    { label: "static font woff2", path: font, status: 200, cspRequired: false },
    {
      label: "static video mp4",
      path: "/design-reference/assets/landing/hero-run.mp4",
      init: { method: "HEAD" },
      status: 200,
      cspRequired: false,
    },
    { label: "static 404 missing chunk", path: "/_next/static/chunks/qa3-does-not-exist.js", status: 404, cspRequired: false },
    // Three more separate pipelines: the image optimizer rejects before any app
    // code runs, the static file server answers Range itself, and an RSC request
    // with a malformed router state tree is bounced by the router.
    { label: "image optimizer 400", path: "/_next/image?url=%2Fqa3-nope.png&w=1920&q=75", status: 400, cspRequired: true },
    {
      label: "static 416 range",
      path: "/design-reference/assets/landing/hero-run.mp4",
      init: { headers: { Range: "bytes=99999999999-" } },
      status: 416,
      cspRequired: false,
    },
    {
      label: "rsc 307 redirect",
      path: "/",
      init: { headers: { RSC: "1", "Next-Router-State-Tree": "%7Bnot-json" } },
      status: 307,
      cspRequired: false,
    },
  ];

  for (const klass of CLASSES) {
    responses.set(klass.label, await probe(klass.path, klass.init));
  }
});

/**
 * Anti-vacuity gate for every other test in this file. Fails if a probe stops
 * producing the response class it is named for - e.g. if `/products/%E0%A4%A`
 * starts returning 404 through the app router, the "error response" class would
 * silently become a duplicate 404 and the header sweep would stop testing it.
 */
test("every response class in the sweep returns the status it is named for", async () => {
  const observed = CLASSES.map((klass) => `${klass.label} -> ${responses.get(klass.label)?.status}`);
  const expected = CLASSES.map((klass) => `${klass.label} -> ${klass.status}`);
  expect(observed).toEqual(expected);
});

/**
 * The one class Next answers before any header mechanism can run. Invalid
 * percent-encoding fails during URL parsing, so the response comes from Next's
 * legacy error renderer before `next.config.ts` `headers()` applies and before
 * middleware executes - neither is reachable, so this is not fixable from
 * application code in Next 16.3.3. It is documented as an accepted gap in
 * docs/security-headers.md with a production requirement that the edge or proxy
 * add the headers unconditionally.
 *
 * It is listed here rather than dropped from the sweep so that the gap stays
 * exactly one class wide: the tests below still fail if any OTHER class loses a
 * header, and the guard beneath asserts this class is still genuinely broken -
 * if Next ever fixes it, this exception must be deleted rather than left to rot.
 */
const KNOWN_UNCOVERED = "html 400 malformed encoding";

/**
 * Fails if any response class loses one of the four pass-2 headers. The concrete
 * break this guards: moving header emission into a `middleware.ts` (permitted
 * this pass for nonce generation) whose matcher excludes `/_next/static`, the
 * font/video paths, or the pre-routing error pipeline, which would silently
 * strip `X-Frame-Options` and `nosniff` from those classes.
 */
test("the four pass-2 security headers are present on every response class", async () => {
  const missing: string[] = [];

  for (const klass of CLASSES) {
    if (klass.label === KNOWN_UNCOVERED) continue;
    const result = responses.get(klass.label) as ProbeResult;
    for (const [name, value] of BASELINE_HEADERS) {
      const actual = result.headers.get(name);
      if (actual === null) missing.push(`${klass.label} (${klass.path}) has no ${name}`);
      else if (actual !== value) missing.push(`${klass.label} has ${name}: ${actual}, expected ${value}`);
    }
  }

  expect(missing, "a response class is missing a pass-2 security header").toEqual([]);

  // The accepted gap must stay a gap. If Next starts covering the pre-routing
  // error pipeline, this exception is dead code hiding a now-passing class, and
  // the failure here is the signal to delete it and the doc section with it.
  const uncovered = responses.get(KNOWN_UNCOVERED) as ProbeResult | undefined;
  if (uncovered) {
    expect(
      BASELINE_HEADERS.some(([name]) => uncovered.headers.get(name) === null),
      `${KNOWN_UNCOVERED} now carries the pass-2 headers - remove KNOWN_UNCOVERED and its doc section`,
    ).toBe(true);
  }
});

/**
 * Fails if a Content-Security-Policy is absent from any HTML, API, 404 or error
 * response - the exact set the contract names. A report-only policy does not
 * satisfy it: `Content-Security-Policy-Report-Only` blocks nothing, so it is
 * checked for separately and rejected as a substitute.
 */
test("a Content-Security-Policy is enforced on every HTML, API, 404 and error response", async () => {
  const gaps: string[] = [];

  for (const klass of CLASSES.filter((candidate) => candidate.cspRequired && candidate.label !== KNOWN_UNCOVERED)) {
    const result = responses.get(klass.label) as ProbeResult;
    const enforced = result.headers.get("content-security-policy");
    const reportOnly = result.headers.get("content-security-policy-report-only");
    if (enforced === null) {
      gaps.push(`${klass.label} (${klass.path}) has no Content-Security-Policy${reportOnly ? " (report-only only)" : ""}`);
    }
  }

  expect(gaps, "a response the contract names carries no enforced CSP").toEqual([]);
});

const directives = (policy: string): Map<string, string[]> =>
  new Map(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/);
        return [name.toLowerCase(), sources];
      }),
  );

/**
 * Fails if the served policy drops one of the four directives the contract
 * expects, or if `script-src` gains a wildcard source. `'unsafe-eval'` is NOT
 * asserted against here: the contract permits it in development, and this is a
 * development server. The production policy is checked in the unit test below.
 */
test("the served CSP carries the contract's required directives and no script-src wildcard", async () => {
  const policy = (responses.get("html 200 home") as ProbeResult).headers.get("content-security-policy");
  expect(policy, "no CSP on the homepage - there is no policy to inspect").not.toBeNull();

  const parsed = directives(policy as string);
  const problems: string[] = [];

  for (const [name, expected] of [
    ["object-src", "'none'"],
    ["base-uri", "'none'"],
    ["frame-ancestors", "'none'"],
    ["form-action", "'self'"],
  ] as const) {
    const sources = parsed.get(name);
    if (sources === undefined) problems.push(`${name} is absent`);
    else if (sources.join(" ") !== expected) problems.push(`${name} is "${sources.join(" ")}", expected ${expected}`);
  }

  if (!parsed.has("default-src")) problems.push("default-src is absent");

  const scriptSrc = parsed.get("script-src") ?? parsed.get("default-src") ?? [];
  for (const wildcard of ["*", "https:", "http:", "data:", "blob:"]) {
    if (scriptSrc.includes(wildcard)) problems.push(`script-src contains the wildcard source ${wildcard}`);
  }

  expect(problems, "the served CSP does not match the pass-3 directive contract").toEqual([]);
});

/**
 * Fails the moment any localhost response carries HSTS, over plaintext, and also
 * when a forwarded-proto header is forged. Pinning HSTS for `localhost` is not
 * reversible from the server side and would break every other project on this
 * machine, so this is asserted across the whole class sweep plus three separate
 * proxy-header spellings rather than only on `/`.
 */
test("no plaintext localhost response ever carries Strict-Transport-Security", async () => {
  const pinned = CLASSES.filter((klass) => (responses.get(klass.label) as ProbeResult).headers.has("strict-transport-security"))
    .map((klass) => `${klass.label} (${klass.path})`);

  const forged = await Promise.all(
    ([
      { "x-forwarded-proto": "https" },
      { forwarded: "proto=https" },
      { "x-forwarded-ssl": "on" },
    ] as Array<Record<string, string>>).map(async (headers) => {
      const result = await probe("/", { headers });
      return result.headers.has("strict-transport-security") ? `/ with ${JSON.stringify(headers)}` : null;
    }),
  );

  expect([...pinned, ...forged.filter((entry): entry is string => entry !== null)], "HSTS was pinned for localhost").toEqual([]);
});

/**
 * The one production claim in this file, and it is a unit check, not an
 * observation: `next.config.ts`'s own `headers()` is evaluated in a child Node
 * process with NODE_ENV set, so this is the header-building function's real
 * output for both modes. It cannot prove what a deployed proxy does with the
 * result - that needs the orchestrator's production build behind real TLS.
 *
 * Fails if the production policy keeps `'unsafe-eval'` or the HMR websocket, if
 * production emits no HSTS rule at all, if the HSTS rule is not gated on a
 * request condition (an ungated rule would pin plaintext localhost the instant
 * anyone runs `npm start` locally), or if HSTS appears in development mode.
 */
test("the production header set drops 'unsafe-eval' and gates HSTS behind a request condition", async () => {
  const headersFor = (mode: "production" | "development"): Array<{ source: string; has?: unknown[]; headers: Array<{ key: string; value: string }> }> =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "--no-warnings",
          "-e",
          'const c = (await import("./next.config.ts")).default; console.log(JSON.stringify(await c.headers()));',
        ],
        { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, NODE_ENV: mode } },
      ),
    );

  const production = headersFor("production");
  const development = headersFor("development");

  const findHeader = (rules: ReturnType<typeof headersFor>, key: string) =>
    rules.flatMap((rule) => rule.headers.filter((header) => header.key.toLowerCase() === key.toLowerCase()).map((header) => ({ rule, header })));

  // The CSP moved out of next.config.ts when the nonce landed: it carries a
  // per-request value, so a static config cannot build it. It now lives in a
  // pure builder, which is *more* testable than before - both modes are the
  // function's real output, evaluated here rather than grepped out of source.
  const cspFor = (isDev: boolean): string =>
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--no-warnings",
        "-e",
        `const m = await import("./src/lib/content-security-policy.ts");
         console.log(m.buildContentSecurityPolicy({ nonce: "TEST_NONCE", isDev: ${isDev} }));`,
      ],
      { cwd: REPO_ROOT, encoding: "utf8" },
    ).trim();

  const prodCspValue = cspFor(false);
  const devCspValue = cspFor(true);

  expect(prodCspValue.length, "the production CSP builder produced nothing").toBeGreaterThan(0);
  expect(prodCspValue, "production CSP still allows 'unsafe-eval'").not.toContain("unsafe-eval");
  expect(prodCspValue, "production CSP still allows the dev HMR websocket").not.toContain("ws://");
  // The nonce is what makes 'unsafe-inline' inert in a CSP3 browser, so its
  // absence would silently turn the fallback into the operative source.
  expect(prodCspValue, "production script-src carries no nonce, so 'unsafe-inline' becomes live").toContain("'nonce-");
  expect(prodCspValue, "production script-src lost 'strict-dynamic'").toContain("'strict-dynamic'");

  // Anti-vacuity: if dev and prod produced the same string, the branch that is
  // supposed to strip 'unsafe-eval' is not wired to the mode at all.
  expect(devCspValue, "dev and prod CSP are identical - the environment branch is dead").not.toBe(prodCspValue);

  // next.config.ts must not also emit a CSP, or the browser would enforce the
  // intersection of two policies and the nonce policy would be silently narrowed.
  expect(findHeader(production, "content-security-policy"), "next.config.ts emits a second, conflicting CSP").toEqual([]);

  const prodHsts = findHeader(production, "strict-transport-security");
  expect(prodHsts.length, "the production header set defines no Strict-Transport-Security").toBeGreaterThan(0);
  for (const { rule, header } of prodHsts) {
    expect(rule.has, `HSTS rule "${header.value}" is not gated on a request condition`).toBeDefined();
    expect(JSON.stringify(rule.has), "the HSTS gate does not test the forwarded protocol").toMatch(/proto/i);
    expect(header.value, "HSTS max-age is missing or shorter than 180 days").toMatch(
      /max-age=(?:1[5-9]\d{6}|[2-9]\d{7}|\d{9,})/,
    );
  }

  expect(findHeader(development, "strict-transport-security"), "development emits an HSTS rule").toEqual([]);
});

/**
 * Contract: "`style-src 'unsafe-inline'` is accepted and must be justified in
 * writing." Fails if the served policy relaxes script-src or style-src beyond
 * `'self'` while `docs/security-headers.md` is absent or never names the
 * relaxation - i.e. the escape hatch is taken without the written reason the
 * contract makes a condition of taking it.
 */
test("every inline-source relaxation in the served CSP is named in docs/security-headers.md", async () => {
  const policy = (responses.get("html 200 home") as ProbeResult).headers.get("content-security-policy");
  expect(policy, "no CSP on the homepage - there is nothing to justify").not.toBeNull();

  const parsed = directives(policy as string);
  // Only the two directives the contract singles out. `img-src data:` (blur
  // placeholders) and the dev `connect-src ws://` are named in the contract's own
  // measured-facts section, so they are not re-litigated here.
  const relaxations = (["script-src", "style-src"] as const).flatMap((name) =>
    (parsed.get(name) ?? [])
      // A per-request nonce and 'strict-dynamic' are hardening, not relaxation,
      // and a random nonce could never be "named" in a document by definition.
      .filter((source) => source !== "'self'" && source !== "'none'" && !source.startsWith("'nonce-"))
      .map((source) => `${name} ${source}`),
  );
  expect(relaxations.length, "the CSP relaxes nothing - this test has nothing to check").toBeGreaterThan(0);

  const doc = path.join(REPO_ROOT, "docs", "security-headers.md");
  expect(fs.existsSync(doc), "docs/security-headers.md is missing, so no relaxation is justified in writing").toBe(true);

  const text = fs.readFileSync(doc, "utf8");
  const unjustified = relaxations.filter((relaxation) => {
    const [directive, source] = relaxation.split(" ");
    const token = source.replaceAll("'", "");
    return !(text.includes(directive) && text.includes(token));
  });

  expect(unjustified, "a CSP relaxation is served with no written justification naming it").toEqual([]);
});

/**
 * Contract: "Middleware is permitted for nonce generation only. Pass 2
 * deliberately rejected middleware as an authorization gate because it has no
 * database connection and could only inspect a client-shapeable cookie. That
 * decision stands: middleware added here must not perform, imply, or appear to
 * perform authorization."
 *
 * Skipped, visibly, while no middleware exists - a skip is honest where a pass
 * would be vacuous. Once one is added this fails if it reads a cookie or an
 * Authorization header, redirects, rewrites, or returns a 401/403 - i.e. if it
 * does anything an authorization gate does, whatever the surrounding comment says.
 */
test("middleware, if present, generates a nonce and never gates on identity", async () => {
  const middlewarePath = path.join(REPO_ROOT, "src", "middleware.ts");
  test.skip(!fs.existsSync(middlewarePath), "no src/middleware.ts exists");

  // Comments are stripped first: this file deliberately *discusses* authorization
  // at length to record why it must never perform any, and scanning prose would
  // flag that explanation as the very thing it warns against.
  const source = fs
    .readFileSync(middlewarePath, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  const forbidden: ReadonlyArray<{ name: string; pattern: RegExp }> = [
    { name: "reads a cookie", pattern: /\bcookies\b|\bgetSetCookie\b|["']cookie["']/i },
    { name: "reads an Authorization header", pattern: /authorization/i },
    { name: "redirects", pattern: /NextResponse\s*\.\s*redirect/ },
    { name: "rewrites", pattern: /NextResponse\s*\.\s*rewrite/ },
    { name: "returns an auth status", pattern: /\bstatus\s*:\s*(?:401|403)\b/ },
    { name: "names a role or session", pattern: /\b(?:isAdmin|requireRole|session|principal|tenantId|membership)\b/i },
  ];

  const findings = forbidden.filter(({ pattern }) => pattern.test(source)).map(({ name }) => `src/middleware.ts ${name}`);
  expect(findings, "middleware performs or appears to perform authorization").toEqual([]);
  expect(/nonce/i.test(source), "middleware exists but does not generate a nonce, which is its only permitted job").toBe(true);
});
