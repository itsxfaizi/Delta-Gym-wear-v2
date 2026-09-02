import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { probe } from "./qa-http";
import {
  REPO_ROOT,
  SRC_ROOT,
  importSpecifiers,
  isClientModule,
  listFiles,
  relative,
  resolveLocalImport,
  sourceFiles,
} from "./qa-source";

/**
 * Contract C ships `transitionProductStatus` as a guarded server mutation with **no UI caller**.
 * There is therefore nothing to click, and no honest end-to-end path to it. What is provable
 * from outside is the negative: that it has no HTTP surface and no client-reachable reference.
 */

const MUTATION_NAME = "transitionProductStatus";

/** Anything that would let an unauthenticated HTTP caller reach privileged server capability. */
const PRIVILEGED_REFERENCES = [
  MUTATION_NAME,
  "createSupabaseServiceClient",
  "getServiceRoleKey",
  "SUPABASE_SERVICE_ROLE_KEY",
  "createDatabase",
];

/**
 * Fails if a route handler is ever added that imports the privileged mutation, the service-role
 * Supabase client, the service-role key, or a raw database handle — each of which would expose
 * privileged capability on an HTTP surface that never resolves a principal.
 */
test("no HTTP route handler reaches a privileged mutation or the service role", async () => {
  const handlers = listFiles(path.join(SRC_ROOT, "app"), [".ts", ".tsx"]).filter((file) =>
    /(^|\/)route\.tsx?$/.test(relative(file)),
  );
  // The health route is the only handler today; if this ever hits zero the sweep is empty.
  expect(handlers.length, "no route handlers found — the sweep below would prove nothing").toBeGreaterThan(0);

  const findings = handlers.flatMap((file) => {
    const source = fs.readFileSync(file, "utf8");
    return PRIVILEGED_REFERENCES.filter((token) => source.includes(token)).map(
      (token) => `${relative(file)} references ${token}`,
    );
  });

  expect(findings, "a route handler reaches privileged server capability").toEqual([]);
});

/**
 * Fails when the mutation does not exist at all (contract C says it ships this pass), when it
 * lives in a module that is not server-only, or when any `"use client"` module references it —
 * which is what would put its server-action id into a browser bundle and make it callable.
 */
test("the privileged mutation exists, is server-only, and has no client caller", async () => {
  const files = sourceFiles();
  const definingFiles = files.filter(
    (file) => !file.endsWith(".test.ts") && fs.readFileSync(file, "utf8").includes(MUTATION_NAME),
  );

  expect(
    definingFiles.map(relative),
    `contract C requires ${MUTATION_NAME} to ship this pass; no source module defines or exports it`,
  ).not.toEqual([]);

  const problems: string[] = [];
  for (const file of definingFiles) {
    const source = fs.readFileSync(file, "utf8");
    if (isClientModule(source)) {
      problems.push(`${relative(file)} is a "use client" module and references ${MUTATION_NAME}`);
      continue;
    }
    if (!source.includes('import "server-only"') && !/["']use server["']/.test(source)) {
      problems.push(`${relative(file)} references ${MUTATION_NAME} without "server-only" or "use server"`);
    }
  }

  expect(problems, "the privileged mutation is reachable from a browser bundle").toEqual([]);
});

/**
 * Fails if a fabricated server-action id is ever accepted: Next must refuse an action it did
 * not register, on every public route, and must not answer with a mutation Result envelope.
 */
test("a fabricated server action id is refused on every public route", async () => {
  const routes = ["/", "/shop", "/collections/all", "/products/ease-fit-trouser", "/cart", "/admin"];
  const actionIds = [
    "0011223344556677889900112233445566778899",
    "ffffffffffffffffffffffffffffffffffffffff",
    MUTATION_NAME,
  ];
  const accepted: string[] = [];

  for (const route of routes) {
    for (const actionId of actionIds) {
      const result = await probe(route, {
        method: "POST",
        headers: { "Next-Action": actionId, "content-type": "text/plain;charset=UTF-8" },
        body: JSON.stringify([
          { productId: "00000000-0000-0000-0000-000000000001", to: "published", expectedRevisionId: "00000000-0000-0000-0000-000000000002" },
        ]),
      });
      if (result.status === 200) accepted.push(`${route} accepted action ${actionId} (200)`);
      if (/"ok"\s*:\s*true/.test(result.body)) accepted.push(`${route} returned an ok Result for action ${actionId}`);
      if (result.body.includes("revisionId")) accepted.push(`${route} echoed a mutation payload for ${actionId}`);
    }
  }

  expect(accepted, "an unregistered server action id was accepted").toEqual([]);
});

/**
 * Fails if a built client bundle ever contains the mutation's name. With no UI caller its
 * action id must never be shipped to a browser; the symbol appearing in a client chunk is the
 * first observable sign that it was wired into one.
 */
test("no client bundle on disk names the privileged mutation", async () => {
  const clientBundleRoots = [
    path.join(REPO_ROOT, ".next", "static"),
    path.join(REPO_ROOT, ".next", "dev", "static"),
  ];
  const bundles = clientBundleRoots.flatMap((root) => listFiles(root, [".js", ".mjs"]));
  expect(bundles.length, "no client bundles found on disk — nothing was scanned").toBeGreaterThan(0);

  const hits = bundles.filter((file) => fs.readFileSync(file, "utf8").includes(MUTATION_NAME)).map(relative);
  expect(hits, "the privileged mutation name reached a client bundle").toEqual([]);
});

/**
 * `src/features/catalog/actions.ts` carries `"use server"` and documents that, because
 * nothing in the route graph imports it, no reachable action endpoint is registered. That
 * claim is only true while it stays out of the graph: a single import from `src/app/**`
 * turns it into a POST endpoint whose id is a deterministic build hash, not a secret.
 * Fails the moment any route module reaches the mutation, directly or transitively.
 */
test("no route module pulls the server-action file into the app graph", async () => {
  const files = sourceFiles();
  const actionModules = new Set(
    files.filter((file) => /^\s*["']use server["']/.test(fs.readFileSync(file, "utf8"))).map(relative),
  );
  expect(
    [...actionModules],
    'no "use server" module found — contract C requires the mutation to ship this pass',
  ).not.toEqual([]);

  const graph = new Map(files.map((file) => [relative(file), fs.readFileSync(file, "utf8")]));
  const seen = new Set<string>();
  const trail = new Map<string, string>();
  const queue = files
    .filter((file) => relative(file).startsWith("src/app/") && !relative(file).endsWith(".test.ts"))
    .map(relative);
  expect(queue.length, "no route modules found — nothing was walked").toBeGreaterThan(0);
  const entryCount = queue.length;
  for (const entry of queue) trail.set(entry, entry);

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    const source = graph.get(current);
    if (source === undefined) continue;
    for (const specifier of importSpecifiers(source)) {
      const resolved = resolveLocalImport(specifier, path.join(REPO_ROOT, current));
      if (!resolved) continue;
      const next = relative(resolved);
      if (!trail.has(next)) trail.set(next, `${trail.get(current)} -> ${next}`);
      queue.push(next);
    }
  }

  // Anti-vacuity guard: the walk must have followed imports out of `src/app/**`. If the
  // resolver silently returned null for everything, `seen` would equal the entry set and the
  // assertion below would pass without having looked at anything.
  expect(seen.size, "the import walk never left src/app — the resolver is not working").toBeGreaterThan(entryCount);
  expect([...seen].some((module) => module.startsWith("src/features/"))).toBe(true);

  const reached = [...actionModules].filter((module) => seen.has(module));

  // D-007 approves a guest COD checkout, so `src/features/orders/actions.ts` is
  // reachable ON PURPOSE — it is the form's action. What must stay unreachable is
  // the PRIVILEGED catalog mutation, which ships guarded with no UI caller because
  // admin screens are still blocked on decision O-002. Reachability is not the
  // security boundary for either one (a server action id is a deterministic build
  // hash, not a secret); the boundary is the authorization check inside. This
  // asserts the deliberate wiring has not drifted.
  const PRIVILEGED = "src/features/catalog/actions.ts";
  const APPROVED_REACHABLE = "src/features/orders/actions.ts";

  expect(
    reached.map((module) => trail.get(module) as string).filter((path) => path.includes(PRIVILEGED)),
    "the privileged catalog mutation became reachable from the route graph — it has no approved UI caller",
  ).toEqual([]);

  // Anti-vacuity: if the checkout stops being wired, this test would otherwise pass
  // for the wrong reason, having proved only that nothing is reachable at all.
  expect(
    reached,
    "the approved COD checkout action is no longer reachable from any route — the form is unwired",
  ).toContain(APPROVED_REACHABLE);

  expect(
    reached.filter((module) => module !== APPROVED_REACHABLE),
    "an unexpected server action module is reachable from the route graph",
  ).toEqual([]);
});
