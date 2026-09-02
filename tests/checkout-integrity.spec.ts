import { expect, test } from "@playwright/test";

import { probe } from "./qa-http";
import {
  AVAILABLE_VARIANT,
  SEEDED_UNIT_PRICE,
  SHIPPING_FEE,
  UNAVAILABLE_VARIANT,
  addField,
  cartLines,
  captureCheckoutSubmission,
  orderTokenOf,
  qaClient,
  replay,
  setField,
  tokensIn,
  type ActionTemplate,
} from "./qa-checkout";

/**
 * D-007 approves a GUEST checkout, so there is no principal to assert and none is
 * asserted here. What must hold without one:
 *
 *   - nothing outside the published catalog can be ordered,
 *   - every amount is derived on the server and cannot be injected,
 *   - the tenant is never taken from the request,
 *   - an action id the build did not register is refused,
 *   - an arithmetically oversized cart is refused with a typed error, not a 500,
 *   - repeated submissions are eventually refused, and a single normal order is not.
 *
 * Everything below replays ONE captured browser submission with specific bytes
 * changed, so the transport, the action id and React's field encoding are the real
 * ones and only the payload under test differs.
 */

const INT4_MAX = 2_147_483_647;

/** The three `PKR x` figures in the confirmation summary, back in minor units. */
function summaryAmounts(html: string): { products: number; delivery: number; total: number } | null {
  const minorUnits = (label: string): number | null => {
    const match = new RegExp(`<span>${label}</span><strong>PKR ([\\d,]+)</strong>`).exec(html);
    return match ? Number(match[1].replaceAll(",", "")) * 100 : null;
  };
  const products = minorUnits("Products");
  const delivery = minorUnits("Delivery");
  const total = minorUnits("Total");
  if (products === null || delivery === null || total === null) return null;
  return { products, delivery, total };
}

/**
 * Every `x <n>` quantity the confirmation page renders for an order line. React's
 * SSR splits adjacent expressions with `<!-- -->` markers, so they are stripped
 * first — matching the raw markup silently finds nothing.
 */
const quantitiesIn = (html: string): number[] =>
  [...html.replaceAll("<!-- -->", "").matchAll(/ x (\d+)<\/span>/g)].map((match) => Number(match[1]));

test.describe.configure({ mode: "serial" });

let template: ActionTemplate;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  template = await captureCheckoutSubmission(page);
  await page.close();
});

/**
 * Control, and the anti-vacuity guard for every refusal below: fails if a
 * byte-identical replay of a real submission does NOT create an order, which would
 * make "the tampered payloads were refused" prove only that the harness is broken.
 */
test("control: an unmodified replay of a real submission places an order", async () => {
  const result = await replay(template, template.body, { client: qaClient(10) });
  expect(result.status, `replay was not answered by the action:\n${result.text.slice(0, 400)}`).toBe(200);
  expect(result.state, "the action returned no state envelope").not.toBeNull();
  expect(result.state?.ok, `a clean submission was refused: ${result.state?.message}`).toBe(true);
  expect(orderTokenOf(result.state), "a successful order carried no order token").toMatch(/^[a-f0-9]{64}$/);
});

/**
 * Fails if a cart line naming a variant the catalog marks unavailable, or a handle
 * that is not in the published catalog at all, is accepted — i.e. if
 * `restoreCartLines` stopped filtering on `isAvailable`, if it stopped resolving
 * against `listPublishedProducts()`, or if the length-equality check in
 * `placeCodOrder` that turns a dropped line into a refusal were removed.
 */
test("nothing outside the published, available catalog can be ordered", async () => {
  const cases = [
    { name: "unavailable variant", lines: cartLines([{ variantId: UNAVAILABLE_VARIANT }]) },
    { name: "unknown handle", lines: cartLines([{ handle: "not-a-real-product" }]) },
    { name: "unknown variant id", lines: cartLines([{ variantId: "dev-does-not-exist" }]) },
    { name: "mixed: one real line and one unavailable", lines: cartLines([{}, { variantId: UNAVAILABLE_VARIANT }]) },
  ];

  const accepted: string[] = [];
  for (const { name, lines } of cases) {
    const result = await replay(template, setField(template, template.body, "cartLines", lines), {
      client: qaClient(11),
    });
    if (result.status >= 500) accepted.push(`${name}: server answered ${result.status}`);
    if (result.state === null) accepted.push(`${name}: no typed state envelope was returned`);
    if (result.state?.ok === true) accepted.push(`${name}: accepted, token ${orderTokenOf(result.state)}`);
    if (tokensIn(result.text).length > 0) accepted.push(`${name}: an order token was returned`);
    if (result.state && result.state.ok === false && (result.state.message ?? "").trim() === "") {
      accepted.push(`${name}: refused with an empty message`);
    }
  }

  expect(accepted, "a cart line outside the published, available catalog was ordered").toEqual([]);
});

/**
 * Fails if any monetary amount, the currency, the tenant or the country is read
 * from the request. The injected values differ from the server-derived ones, so a
 * single `formData.get("shippingAmount")` (or a price copied out of the cart-line
 * JSON) would show up on the confirmation page the buyer and the courier both read.
 */
test("prices, the shipping fee, the currency and the country are server-derived and cannot be injected", async () => {
  // Extra JSON keys inside the cart line, and extra multipart parts beside it.
  const poisonedLines = JSON.stringify([
    {
      productHandle: "ease-fit-trouser",
      variantId: AVAILABLE_VARIANT,
      quantity: 1,
      priceAmount: 1,
      unitPriceAmount: 1,
      lineTotalAmount: 1,
      currency: "USD",
    },
  ]);
  let body = setField(template, template.body, "cartLines", poisonedLines);
  for (const [name, value] of [
    ["subtotalAmount", "1"],
    ["shippingAmount", "0"],
    ["totalAmount", "1"],
    ["priceAmount", "1"],
    ["currency", "USD"],
    ["country", "US"],
    ["tenantId", "00000000-0000-0000-0000-000000000009"],
    ["status", "confirmed"],
    ["paymentStatus", "collected"],
    ["orderReference", "DGW-DEADBEEF"],
  ] as const) {
    body = addField(template, body, name, value);
  }

  const result = await replay(template, body, { client: qaClient(12) });
  expect(result.state?.ok, `the poisoned-but-otherwise-valid order was refused: ${result.state?.message}`).toBe(true);
  const token = orderTokenOf(result.state);
  expect(token).toMatch(/^[a-f0-9]{64}$/);

  const confirmation = await probe(`/orders/${token}`);
  expect(confirmation.status).toBe(200);

  const expected = {
    unit: SEEDED_UNIT_PRICE / 100,
    shipping: SHIPPING_FEE / 100,
    total: (SEEDED_UNIT_PRICE + SHIPPING_FEE) / 100,
  };
  const money = (value: number) => `PKR ${value.toLocaleString("en-US")}`;

  // The catalog price, the configured fee and their sum — none of them the injected numbers.
  expect(confirmation.body, "the products subtotal is not the catalog price").toContain(money(expected.unit));
  expect(confirmation.body, "the delivery fee is not DELTA_COD_SHIPPING_FEE_AMOUNT").toContain(money(expected.shipping));
  expect(confirmation.body, "the total is not subtotal + configured shipping").toContain(money(expected.total));
  expect(confirmation.body, "an injected currency reached the order").not.toContain("USD");
  expect(confirmation.body, "an injected order reference reached the order").not.toContain("DGW-DEADBEEF");
  expect(confirmation.body, "an injected status reached the order").toContain("Pending confirmation");
  expect(confirmation.body, "an injected country reached the order").toContain("Pakistan");
});

/**
 * The accepted-input surface, read from outside. Fails if the checkout schema ever
 * starts accepting a money, tenant, status or currency field — the change that would
 * make injection possible in the first place — and fails if it stops accepting the
 * customer fields, which would mean the probe is no longer reaching the schema.
 */
test("the action's accepted input surface names no money, tenant or status field", async () => {
  let body = template.body;
  for (const field of ["fullName", "phone", "addressLine1", "city", "cartLines"]) {
    body = setField(template, body, field, "");
  }

  const result = await replay(template, body, { client: qaClient(13) });
  expect(result.state?.ok, "an empty submission was accepted").toBe(false);
  const fields = Object.keys(result.state?.fieldErrors ?? {});

  expect(fields, "the rejection named no fields — the schema was not reached").not.toEqual([]);
  expect(fields, "the customer fields are no longer validated").toEqual(
    expect.arrayContaining(["fullName", "phone", "addressLine1", "city", "cartLines"]),
  );
  expect(
    fields.filter((field) => /amount|price|total|tenant|currency|status|shipping|reference|token/i.test(field)),
    "the checkout schema accepts a server-derived value as client input",
  ).toEqual([]);
});

/**
 * Fails if Next accepts an action id the build never registered. The body is a real,
 * valid submission, so the only thing under test is the id: an accepted id here means
 * a public POST can name an arbitrary action.
 */
test("a fabricated action id is refused on the checkout route", async () => {
  const flipped = template.actionId.replace(/^./, (character) => (character === "0" ? "1" : "0"));
  const accepted: string[] = [];

  for (const actionId of [flipped, "0011223344556677889900112233445566778899", "placeCodOrder"]) {
    const result = await replay(template, template.body, { actionId, client: qaClient(14) });
    if (result.state?.ok === true) accepted.push(`${actionId} placed an order`);
    if (tokensIn(result.text).length > 0) accepted.push(`${actionId} returned an order token`);
  }

  expect(accepted, "an unregistered server action id was accepted on /checkout").toEqual([]);
});

/**
 * 100 lines x 99 units of the seeded 599900 minor units is 5,939,010,000 against an
 * int4 ceiling of 2,147,483,647 IF each line is resolved independently. Whether the
 * defence is coalescing at the parse boundary or a total guard, the observable
 * requirement is the same: no 5xx, a typed envelope, and no order carrying an amount
 * the money columns cannot hold.
 *
 * Fails if the payload produces a 5xx or an untyped body, if a refusal carries no
 * message, or if an order IS created whose stored total exceeds int4 or whose
 * summary does not add up. Removing both the coalescing and the total guard puts
 * PKR 59,390,100 of products on the confirmation page and 5.9e9 into an int4 column.
 */
test("a cart that would overflow int4 is never stored as an overflowed amount", async () => {
  const naiveSubtotal = 100 * 99 * SEEDED_UNIT_PRICE;
  expect(naiveSubtotal, "the fixture no longer overflows int4, so this test proves nothing").toBeGreaterThan(
    INT4_MAX,
  );

  const oversized = cartLines(Array.from({ length: 100 }, () => ({ quantity: 99 })));
  const result = await replay(template, setField(template, template.body, "cartLines", oversized), {
    client: qaClient(15),
  });

  expect(result.status, `an oversized cart produced HTTP ${result.status}:\n${result.text.slice(0, 600)}`).toBeLessThan(
    500,
  );
  expect(result.text, "the response carries an unhandled-exception digest").not.toMatch(
    /"digest"|Internal Server Error/,
  );
  expect(result.state, `an oversized cart returned no typed state:\n${result.text.slice(0, 600)}`).not.toBeNull();

  if (result.state?.ok === false) {
    expect(result.state.message?.trim(), "the refusal carries no message for the buyer").not.toBe("");
    expect(tokensIn(result.text), "an order token was issued alongside a refusal").toEqual([]);
    return;
  }

  // Accepted: then the amounts that were stored have to be ones the columns can hold.
  const token = orderTokenOf(result.state);
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  const confirmation = await probe(`/orders/${token}`);
  expect(confirmation.status).toBe(200);

  const summary = summaryAmounts(confirmation.body);
  expect(
    summary,
    `the confirmation page did not render three summary amounts:\n${confirmation.body.slice(0, 300)}`,
  ).not.toBeNull();
  const { products, delivery, total } = summary as { products: number; delivery: number; total: number };

  expect(total, `the stored total ${total} exceeds the int4 ceiling`).toBeLessThanOrEqual(INT4_MAX);
  expect(products, `the stored subtotal ${products} exceeds the int4 ceiling`).toBeLessThanOrEqual(INT4_MAX);
  expect(delivery, "the delivery fee is not the configured amount").toBe(SHIPPING_FEE);
  expect(total, "the confirmation page's own arithmetic does not add up").toBe(products + delivery);
  const quantities = quantitiesIn(confirmation.body);
  // Without this the filter below is satisfied by an empty list, which is what a
  // markup change would silently produce.
  expect(quantities, "no order-line quantity was found on the confirmation page").not.toEqual([]);
  expect(
    quantities.filter((quantity) => quantity > 99),
    "a stored line carries more than the per-line maximum of 99",
  ).toEqual([]);
});

/**
 * Rate limiting, both halves. Fails if a burst of submissions is never refused (no
 * limiter, or one that never fires), and fails if the FIRST single order of a fresh
 * caller is refused (a limiter that blocks the happy path). The third assertion
 * fails when the limiter is global rather than per-caller: one shopper's burst must
 * not lock out a different shopper.
 *
 * Placed last because a limiter is process state: a burst that trips it stays tripped
 * for the rest of the run.
 */
test("repeated submissions are refused, and a normal single order is not", async () => {
  const first = await replay(template, template.body, { client: qaClient(20) });
  expect(first.state?.ok, `a fresh caller's very first order was refused: ${first.state?.message}`).toBe(true);

  const burst = [];
  for (let attempt = 0; attempt < 15; attempt += 1) {
    burst.push(await replay(template, template.body, { client: qaClient(20) }));
  }

  const refused = burst.filter((result) => result.state?.ok === false);
  expect(
    refused.length,
    `all ${burst.length} repeated submissions from one caller were accepted — placeCodOrder has no rate limit`,
  ).toBeGreaterThan(0);

  // A refusal has to be a typed one. A 500, a crash or an untyped body is not a limit.
  expect(
    burst.filter((result) => result.status >= 500 || result.state === null).length,
    "a throttled submission was answered with a 5xx or an untyped body instead of a typed refusal",
  ).toBe(0);
  expect(
    refused.filter((result) => (result.state?.message ?? "").trim() === "").length,
    "a throttled submission carried no message for the buyer",
  ).toBe(0);

  const otherShopper = await replay(template, template.body, { client: qaClient(99) });
  expect(
    otherShopper.state?.ok,
    `a different caller was refused after another caller's burst: ${otherShopper.state?.message} — the limiter is global, not per-caller`,
  ).toBe(true);
});
