import { expect, test } from "@playwright/test";

test("home follows the landing sequence and leads to the catalog", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("delta-home-intro-seen", "true"));
  await page.goto("/");
  await expect(page.locator("[data-landing-scene]")).toHaveCount(5);
  await expect(page.locator("[data-landing-scene]").nth(0)).toHaveAttribute("data-landing-scene", "hero");
  await expect(page.locator("[data-landing-scene]").nth(4)).toHaveAttribute("data-landing-scene", "newsletter-footer");
  await expect(page.getByRole("heading", { name: "Built for those who train with intent." })).toBeVisible();
  await expect(page.locator("#engineered-title")).toBeAttached();
  await expect(page.locator("#philosophy-title")).toBeAttached();
  await expect(page.locator("#tests-title")).toBeAttached();
  await expect(page.locator("#newsletter-title")).toBeAttached();
  await page.getByRole("link", { name: "Explore Delta" }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByRole("heading", { name: "All Products" })).toBeVisible();
});

test("home includes an inert opening curtain on a first visit", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.removeItem("delta-home-intro-seen"));
  await page.goto("/");

  const curtain = page.locator("[data-opening-curtain]");
  await expect(curtain).toBeAttached();
  await expect(curtain).toHaveAttribute("aria-hidden", "true");
  await expect(curtain.locator("img")).toHaveAttribute("src", "/design-reference/assets/delta-logo.svg");
});

test("desktop home renders the full sequence and wheel remains native", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => window.sessionStorage.setItem("delta-home-intro-seen", "true"));
  await page.goto("/");

  const home = page.getByRole("main", { name: "Delta landing" });
  const hero = page.locator('[data-landing-scene="hero"]');
  const engineered = page.locator('[data-landing-scene="engineered"]');

  await expect(home).toBeVisible();
  await expect(hero).toBeVisible();

  await page.mouse.wheel(0, 240);
  await page.evaluate(() => window.scrollTo({ top: (document.documentElement.scrollHeight - window.innerHeight) * 0.25, behavior: "auto" }));
  await expect(engineered).toBeAttached();
  await page.evaluate(() => window.scrollTo({ top: (document.documentElement.scrollHeight - window.innerHeight) * 0.02, behavior: "auto" }));
  await expect(hero).toBeAttached();
});

test("mobile renders the landing scenes as normal flowing sections", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.addInitScript(() => window.sessionStorage.setItem("delta-home-intro-seen", "true"));
  await page.goto("/");
  const scenes = page.locator("[data-landing-scene]");
  await expect(scenes).toHaveCount(5);
  await expect(scenes.first()).not.toHaveCSS("position", "fixed");
  await expect(scenes.first()).not.toHaveCSS("position", "sticky");
});

test("catalog search, filters, and sort stay in the URL", async ({ page }) => {
  await page.goto("/shop");
  // The field is debounced, so the URL follows typing without a submit button.
  await page.getByRole("searchbox", { name: "Search the catalog" }).fill("Airflow");
  await expect(page).toHaveURL(/q=Airflow/);
  const mediumSize = page.getByRole("checkbox", { name: "M", exact: true });
  await mediumSize.click();
  await expect(page).toHaveURL(/size=m/);
  await expect(mediumSize).toBeChecked();
  await page.getByLabel("Sort products").selectOption("price-desc");
  await expect(page).toHaveURL(/sort=price-desc/);
  await expect(page.getByRole("link", { name: /Airflow Stringer Tank/ }).first()).toBeVisible();
});

test("catalog no-results state clears back to the published catalog", async ({ page }) => {
  await page.goto("/shop?q=not-a-real-product");
  await expect(page.getByRole("heading", { name: "No products match" })).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByRole("link", { name: /Airflow Stringer Tank/ }).first()).toBeVisible();
});

test("catalog to product to cart drawer and cart page", async ({ page }) => {
  await page.goto("/shop");
  await page.getByRole("link", { name: "Airflow Stringer Tank" }).first().click();
  await expect(page.getByRole("heading", { name: "Airflow Stringer Tank" })).toBeVisible();
  await page.getByRole("radio", { name: "L", exact: true }).click();
  await page.getByRole("button", { name: "ADD TO CART" }).click();
  await expect(page.getByRole("dialog", { name: /YOUR CART/ })).toBeVisible();
  await expect(page.getByText("Black / L")).toBeVisible();
  await page.getByRole("link", { name: "View cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
  await expect(page.getByText("Black / L")).toBeVisible();
});

test("unavailable variant reports an accessible error", async ({ page }) => {
  await page.goto("/products/airflow-stringer-tank");
  await expect(page.getByRole("radio", { name: "XS unavailable" })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: "ADD TO CART" }).click();
  await expect(page.getByText("Select a size to continue.")).toBeVisible();
});

test("variant radio groups support arrow-key selection", async ({ page }) => {
  await page.goto("/products/airflow-stringer-tank");
  const sizeGroup = page.locator(".size-options");
  const available = sizeGroup.locator('[role="radio"][aria-disabled="false"]');
  const labels = await available.evaluateAll((radios) => radios.map((radio) => radio.getAttribute("aria-label") ?? ""));
  const current = available.nth(0);
  const nextLabel = labels[1];
  expect(nextLabel).toBeTruthy();
  await current.focus();
  await current.press("ArrowRight");
  await expect(sizeGroup.getByRole("radio", { name: nextLabel, exact: true })).toHaveAttribute("aria-checked", "true");
});

test("cart drawer traps focus, closes with Escape, and restores focus", async ({ page }) => {
  await page.goto("/shop");
  const trigger = page.getByRole("button", { name: /Open cart/ });
  await trigger.focus();
  await trigger.press("Enter");
  await expect(page.getByRole("button", { name: "Close cart" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "Continue shopping" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /YOUR CART/ })).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("unknown collections and products use the not-found experience", async ({ page }) => {
  await page.goto("/collections/not-a-real-collection");
  await expect(page.getByRole("heading", { name: "Collection not found" })).toBeVisible();
  await page.goto("/products/not-a-real-product");
  await expect(page.getByRole("heading", { name: "Product not found" })).toBeVisible();
});

test("cart persists across reloads", async ({ page }) => {
  await page.goto("/products/airflow-stringer-tank");
  await page.getByRole("radio", { name: "L", exact: true }).click();
  await page.getByRole("button", { name: "ADD TO CART" }).click();
  await page.getByRole("button", { name: "Close cart" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Open cart, 1 item/ }).click();
  await expect(page.getByText("Black / L")).toBeVisible();
});

test("product metadata and structured data exclude unverified ratings", async ({ page }) => {
  await page.goto("/products/airflow-stringer-tank");
  await expect(page).toHaveTitle(/Airflow Stringer Tank/);
  const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
  expect(structuredData).toContain('"@type":"Product"');
  expect(structuredData).not.toContain("aggregateRating");
  expect(structuredData).toContain('"@type":"Offer"');
  expect(structuredData).toContain('"priceCurrency":"PKR"');
});

test("tampered and unavailable persisted cart lines fail closed", async ({ page }) => {
  await page.goto("/shop");
  await page.evaluate(() => {
    window.localStorage.setItem("delta-cart:public", JSON.stringify([
      { productHandle: "airflow-stringer-tank", variantId: "not-a-real-variant", quantity: 1, fabricatedPrice: 1 },
      { productHandle: "airflow-stringer-tank", variantId: "missing", quantity: 1 },
    ]));
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Open cart, 0 items" })).toBeVisible();
});

test("reduced motion removes meaningful transition duration", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-opening-curtain]")).toBeHidden();
  await expect(page.locator("[data-landing-scene]").first()).not.toHaveCSS("position", "fixed");
  const duration = await page.getByRole("link", { name: "Explore Delta" }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
  await expect(page.locator(".landing-hero-poster")).toBeVisible();
  await expect(page.locator(".landing-hero-video")).toHaveCount(0);
});

test("home uses Figma-authored media without layout shift", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".landing-hero-poster")).toBeVisible();
  await expect(page.locator(".landing-hero-video")).toHaveAttribute("src", "/design-reference/assets/landing/hero-run.mp4");
});
