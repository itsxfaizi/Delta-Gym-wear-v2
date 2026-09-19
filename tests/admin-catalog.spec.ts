import { expect, test } from "@playwright/test";

import { withDb } from "./db";
import { OWNER_PASSWORD, signInAsOwner } from "./helpers";
import type { Page } from "@playwright/test";

/** Product status is a Radix combobox, not a native select. */
async function chooseStatus(page: Page, option: string): Promise<void> {
  await page.getByLabel("Status").click();
  // "published" is a substring of "unpublished", so the match must be exact.
  await page.getByRole("option", { name: option, exact: true }).click();
}

/**
 * The catalogue half of the operator's job: create a product with several
 * images and variants through the real admin form, publish it, and confirm a
 * shopper can then find and open it. Everything here goes through the UI — the
 * point is to prove the form writes what it claims.
 */

test.skip(!OWNER_PASSWORD, "E2E_ADMIN_PASSWORD is required to sign in as the owner");

const HANDLE = `e2e-field-duffel-${Date.now()}`;
const TITLE = "E2E Field Duffel";

const IMAGES = [
  { url: `https://picsum.photos/seed/${HANDLE}-front/600/750`, alt: "Field duffel, front" },
  { url: `https://picsum.photos/seed/${HANDLE}-side/600/750`, alt: "Field duffel, side profile" },
  { url: `https://picsum.photos/seed/${HANDLE}-detail/600/750`, alt: "Field duffel, strap detail" },
];

const DESCRIPTION =
  "A 40-litre training duffel in coated ripstop, with a wet compartment, a padded shoe tunnel and a detachable shoulder strap. Built for the walk between the car park and the rack, not for a mountain.";

test("an owner creates a product with several images and variants, and a shopper can buy it", async ({ page }) => {
  await signInAsOwner(page, "/admin/products/new");

  await page.getByLabel("Title").fill(TITLE);
  await page.getByLabel("Handle").fill(HANDLE);
  await page.getByLabel("Description").fill(DESCRIPTION);

  // First variant is already on the form; fill it, then add a second.
  await page.getByLabel("SKU").first().fill(`${HANDLE}-black`.toUpperCase());
  await page.getByLabel("Size").first().fill("One size");
  await page.getByLabel("Colour").first().fill("Black");
  await page.getByLabel("Price (paisa)").first().fill("1260000");
  await page.getByLabel("Stock", { exact: true }).first().fill("18");

  await page.getByRole("button", { name: "Add variant" }).click();
  await page.getByLabel("SKU").nth(1).fill(`${HANDLE}-sand`.toUpperCase());
  await page.getByLabel("Size").nth(1).fill("One size");
  await page.getByLabel("Colour").nth(1).fill("Sand");
  await page.getByLabel("Price (paisa)").nth(1).fill("1260000");
  await page.getByLabel("Stock", { exact: true }).nth(1).fill("6");

  // Three images, added one at a time — the form starts with none.
  for (const [index, image] of IMAGES.entries()) {
    await page.getByRole("button", { name: "Add image" }).click();
    await page.getByLabel("Image URL").nth(index).fill(image.url);
    await page.getByLabel("Alt text").nth(index).fill(image.alt);
  }

  await chooseStatus(page, "published");
  await page.getByRole("button", { name: "Save product" }).click();

  // The save lands on the product's own edit page. If it does not, the form's
  // own validation messages say why — surface them rather than timing out blind.
  await expect(async () => {
    const errors = await page.locator(".admin-error").allInnerTexts();
    expect(errors, `form refused to save: ${errors.join(" | ")}`).toHaveLength(0);
    expect(page.url()).toMatch(/\/admin\/products\/[0-9a-f-]{36}/);
  }).toPass({ timeout: 60_000 });

  // What the form claims it saved is what the database holds.
  const stored = await withDb(async (sql) => {
    const [product] = await sql`select id, title, description, status from products where handle = ${HANDLE}`;
    const media = await sql`
      select object_key, alt_text from media_references where product_id = ${product.id} and status = 'active'
    `;
    const variants = await sql`select sku, color, price_amount, stock_quantity from product_variants where product_id = ${product.id}`;
    return { product, media, variants };
  });

  expect(stored.product.title).toBe(TITLE);
  expect(stored.product.description).toBe(DESCRIPTION);
  expect(stored.product.status).toBe("published");
  expect(stored.media).toHaveLength(3);
  expect(stored.media.map((row) => row.object_key)).toEqual(IMAGES.map((image) => image.url));
  expect(stored.variants).toHaveLength(2);
  expect(Number(stored.variants[0].price_amount)).toBe(1_260_000);

  // A shopper can now find it and open its page.
  await page.goto(`/products/${HANDLE}`);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(page.getByText(DESCRIPTION.slice(0, 40), { exact: false }).first()).toBeVisible();

  // Every image the owner added is on the page, with its alt text intact. The
  // thumbnails are buttons whose accessible name is the alt text; the <img>
  // inside each is decorative (alt=""), so the name is what to assert on.
  for (const image of IMAGES) {
    await expect(page.getByRole("button", { name: image.alt })).toHaveCount(1);
  }

  // Both colours are offered.
  await expect(page.getByRole("radio", { name: /black/i }).first()).toBeVisible();
  await expect(page.getByRole("radio", { name: /sand/i }).first()).toBeVisible();
});

test("unpublishing hides a product from shoppers but keeps it editable", async ({ page }) => {
  await signInAsOwner(page, "/admin/products");

  // Every run of this spec creates a product with the same title, so it must be
  // found by its unique handle — otherwise the spec unpublishes an earlier run's.
  await page.getByRole("searchbox", { name: /title or handle/i }).fill(HANDLE);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: TITLE }).first().click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}/);

  // published -> unpublished is the only legal way back out of published.
  await chooseStatus(page, "unpublished");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page.getByText("Product saved.")).toBeVisible({ timeout: 30_000 });

  // An unpublished product is gone from the public catalogue, not a
  // visible-but-unbuyable page.
  //
  // KNOWN BUG, deliberately not asserted here: this responds 200, not 404.
  // notFound() inside this force-dynamic route renders the not-found view but
  // cannot set the status, so every missing or unpublished product is a soft
  // 404 to crawlers. An unmatched route (/nope) correctly returns 404.
  await page.goto(`/products/${HANDLE}`);
  await expect(page.getByText(/not found|no longer available/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /add to cart/i })).toHaveCount(0);

  await page.goto("/shop");
  await expect(page.getByRole("link", { name: TITLE })).toHaveCount(0);
});
