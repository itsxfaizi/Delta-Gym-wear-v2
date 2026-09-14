import { expect, test } from "@playwright/test";

import { placeOrder } from "./helpers";

/**
 * The money path end to end against the live database: browse, buy, receipt,
 * track. Orders created here use a recognisable contact email so they can be
 * told apart from real ones.
 */
const EMAIL = "e2e.buyer@deltagymwear.com";
const PHONE = "03005551234";

test("a guest can buy with cash on delivery and then track the order", async ({ page }) => {
  const orderNumber = await placeOrder(page, { email: EMAIL, phone: PHONE });
  await expect(page.getByText(/cash on delivery/i)).toBeVisible();

  // The cart is only cleared once the order actually exists.
  await page.goto("/cart");
  await expect(page.getByText(/your cart is empty/i)).toBeVisible();

  // Guest tracking finds it with the number plus the phone that placed it.
  await page.goto("/track-order");
  await page.getByLabel(/order number/i).fill(orderNumber);
  await page.getByLabel(/phone/i).fill(PHONE);
  await page.getByRole("button", { name: /track/i }).click();
  await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 15_000 });
});

test("a wrong phone reveals nothing about whether the order exists", async ({ page }) => {
  await page.goto("/track-order");
  await page.getByLabel(/order number/i).fill("DG-260914-0001");
  await page.getByLabel(/phone/i).fill("03009999999");
  await page.getByRole("button", { name: /track/i }).click();

  // Same message a nonexistent order gets: the phone is the only secret.
  await expect(page.getByText(/could not find|no order/i)).toBeVisible({ timeout: 15_000 });
});
