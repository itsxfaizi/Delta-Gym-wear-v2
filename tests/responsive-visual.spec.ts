import { expect, test } from "@playwright/test";

test("captures responsive storefront evidence", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("delta-home-intro-seen", "true"));

  const captures = [
    { width: 320, height: 900, route: "/", name: "home-320" },
    { width: 768, height: 1024, route: "/", name: "home-768" },
    { width: 1024, height: 900, route: "/", name: "home-1024" },
    { width: 1440, height: 1000, route: "/", name: "home-1440" },
    { width: 1024, height: 900, route: "/shop", name: "shop-1024" },
    { width: 1440, height: 1000, route: "/shop", name: "shop-1440" },
    { width: 320, height: 900, route: "/products/airflow-stringer-tank", name: "pdp-320" },
    { width: 1440, height: 1000, route: "/products/airflow-stringer-tank", name: "pdp-1440" },
  ] as const;

  for (const capture of captures) {
    await page.setViewportSize({ width: capture.width, height: capture.height });
    await page.goto(capture.route);
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
    const capturesPinnedHome = capture.route === "/" && capture.width >= 1024;
    await page.screenshot({ path: `output/playwright/responsive/${capture.name}.png`, fullPage: !capturesPinnedHome });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/products/airflow-stringer-tank");
  await page.getByRole("radio", { name: "L", exact: true }).click();
  await page.getByRole("button", { name: "ADD TO CART" }).click();
  await page.screenshot({ path: "output/playwright/responsive/cart-drawer-1440.png", fullPage: true });
  await page.getByRole("link", { name: "View cart" }).click();
  await page.screenshot({ path: "output/playwright/responsive/cart-page-1440.png", fullPage: true });
});
