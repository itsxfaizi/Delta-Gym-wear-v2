import { expect, test } from "@playwright/test";

/**
 * Catalogue search: tolerant of typos, debounced into the URL, and cleared from
 * the field itself. There is no Search button and no Clear button — the cross
 * inside the field is the only control.
 */

const KNOWN_PRODUCT = /Airflow Stringer Tank/;

test("typing searches without a button, and a typo still finds the product", async ({ page }) => {
  await page.goto("/shop");

  const field = page.getByRole("searchbox", { name: "Search the catalog" });
  await field.fill("stringr");

  // Debounced: the URL follows the field on a pause, with nothing clicked.
  await expect(page).toHaveURL(/q=stringr/, { timeout: 10_000 });
  await expect(page.getByRole("link", { name: KNOWN_PRODUCT }).first()).toBeVisible();
});

test("word order and case do not matter", async ({ page }) => {
  await page.goto("/shop?q=TANK+airflow");
  await expect(page.getByRole("link", { name: KNOWN_PRODUCT }).first()).toBeVisible();
});

test("the cross clears the field and the query together", async ({ page }) => {
  await page.goto("/shop?q=stringer");

  const clear = page.getByRole("button", { name: "Clear search" });
  await expect(clear).toBeVisible();
  await clear.click();

  await expect(page).not.toHaveURL(/q=/);
  await expect(page.getByRole("searchbox", { name: "Search the catalog" })).toHaveValue("");

  // There is no submit button to fall back on.
  await expect(page.getByRole("button", { name: "Search", exact: true })).toHaveCount(0);
});

test("nonsense matches nothing rather than everything", async ({ page }) => {
  await page.goto("/shop?q=dsadasd");
  await expect(page.getByRole("heading", { name: /no products match/i })).toBeVisible();
});
