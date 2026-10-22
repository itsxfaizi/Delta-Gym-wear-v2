import { expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

import { E2E_EMAIL_DOMAIN } from "./db";

/**
 * Places a COD order through the real storefront and returns its number.
 *
 * Specs that need an order create their own rather than borrowing whatever is in
 * the database — otherwise a second run finds only orders the first run already
 * advanced, and the suite passes or fails depending on history.
 */
export async function placeOrder(
  page: Page,
  { email, phone, promoCode }: { email: string; phone: string; promoCode?: string },
): Promise<string> {
  await page.goto("/shop");
  await page.locator("a.product-image-link").first().click();
  await expect(page).toHaveURL(/\/products\//);

  // Availability is conveyed with aria-disabled rather than the native
  // disabled attribute, so select the first genuinely purchasable size.
  const sizes = page.getByRole("radio", { name: /^(XS|S|M|L|XL|XXL)$/ });
  await expect(sizes.first()).toBeVisible({ timeout: 30_000 });
  let selectedSize = false;
  for (const size of await sizes.all()) {
    if ((await size.getAttribute("aria-disabled")) !== "true") {
      await size.click();
      selectedSize = true;
      break;
    }
  }
  if (!selectedSize) throw new Error("The isolated storefront fixture has no purchasable size.");
  await page.getByRole("button", { name: "ADD TO CART" }).click();

  await page.getByRole("link", { name: "Checkout" }).first().click();
  await expect(page).toHaveURL(/\/checkout/);

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByLabel("Full name").fill("End To End Buyer");
  await page.getByLabel("Delivery phone").fill(phone);
  await page.getByLabel("Address", { exact: true }).fill("14 Jinnah Avenue, Blue Area");
  await page.getByLabel("City").fill("Islamabad");
  await page.getByLabel("Province").fill("Islamabad Capital Territory");

  // Country code is prefilled as PK for a guest but can arrive empty on the
  // signed-in path, so it is set explicitly rather than assumed.
  const country = page.getByLabel(/country code/i);
  if ((await country.inputValue()).trim().length !== 2) await country.fill("PK");
  if (promoCode) {
    await page.getByLabel("Promo code").fill(promoCode);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Discount preview. Eligibility is checked again when you place the order.")).toBeVisible();
  }

  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page).toHaveURL(/\/orders\/DG-/, { timeout: 60_000 });
  const orderNumber = (await page.locator("h1").first().textContent())?.trim() ?? "";
  expect(orderNumber).toMatch(/^DG-\d{6}-\d{4}$/);
  return orderNumber;
}

/** Contact details that mark a record as this suite's, so teardown can find it. */
export function e2eContact(label: string): { email: string; phone: string } {
  return { email: `${label}.${Date.now()}@${E2E_EMAIL_DOMAIN}`, phone: "03001112233" };
}

export const OWNER_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
export const OWNER_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const OWNER_TOTP_SECRET = process.env.E2E_ADMIN_TOTP_SECRET ?? "";

export function currentTotp(secret: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = secret.replace(/\s/g, "").replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const character of normalized) {
    const value = alphabet.indexOf(character);
    if (value < 0) throw new Error("The authenticator returned an invalid TOTP secret.");
    bits += value.toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.slice(0, Math.floor(bits.length / 8) * 8)
    .match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) ?? []);
  const counter = Math.floor(Date.now() / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, "0");
}

/** Signs in as a real owner — there is no development bypass, by design. */
export async function signInAsOwner(page: Page, next = "/admin"): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin-mfa|\/admin/, { timeout: 60_000 });
  if (page.url().includes("/admin-mfa")) {
    if (!OWNER_TOTP_SECRET) throw new Error("E2E_ADMIN_TOTP_SECRET is required for the owner’s MFA-protected session.");
    await page.getByLabel("Six-digit authenticator code").fill(currentTotp(OWNER_TOTP_SECRET));
    await page.getByRole("button", { name: "Verify and enter admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:$|[?#])/, { timeout: 60_000 });
    // MFA lands in the control room; navigate to the requested staff workflow.
    if (next !== "/admin") await page.goto(next);
  }
  await expect(page).toHaveURL(new RegExp(next.replace(/[/?]/g, "\\$&")), { timeout: 60_000 });
}
