import { expect, test } from "@playwright/test";

import { currentTotp, OWNER_EMAIL, OWNER_PASSWORD } from "./helpers";

// This is a deliberate, headed, one-time operator step; never run in the suite.
test.use({ trace: "off" });
test.skip(process.env.E2E_OWNER_MFA_SETUP !== "true", "Enable only for one-time isolated owner MFA enrollment");
test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required");

test("enroll the isolated owner TOTP authenticator once", async ({ page }) => {
  await page.goto("/login?next=%2Fadmin");
  await page.getByLabel("Email", { exact: true }).fill(OWNER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/admin-mfa/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Secure your staff account" })).toBeVisible();
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const secret = (await page.locator(".mfa-secret").textContent())?.trim();
  expect(secret).toMatch(/^[A-Z2-7]+=*$/);

  // In headed mode, copy the displayed base32 key into .env.e2e.local and scan
  // the QR. The setup key is intentionally not logged or written to a trace.
  await page.pause();
  await page.getByLabel("Six-digit authenticator code").fill(currentTotp(secret!));
  await page.getByRole("button", { name: "Verify and enter admin" }).click();
  await expect(page).toHaveURL(/\/admin(?:$|[?#])/, { timeout: 60_000 });
});
