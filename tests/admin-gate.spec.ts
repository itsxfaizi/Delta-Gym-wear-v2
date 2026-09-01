import { expect, test } from "@playwright/test";

import { documentTitle, probe } from "./qa-http";

/**
 * Contract E: "The admin route group gate lives where a future page inherits it and
 * fails closed. No admin page ships this pass, so `/admin` continues to 404 — the gate
 * must be proven by test, not by a UI."
 *
 * Every assertion here is made by an unauthenticated caller against the status line and
 * the raw bytes, never against a rendered DOM.
 */

const ADMIN_PATHS = [
  "/admin",
  "/admin/",
  "/admin/products",
  "/admin/products/new",
  "/admin/products/00000000-0000-0000-0000-000000000000",
  "/admin/products/00000000-0000-0000-0000-000000000000/status",
  "/admin/login",
  "/admin/dashboard",
  "/admin/settings",
  "/admin/settings/members",
  "/admin/api/products",
  "/admin/audit",
  "/ADMIN",
  "/admin%2f",
  "/admin/./products",
];

/**
 * A forged session: a client-shaped role claim, a fabricated Supabase auth cookie and a
 * tenant header. Contract A says role is read from the database and never from a cookie,
 * header or JWT claim the client can shape, so none of these may change the answer.
 */
const FORGED_SESSION: Record<string, string> = {
  cookie:
    "sb-access-token=forged; sb-refresh-token=forged; sb-localhost-auth-token=%5B%22forged%22%5D; delta-role=owner",
  authorization:
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoic2VydmljZV9yb2xlIn0.forged",
  "x-tenant-id": "00000000-0000-0000-0000-000000000001",
  "x-delta-role": "owner",
  "x-forwarded-user": "admin@example.com",
};

const REQUEST_SHAPES: ReadonlyArray<{ name: string; init: RequestInit }> = [
  { name: "plain GET", init: {} },
  { name: "forged session GET", init: { headers: FORGED_SESSION } },
  { name: "RSC navigation", init: { headers: { RSC: "1" } } },
  { name: "prefetch", init: { headers: { RSC: "1", "Next-Router-Prefetch": "1" } } },
  { name: "POST", init: { method: "POST", body: "{}", headers: { "content-type": "application/json" } } },
  { name: "HEAD", init: { method: "HEAD" } },
];

/**
 * Fails if any path under the admin route group ever answers 200 to a caller with no
 * server-verified session — i.e. if an admin page ships without inheriting the gate, or
 * if the gate renders a shell before it has resolved a principal.
 */
test("no admin path returns 200 to an unauthenticated caller", async () => {
  // Anti-vacuity guard: prove the prober can actually observe a 200 and a body. Without
  // this, a broken helper would make the assertion below pass for the wrong reason.
  const reachable = await probe("/shop");
  expect(reachable.status, "prober cannot see a 200 — the rest of this test proves nothing").toBe(200);
  expect(reachable.body.length).toBeGreaterThan(1000);

  const served: string[] = [];

  for (const path of ADMIN_PATHS) {
    for (const shape of REQUEST_SHAPES) {
      const result = await probe(path, shape.init);
      if (result.status === 200) served.push(`${shape.name} ${path} -> 200`);
    }
  }

  expect(served, "an /admin surface answered 200 without an authenticated principal").toEqual([]);
});

/**
 * Fails if a gate discloses itself: a redirect to a sign-in surface, a challenge header,
 * a session cookie handed to an anonymous caller, or a role/tenant/membership identifier
 * in the response body.
 */
test("no admin response discloses a gate, a role, or a tenant", async () => {
  // Next.js emits `"forbidden":"$undefined"` and `"unauthorized":"$undefined"` as flight
  // payload keys on every route, and echoes the requested segment, so neither the word
  // "admin" nor those two keys is evidence of disclosure. These tokens are.
  const disclosureTokens = [
    "catalog_editor",
    "publisher",
    "auditor",
    "tenant_id",
    "tenantId",
    "membership",
    "resolveTenantPrincipal",
    "TenantPrincipal",
    "service_role",
    "sign in",
    "sign-in",
    "log in",
    "access denied",
    "not authorized",
    "insufficient",
    "requires the",
    "admin only",
  ];
  const leaks: string[] = [];
  let bodiesScanned = 0;

  for (const path of ADMIN_PATHS) {
    for (const shape of REQUEST_SHAPES) {
      const result = await probe(path, shape.init);
      const label = `${shape.name} ${path}`;
      if (result.body.length > 0) bodiesScanned += 1;

      for (const token of disclosureTokens) {
        if (result.body.toLowerCase().includes(token.toLowerCase())) leaks.push(`${label}: body contains "${token}"`);
      }
      if (result.headers.get("www-authenticate")) leaks.push(`${label}: sent WWW-Authenticate`);
      if (result.headers.get("set-cookie")) leaks.push(`${label}: set a cookie for an anonymous caller`);

      // A trailing-slash canonicalisation is fine. A redirect to anywhere else tells an
      // anonymous prober that the route exists and that a session would change the answer.
      const location = result.headers.get("location");
      if (location && location !== path.replace(/\/+$/, "")) leaks.push(`${label}: redirected to ${location}`);
    }
  }

  // HEAD responses are empty by definition; every GET-shaped probe must have produced bytes
  // to scan, or the token sweep above examined nothing.
  expect(bodiesScanned, "no response bodies were scanned").toBeGreaterThanOrEqual(ADMIN_PATHS.length * 4);
  expect(leaks, "an /admin response disclosed the gate").toEqual([]);
});

/**
 * Fails if /admin becomes distinguishable from any other unknown path — a 403, a 401, or
 * a differently-titled page all tell an anonymous prober that an admin surface exists.
 */
test("an admin path is indistinguishable from an unknown path", async () => {
  const control = await probe("/zzz-definitely-not-a-route");
  expect(control.status, "control path must be a plain 404 for this comparison to mean anything").toBe(404);
  const controlTitle = documentTitle(control.body);
  expect(controlTitle).not.toBe("");

  for (const path of ["/admin", "/admin/products", "/admin/login"]) {
    const result = await probe(path);
    expect(result.status, `${path} status differs from an unknown path`).toBe(control.status);
    expect(documentTitle(result.body), `${path} title differs from an unknown path`).toBe(controlTitle);
    expect(result.headers.get("content-type"), `${path} content-type differs`).toBe(
      control.headers.get("content-type"),
    );
  }
});
