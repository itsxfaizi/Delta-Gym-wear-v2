import { expect, test } from "@playwright/test";

import { envValue, withDb } from "./db";
import { OWNER_PASSWORD, e2eContact, placeOrder, signInAsOwner } from "./helpers";

test.skip(!OWNER_PASSWORD, "E2E_ADMIN_PASSWORD is required to sign in as the owner");

test("an owner creates a percentage code and a shopper redeems it once at checkout", async ({ page }) => {
  const code = `E2E${Date.now().toString().slice(-8)}`;
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  const localExpiry = new Date(expiry.getTime() - expiry.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 16);

  await signInAsOwner(page, "/admin/promotions");
  const newCodeForm = page.locator("form", { has: page.getByRole("button", { name: "Create code", exact: true }) });
  await newCodeForm.getByLabel("Code", { exact: true }).fill(code);
  await newCodeForm.getByLabel("Discount type").selectOption("percentage");
  await newCodeForm.getByLabel("Percent off").fill("10");
  await newCodeForm.getByLabel("Expires at (your local time)").fill(localExpiry);
  await newCodeForm.getByLabel("Total uses allowed").fill("1");
  await newCodeForm.getByRole("button", { name: "Create code" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Promo code created." })).toBeVisible();

  const orderNumber = await placeOrder(page, { ...e2eContact("promo"), promoCode: code });
  const persisted = await withDb(async (sql) => {
    const [order] = await sql`
      select subtotal_amount, discount_amount, shipping_amount, total_amount, promo_code
        from orders where order_number = ${orderNumber}
    `;
    const [promotion] = await sql`
      select usage_count, usage_limit, active from promo_codes
       where tenant_id = ${envValue("DELTA_TENANT_ID")} and code = ${code}
    `;
    return { order, promotion };
  });

  expect(persisted.order.promo_code).toBe(code);
  expect(Number(persisted.order.discount_amount)).toBe(Math.floor(Number(persisted.order.subtotal_amount) / 10));
  expect(Number(persisted.order.total_amount)).toBe(
    Number(persisted.order.subtotal_amount) - Number(persisted.order.discount_amount) + Number(persisted.order.shipping_amount),
  );
  expect(Number(persisted.promotion.usage_count)).toBe(1);
  expect(Number(persisted.promotion.usage_limit)).toBe(1);

  // The order is marked with the suite email by e2eContact; the global guarded
  // teardown cancels it, restocks its lines and leaves immutable history intact.
  await page.goto("/admin/promotions");
  const promotionForm = page.locator(".promo-form", { has: page.getByRole("heading", { name: code }) });
  await promotionForm.getByRole("button", { name: "Disable code" }).click();
  await expect(promotionForm.getByRole("status")).toHaveText("Code disabled.");
});
