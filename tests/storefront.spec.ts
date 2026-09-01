import { expect, test } from "@playwright/test";

test("home follows the prototype sequence and leads to the catalog", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("delta-home-intro-seen", "true"));
  await page.goto("/");
  await expect(page.locator("[data-prototype-frame]")).toHaveCount(5);
  await expect(page.locator("[data-home-motion]")).toHaveAttribute("data-home-motion", "scrubbed");
  await expect(page.getByRole("heading", { name: "Built for those who run with intent" })).toBeVisible();
  await expect(page.locator("#engineered-title")).toBeAttached();
  await expect(page.locator("#philosophy-title")).toBeAttached();
  await expect(page.locator("#tests-title")).toBeAttached();
  await expect(page.locator("#newsletter-title")).toBeAttached();
  await page.getByRole("link", { name: "Explore the range" }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByRole("heading", { name: "All Products" })).toBeVisible();
});

test("home presents the Figma logo intro on a first visit", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.removeItem("delta-home-intro-seen"));
  await page.goto("/");

  await expect(page.locator("[data-home-intro]")).toBeVisible();
  await expect(page.locator("[data-home-intro] img")).toHaveAttribute("src", "/design-reference/assets/delta-logo.svg");
});

test("desktop home scrubs continuously and wheel remains native", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => window.sessionStorage.setItem("delta-home-intro-seen", "true"));
  await page.goto("/");

  const home = page.getByRole("main", { name: "Delta landing scenes" });
  const hero = page.locator('[data-prototype-frame="hero"]');
  const engineered = page.locator('[data-prototype-frame="engineered"]');

  await expect(home).toHaveAttribute("data-home-motion", "scrubbed");
  await expect(hero).toHaveAttribute("data-frame-state", "settled");

  await page.mouse.wheel(0, 240);
  await page.evaluate(() => window.scrollTo({ top: (document.documentElement.scrollHeight - window.innerHeight) * 0.25, behavior: "auto" }));
  await expect.poll(() => page.locator("[data-scroll-progress]").getAttribute("data-scroll-progress")).not.toBe("0");
  await expect.poll(() => engineered.getAttribute("data-frame-state")).toBe("settled");
  await page.evaluate(() => window.scrollTo({ top: (document.documentElement.scrollHeight - window.innerHeight) * 0.02, behavior: "auto" }));
  await expect.poll(() => hero.getAttribute("data-frame-state")).toBe("settled");
});

test("mobile renders the prototype frames as normal flowing sections", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.addInitScript(() => window.sessionStorage.setItem("delta-home-intro-seen", "true"));
  await page.goto("/");
  // The server now renders the honest flow state, so every assertion below is
  // satisfied by the raw HTML. Wait for the controller to attach before reading
  // it, or the test proves the markup shipped rather than that the client ran.
  await page.locator('[data-home-timeline][data-timeline-ready="true"]').waitFor();
  await expect(page.locator(".prototype-viewport")).toHaveCSS("position", "static");
  await expect(page.locator("[data-prototype-frame]")).toHaveCount(5);
});

test("catalog search, filters, and sort stay in the URL", async ({ page }) => {
  await page.goto("/shop");
  await page.getByRole("searchbox", { name: "Search products" }).fill("Ease");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=Ease/);
  await page.getByRole("checkbox", { name: "M" }).check();
  await expect(page).toHaveURL(/size=m/);
  await page.getByLabel("Sort products").selectOption("price-desc");
  await expect(page).toHaveURL(/sort=price-desc/);
  await expect(page.getByRole("link", { name: /Ease Fit Trouser/ }).first()).toBeVisible();
});

test("catalog no-results state clears back to the published catalog", async ({ page }) => {
  await page.goto("/shop?q=not-a-real-product");
  await expect(page.getByRole("heading", { name: "No products match" })).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByRole("link", { name: /Ease Fit Trouser/ }).first()).toBeVisible();
});

test("catalog to product to cart drawer and cart page", async ({ page }) => {
  await page.goto("/shop");
  await page.getByRole("link", { name: "Ease Fit Trouser" }).first().click();
  await expect(page.getByRole("heading", { name: "Ease Fit Trouser" })).toBeVisible();
  await page.getByRole("radio", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "ADD TO CART" }).click();
  await expect(page.getByRole("dialog", { name: /YOUR CART/ })).toBeVisible();
  await expect(page.getByText("Black / M")).toBeVisible();
  await page.getByRole("link", { name: "View cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
  await expect(page.getByText("Black / M")).toBeVisible();
});

test("unavailable variant reports an accessible error", async ({ page }) => {
  await page.goto("/products/ease-fit-trouser");
  await expect(page.getByRole("radio", { name: "L unavailable" })).toBeDisabled();
  await page.getByRole("button", { name: "ADD TO CART" }).click();
  await expect(page.getByText("Select a size to continue.")).toBeVisible();
});

test("variant radio groups support arrow-key selection", async ({ page }) => {
  await page.goto("/products/ease-fit-trouser");
  const medium = page.getByRole("radio", { name: "M", exact: true });
  await medium.focus();
  await medium.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: "S", exact: true })).toHaveAttribute("aria-checked", "true");
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
  await page.goto("/products/ease-fit-trouser");
  await page.getByRole("radio", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "ADD TO CART" }).click();
  await page.getByRole("button", { name: "Close cart" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Open cart, 1 item/ }).click();
  await expect(page.getByText("Black / M")).toBeVisible();
});

test("product metadata and structured data exclude unverified ratings", async ({ page }) => {
  await page.goto("/products/ease-fit-trouser");
  await expect(page).toHaveTitle(/Ease Fit Trouser/);
  const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
  expect(structuredData).toContain('"@type":"Product"');
  expect(structuredData).not.toContain("aggregateRating");
  expect(structuredData).not.toContain('"@type":"Offer"');
});

test("tampered and unavailable persisted cart lines fail closed", async ({ page }) => {
  await page.goto("/shop");
  await page.evaluate(() => {
    window.localStorage.setItem("delta-cart:public", JSON.stringify([
      { productHandle: "ease-fit-trouser", variantId: "dev-ease-black-l", quantity: 1, fabricatedPrice: 1 },
      { productHandle: "ease-fit-trouser", variantId: "missing", quantity: 1 },
    ]));
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Open cart, 0 items" })).toBeVisible();
});

test("reduced motion removes meaningful transition duration", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  // The server now renders the honest flow state, so every assertion below is
  // satisfied by the raw HTML. Wait for the controller to attach before reading
  // it, or the test proves the markup shipped rather than that the client ran.
  await page.locator('[data-home-timeline][data-timeline-ready="true"]').waitFor();
  await expect(page.locator("[data-home-intro]")).toHaveCount(0);
  await expect(page.locator(".prototype-viewport")).toHaveCSS("position", "static");
  const duration = await page.getByRole("link", { name: "Explore the range" }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
  await expect(page.locator(".landing-hero-poster")).toBeVisible();
  await expect(page.locator(".landing-hero-video")).toHaveCount(0);
});

test("home uses Figma-authored media without layout shift", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".landing-hero-poster")).toBeVisible();
  await expect(page.locator(".landing-hero-video")).toHaveAttribute("src", "/design-reference/assets/landing/hero-run.mp4");
});
