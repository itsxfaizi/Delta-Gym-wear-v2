import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { probe } from "./qa-http";
import { REPO_ROOT, listFiles, relative } from "./qa-source";
import { captureCheckoutSubmission, orderTokenOf, qaClient, replay } from "./qa-checkout";

/**
 * The in-database RLS matrix belongs to `db/tests/rls.test.mjs`. This is the
 * black-box half: whatever the policies say, nothing reachable over HTTP may hand
 * out an order row, and nothing shipped to a browser may name the order tables or
 * their customer columns.
 *
 * `orders` and `order_items` hold a name, a Pakistani mobile number and a home
 * address. Supabase publishes every `public` table over PostgREST with the anon
 * key, so a schema identifier in a bundle is a ready-made query for anyone who
 * finds the project URL — which the anon key in the page already discloses.
 */

/** Column and table identifiers that exist only server-side, in the database. */
const DATABASE_IDENTIFIERS = [
  "order_items",
  "order_token",
  "order_reference",
  "customer_full_name",
  "customer_phone",
  "customer_email",
  "address_line1",
  "address_line2",
  "postal_code",
  "payment_status",
  "payment_method",
  "subtotal_amount",
  "shipping_amount",
  "line_total_amount",
  "unit_price_amount",
  "tenant_id",
];

/** The server-side row shape. The browser is given a token, never these. */
const SERVER_ROW_FIELDS = ["customerFullName", "customerPhone", "customerEmail", "orderReference", "paymentStatus"];

const PUBLIC_ROUTES = ["/", "/shop", "/collections/all", "/products/ease-fit-trouser", "/cart", "/checkout"];

let orderToken = "";

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  const template = await captureCheckoutSubmission(page);
  await page.close();
  const placed = await replay(template, template.body, { client: qaClient(77) });
  orderToken = orderTokenOf(placed.state);
  expect(orderToken, "could not place the order these tests read back").toMatch(/^[a-f0-9]{64}$/);
});

/**
 * Fails if any listing, API or PostgREST-shaped path serves order data. The
 * confirmation route is the only door, and it opens only for the exact 256-bit
 * token: a truncated, mistyped or guessed one has to 404 rather than 500 or match
 * a prefix. Removing the `/^[a-f0-9]{64}$/` guard in `getPublicOrder`, or adding a
 * listing route, breaks this.
 */
test("no HTTP surface hands out an order row except the exact confirmation token", async () => {
  const real = await probe(`/orders/${orderToken}`);
  expect(real.status, "the confirmation route does not serve the order it was given").toBe(200);
  expect(real.body, "the confirmation page is not rendering the order").toContain("Order reference");

  const findings: string[] = [];
  const enumerations = [
    "/orders",
    "/orders.json",
    "/api/orders",
    "/api/orders/all",
    `/api/orders/${orderToken}`,
    "/rest/v1/orders",
    "/rest/v1/order_items",
    "/rest/v1/orders?select=*",
    // Prefix, suffix and wrong-length variants of a token that does exist.
    `/orders/${orderToken.slice(0, 32)}`,
    `/orders/${orderToken.slice(0, 63)}`,
    `/orders/${orderToken}a`,
    `/orders/${orderToken.toUpperCase()}`,
    `/orders/${"0".repeat(64)}`,
  ];

  for (const route of enumerations) {
    const result = await probe(route);
    if (result.status >= 500) findings.push(`${route} answered ${result.status}`);
    if (result.status === 200 && result.body.includes("Order reference")) {
      findings.push(`${route} served an order (${result.status})`);
    }
    if (result.body.includes("Ali Khan") || result.body.includes("03001234567")) {
      findings.push(`${route} disclosed customer data`);
    }
  }

  expect(findings, "an order row was reachable outside its own confirmation token").toEqual([]);
});

/**
 * Fails if a served document names an order table or a customer column. The
 * confirmation page is included deliberately: showing the buyer their own address
 * is the point, but the DATABASE identifiers behind it must never travel, because
 * they are exactly what a PostgREST query needs.
 */
test("no served document names an order table or a customer column", async () => {
  const findings: string[] = [];

  for (const route of [...PUBLIC_ROUTES, `/orders/${orderToken}`]) {
    const result = await probe(route);
    expect(result.status, `${route} did not render, so scanning it proves nothing`).toBeLessThan(400);
    // Anti-vacuity: an empty body would satisfy every check below.
    expect(result.body.length, `${route} served an empty document`).toBeGreaterThan(1000);

    for (const identifier of DATABASE_IDENTIFIERS) {
      if (result.body.includes(identifier)) findings.push(`${route} names ${identifier}`);
    }
    for (const field of SERVER_ROW_FIELDS) {
      if (result.body.includes(field)) findings.push(`${route} names the server row field ${field}`);
    }
  }

  expect(findings, "a served document exposes the order schema").toEqual([]);
});

/**
 * Fails if a client bundle on disk names an order table or a customer column. The
 * checkout form legitimately names its own inputs (`addressLine1`), so only the
 * database identifiers and the server row shape are scanned — a `"use client"`
 * module that started importing the order queries would put both in a chunk.
 */
test("no client bundle names an order table or the server order row", async () => {
  const bundles = [
    ...listFiles(path.join(REPO_ROOT, ".next", "static"), [".js", ".mjs"]),
    ...listFiles(path.join(REPO_ROOT, ".next", "dev", "static"), [".js", ".mjs"]),
  ];
  expect(bundles.length, "no client bundles found on disk — nothing was scanned").toBeGreaterThan(0);

  const contents = bundles.map((file) => ({ file: relative(file), source: fs.readFileSync(file, "utf8") }));
  // Anti-vacuity: prove the scan is reading real client code before trusting a
  // negative. `cartStorageKey` ships to the browser and must be found.
  expect(
    contents.filter((bundle) => bundle.source.includes("delta-cart")).map((bundle) => bundle.file),
    "the scan found no client cart code — it is not reading client bundles",
  ).not.toEqual([]);

  const findings = contents.flatMap((bundle) =>
    [...DATABASE_IDENTIFIERS, ...SERVER_ROW_FIELDS]
      .filter((identifier) => bundle.source.includes(identifier))
      .map((identifier) => `${bundle.file} names ${identifier}`),
  );

  expect(findings, "the order schema reached a client bundle").toEqual([]);
});
