import { expect, test } from "@playwright/test";

import { E2E_EMAIL_DOMAIN, createConfirmedUser } from "./db";
import { placeOrder } from "./helpers";

/**
 * The customer's side: sign in, buy, and find the order under /account. A guest
 * checkout is covered in cod-lifecycle; this is the signed-in path, where the
 * order has to attach to the account.
 *
 * The account is provisioned through the admin API rather than the signup form.
 * Signup sends a confirmation email and the project's mail quota is small — a
 * suite that signs up repeatedly gets over_email_send_rate_limit back, which
 * would make these specs fail for a reason that has nothing to do with the app.
 * The signup FORM is still covered below, up to the point of submission.
 */

const PASSWORD = "E2eBuyer!2026";

test("a signed-in shopper can place an order", async ({ page }) => {
  const email = `account.${Date.now()}@${E2E_EMAIL_DOMAIN}`;
  await createConfirmedUser(email, PASSWORD);

  await page.goto("/login?next=/account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/account/, { timeout: 60_000 });
  // Sign-in navigates with window.location.assign; leaving immediately aborts it.
  await page.waitForLoadState("networkidle");

  const orderNumber = await placeOrder(page, { email, phone: "03004445566" });
  expect(orderNumber).toMatch(/^DG-\d{6}-\d{4}$/);
});

/**
 * Order history depends on a `customers` row linked by auth user id. Nothing
 * ever created one, so this was empty for every signed-in shopper; the record
 * is now created at checkout. This spec is what keeps that true.
 */
test("a signed-in shopper finds their order under /account/orders", async ({ page }) => {
  const email = `account.${Date.now()}@${E2E_EMAIL_DOMAIN}`;
  await createConfirmedUser(email, PASSWORD);

  await page.goto("/login?next=/account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/account/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");

  const orderNumber = await placeOrder(page, { email, phone: "03004445566" });

  await page.goto("/account/orders");
  await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 30_000 });

  // The receipt opens from the account without re-entering a phone.
  await page.getByRole("link", { name: orderNumber }).first().click();
  await expect(page.getByRole("heading", { name: orderNumber })).toBeVisible();
});

test("the signup form refuses a mismatched confirmation before it reaches the server", async ({ page }) => {
  await page.goto("/signup");

  await page.getByLabel("Full name").fill("E2E Account Buyer");
  await page.getByLabel("Email").fill(`mismatch.${Date.now()}@${E2E_EMAIL_DOMAIN}`);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill("SomethingElse!2026");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText(/do not match|must match/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/signup/);
});

test("a signed-out shopper is sent to sign in before the account pages", async ({ page }) => {
  await page.goto("/account/orders");
  await expect(page).toHaveURL(/\/login/);
});
