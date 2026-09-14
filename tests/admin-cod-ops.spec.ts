import { expect, test } from "@playwright/test";

import { placeOrder } from "./helpers";

/**
 * The operator's half of the story, against the live database: sign in as a real
 * owner (no dev bypass), find an order, and walk it through the COD lifecycle.
 */
const OWNER_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@deltagymwear.com";
const OWNER_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

test.skip(!OWNER_PASSWORD, "E2E_ADMIN_PASSWORD is required to sign in as the owner");

test("an owner signs in and moves an order through the COD flow", async ({ page }) => {
  // Its own fresh order, so the spec does not depend on what earlier runs left behind.
  const orderNumber = await placeOrder(page, { email: "e2e.ops@deltagymwear.com", phone: "03005559876" });

  await page.goto("/login?next=/admin/orders");
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  // A real session, not the removed development bypass.
  await expect(page).toHaveURL(/\/admin\/orders/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /orders/i }).first()).toBeVisible();

  // Open the order this spec just created.
  await page.getByRole("link", { name: orderNumber }).first().click();
  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: orderNumber })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}/);

  // Only legal transitions are offered: a pending order can never jump to delivered.
  await expect(page.getByRole("button", { name: "Delivered", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirmed", exact: true })).toBeVisible();

  // Log a confirmation call — the COD fraud filter.
  await page.getByLabel("Outcome").selectOption("confirmed");
  await page.getByLabel("Note (optional)").fill("Customer confirmed on the first call.");
  await page.getByRole("button", { name: "Record attempt" }).click();
  await expect(page.getByText(/Customer confirmed on the first call/)).toBeVisible({ timeout: 20_000 });

  // Advance the order, then record the courier once it can ship.
  await page.getByRole("button", { name: "Confirmed", exact: true }).click();
  await expect(page.getByRole("button", { name: "Packed", exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Packed", exact: true }).click();
  await expect(page.getByRole("button", { name: "Shipped", exact: true })).toBeVisible({ timeout: 20_000 });
});
