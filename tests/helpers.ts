import { expect, type Page } from "@playwright/test";

/**
 * Places a COD order through the real storefront and returns its number.
 *
 * Specs that need an order create their own rather than borrowing whatever is in
 * the database — otherwise a second run finds only orders the first run already
 * advanced, and the suite passes or fails depending on history.
 */
export async function placeOrder(
  page: Page,
  { email, phone }: { email: string; phone: string },
): Promise<string> {
  await page.goto("/shop");
  await page.locator("a.product-image-link").first().click();
  await expect(page).toHaveURL(/\/products\//);

  // Sizes are radios and the sold-out ones are disabled, so take the first enabled.
  await page
    .getByRole("radio", { name: /^(XS|S|M|L|XL|XXL)$/ })
    .and(page.locator(":not([disabled])"))
    .first()
    .click();
  await page.getByRole("button", { name: "ADD TO CART" }).click();

  await page.getByRole("link", { name: "Checkout" }).first().click();
  await expect(page).toHaveURL(/\/checkout/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByLabel("Full name").fill("End To End Buyer");
  await page.getByLabel("Delivery phone").fill(phone);
  await page.getByLabel("Address", { exact: true }).fill("14 Jinnah Avenue, Blue Area");
  await page.getByLabel("City").fill("Islamabad");
  await page.getByLabel("Province").fill("Islamabad Capital Territory");
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page).toHaveURL(/\/orders\/DG-/, { timeout: 60_000 });
  const orderNumber = (await page.locator("h1").first().textContent())?.trim() ?? "";
  expect(orderNumber).toMatch(/^DG-\d{6}-\d{4}$/);
  return orderNumber;
}
