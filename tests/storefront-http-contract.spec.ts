import { expect, test } from "@playwright/test";

import { documentTitle, probe, productHandles } from "./qa-http";

/**
 * Contract E: "Unknown product or collection handle returns a real HTTP 404, not 200 with
 * 404 content. Verified on the wire with `curl -D -`, not by reading the rendered body."
 *
 * The rendered body has always been right, which is why nobody noticed. Everything below
 * asserts the status line.
 */

const UNKNOWN_PRODUCT_HANDLES = [
  "/products/not-a-real-product",
  "/products/definitely-missing",
  "/products/ease-fit-trousers",
  "/products/00000000-0000-0000-0000-000000000000",
];

const UNKNOWN_COLLECTION_HANDLES = [
  "/collections/not-a-real-collection",
  "/collections/drafts",
  "/collections/archived",
  "/collections/everything",
];

/**
 * Fails if an unknown product handle is served with any status other than 404 — today it
 * is 200 with "Product not found" in the body, which is indexable and cacheable as a real page.
 */
test("an unknown product handle returns HTTP 404 on the wire", async () => {
  const known = await probe("/products/ease-fit-trouser");
  expect(known.status, "the known-good product must be 200 or this test compares nothing").toBe(200);

  const statuses = await Promise.all(
    UNKNOWN_PRODUCT_HANDLES.map(async (path) => `${path} -> ${(await probe(path)).status}`),
  );
  expect(statuses).toEqual(UNKNOWN_PRODUCT_HANDLES.map((path) => `${path} -> 404`));
});

/** Fails if an unknown collection handle is served with any status other than 404. */
test("an unknown collection handle returns HTTP 404 on the wire", async () => {
  const known = await probe("/collections/all");
  expect(known.status, "the known-good collection must be 200 or this test compares nothing").toBe(200);

  const statuses = await Promise.all(
    UNKNOWN_COLLECTION_HANDLES.map(async (path) => `${path} -> ${(await probe(path)).status}`),
  );
  expect(statuses).toEqual(UNKNOWN_COLLECTION_HANDLES.map((path) => `${path} -> 404`));
});

/**
 * `getPublishedCollection` lower-cases the handle but `generateMetadata` compares it raw, so
 * /collections/ALL serves the full published grid under the document title "Collection not
 * found". Fails while the route body and its metadata disagree about whether the handle exists.
 */
test("a mixed-case collection handle never serves a grid under a not-found title", async () => {
  const result = await probe("/collections/ALL");
  const title = documentTitle(result.body);
  const handles = productHandles(result.body);

  if (result.status === 404) {
    expect(handles, "a 404 response must not still render the catalog grid").toEqual([]);
    return;
  }

  expect(result.status, "/collections/ALL is neither a 200 collection nor a 404").toBe(200);
  expect(title.toLowerCase(), "served the catalog grid under a not-found title").not.toContain("not found");
  expect(handles, "a 200 collection must render the published catalog").not.toEqual([]);
});

/**
 * Contract C: "Every query in a protected path filters on the principal's tenantId. A tenant id
 * is never accepted from client input." Contract on the storefront side: only `published`
 * products are public. Fails if a status, tenant or paging parameter is ever threaded into the
 * catalog query, because any of these would change the served product set.
 */
test("query-parameter and header tampering never widens the public catalog", async () => {
  const baseline = await probe("/shop");
  expect(baseline.status).toBe(200);
  const expected = productHandles(baseline.body);
  // Without this the comparisons below would be "empty equals empty" for every probe.
  expect(expected.length, "baseline catalog is empty — every comparison below would be vacuous").toBeGreaterThan(0);

  const tamperedQueries = [
    "status=draft",
    "status=unpublished",
    "status=archived",
    "status=all",
    "published=false",
    "include=draft",
    "tenantId=00000000-0000-0000-0000-000000000001",
    "tenant_id=00000000-0000-0000-0000-000000000001",
    "limit=1000",
    "offset=-1",
    "sort=%27%3B+DROP+TABLE+products%3B--",
    "q%5B%5D=a&q%5B%5D=b",
    // `size` / `color` / `q` are the approved public filters, so they are deliberately absent
    // here: narrowing the grid is their job. This list is only for parameters that would have
    // to widen it — status, tenant and paging.
  ];

  const mismatches: string[] = [];

  for (const base of ["/shop", "/collections/all"]) {
    for (const query of tamperedQueries) {
      const result = await probe(`${base}?${query}`);
      if (result.status !== 200) mismatches.push(`${base}?${query} -> status ${result.status}`);
      const handles = productHandles(result.body);
      if (handles.join(",") !== expected.join(",")) {
        mismatches.push(`${base}?${query} -> products ${handles.join(",") || "(none)"}`);
      }
    }

    const headerTampered = await probe(base, {
      headers: {
        "x-tenant-id": "00000000-0000-0000-0000-000000000001",
        "x-product-status": "draft",
        cookie: "delta-tenant=00000000-0000-0000-0000-000000000001; delta-role=owner",
      },
    });
    const headerHandles = productHandles(headerTampered.body);
    if (headerHandles.join(",") !== expected.join(",")) {
      mismatches.push(`${base} + forged tenant headers -> products ${headerHandles.join(",") || "(none)"}`);
    }
  }

  expect(mismatches, "client-supplied input changed the public product set").toEqual([]);
});

/**
 * Fails if the storefront ever renders a product whose status is not `published`. The public
 * projection hard-codes `status: "published"`, so any other value in the wire payload means a
 * non-published row escaped `listPublishedProducts` / `getPublishedProduct`.
 */
test("no non-published product status reaches the public wire", async () => {
  const forbidden = ['"status":"draft"', '"status":"unpublished"', '"status":"archived"'];
  const leaks: string[] = [];

  for (const path of ["/", "/shop", "/collections/all", "/products/ease-fit-trouser"]) {
    const result = await probe(path);
    expect(result.status, `${path} must render for this scan to mean anything`).toBe(200);
    for (const token of forbidden) {
      if (result.body.includes(token)) leaks.push(`${path} contains ${token}`);
    }
  }

  expect(leaks, "a non-published product status reached the browser").toEqual([]);
});
