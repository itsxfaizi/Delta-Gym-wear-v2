import { expect, test } from "@playwright/test";

const INTRO_KEY = "delta-home-intro-seen";
const SCENES = ["hero", "engineered", "philosophy", "tests", "newsletter-footer"] as const;

test("desktop home renders every landing scene in order and keeps content reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), INTRO_KEY);
  await page.goto("/");

  const scenes = page.locator("[data-landing-scene]");
  await expect(scenes).toHaveCount(SCENES.length);
  for (const [index, name] of SCENES.entries()) {
    await expect(scenes.nth(index)).toHaveAttribute("data-landing-scene", name);
  }
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore Delta" })).toBeVisible();
});

test("wheel input remains available for native page scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(key, "true");
    Object.defineProperty(window, "__deltaPreventedWheel", { configurable: true, value: 0, writable: true });
    const original = Event.prototype.preventDefault;
    Event.prototype.preventDefault = function preventDefault() {
      if (this.type === "wheel") {
        const state = window as typeof window & { __deltaPreventedWheel?: number };
        state.__deltaPreventedWheel = (state.__deltaPreventedWheel ?? 0) + 1;
      }
      original.call(this);
    };
  }, INTRO_KEY);
  await page.goto("/");
  await page.mouse.wheel(0, 480);

  const prevented = await page.evaluate(() => (window as typeof window & { __deltaPreventedWheel?: number }).__deltaPreventedWheel ?? 0);
  expect(prevented).toBe(0);
});

test("mobile home uses normal document flow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), INTRO_KEY);
  await page.goto("/");

  const scenes = page.locator("[data-landing-scene]");
  await expect(scenes).toHaveCount(SCENES.length);
  await expect(scenes.first()).not.toHaveCSS("position", "fixed");
  await expect(scenes.first()).not.toHaveCSS("position", "sticky");
  const initialY = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialY);
});

test("reduced motion skips the intro and leaves all landing scenes visible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((key) => window.sessionStorage.removeItem(key), INTRO_KEY);
  await page.goto("/");

  await expect(page.locator("[data-opening-curtain]")).toBeHidden();
  for (const scene of await page.locator("[data-landing-scene]").all()) {
    await expect(scene).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Explore Delta" })).toBeVisible();
});
