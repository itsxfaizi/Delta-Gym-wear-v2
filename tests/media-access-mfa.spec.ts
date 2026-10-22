import { expect, test } from "@playwright/test";
import { join } from "node:path";

import { createConfirmedUser, E2E_EMAIL_DOMAIN, envValue, withDb } from "./db";
import { currentTotp } from "./helpers";

// MFA provisioning secrets must not be copied into Playwright traces.
test.use({ trace: "off" });

test("an auditor must enroll TOTP before admin access and cannot request product image uploads", async ({ page }) => {
  const email = `auditor.${Date.now()}@${E2E_EMAIL_DOMAIN}`;
  const password = "E2eAuditor!2026";
  const userId = await createConfirmedUser(email, password);
  await withDb(async (sql) => {
    await sql`
      insert into memberships (tenant_id, auth_user_id, role, status)
      values (${envValue("DELTA_TENANT_ID")}, ${userId}, 'auditor', 'active')
    `;
  });

  await page.goto("/login?next=%2Fadmin%2Fproducts%2Fnew");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin-mfa/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Secure your staff account" })).toBeVisible();

  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const secret = (await page.locator(".mfa-secret").textContent())?.trim();
  expect(secret).toBeTruthy();
  await page.getByLabel("Six-digit authenticator code").fill(currentTotp(secret!));
  await page.getByRole("button", { name: "Verify and enter admin" }).click();
  await expect(page).toHaveURL(/\/admin(?:$|[?#])/, { timeout: 60_000 });

  await page.goto("/admin/products/new");
  const signedUploadRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/storage/v1/object/upload/sign/")) signedUploadRequests.push(request.url());
  });
  await page.getByLabel("Upload image").setInputFiles(join(process.cwd(), "design-reference", "assets", "product-small-normal.png"));
  await expect(page.getByRole("status")).toContainText("image upload is unavailable");
  expect(signedUploadRequests).toHaveLength(0);
});
