import { expect, test } from "@playwright/test";

const INTRO_KEY = "delta-home-intro-seen";

async function openDesktopTimeline(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(key, "true");
    Object.defineProperty(window, "__deltaPreventedWheel", {
      configurable: true,
      value: 0,
      writable: true,
    });
    const nativePreventDefault = Event.prototype.preventDefault;
    Event.prototype.preventDefault = function preventDefault() {
      if (this.type === "wheel") {
        const state = window as typeof window & { __deltaPreventedWheel?: number };
        state.__deltaPreventedWheel = (state.__deltaPreventedWheel ?? 0) + 1;
      }
      nativePreventDefault.call(this);
    };
  }, INTRO_KEY);
  await page.goto("/");
  await expect(page.locator("[data-home-timeline]"), "home exposes the continuous timeline contract").toBeVisible();
  await expect(page.locator("[data-home-stage]"), "home keeps one pinned stage").toBeVisible();
}

async function readProgress(page: import("@playwright/test").Page) {
  return page.locator("[data-home-stage]").evaluate((stage) => {
    const value = getComputedStyle(stage).getPropertyValue("--timeline-progress").trim();
    return Number.parseFloat(value);
  });
}

async function scrollToProgress(page: import("@playwright/test").Page, fraction: number) {
  await page.evaluate((ratio) => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.max(0, maxScroll * ratio));
  }, fraction);
  await page.waitForTimeout(100);
}

const PROTOTYPE_FRAMES = ["hero", "engineered", "philosophy", "tests", "newsletter-footer"] as const;

test("desktop scroll traverses every verified Figma prototype frame in order", async ({ page }) => {
  await openDesktopTimeline(page);

  await expect(page.locator("[data-home-timeline]")).toHaveAttribute("data-home-motion", "scrubbed");
  await expect(page.locator("[data-home-stage]")).toHaveCSS("position", "sticky");
  await expect(page.locator("html")).toHaveCSS("scroll-snap-type", "none");
  await expect(page.locator("[data-prototype-frame]")).toHaveCount(PROTOTYPE_FRAMES.length);

  for (const frame of PROTOTYPE_FRAMES) {
    await expect(page.locator(`[data-prototype-frame="${frame}"]`)).toBeAttached();
  }

  const settledFrames: string[] = [];
  for (const fraction of [0.02, 0.25, 0.48, 0.72, 0.96]) {
    await scrollToProgress(page, fraction);
    settledFrames.push(await page.locator("[data-home-stage]").getAttribute("data-settled-frame") ?? "");
  }

  expect(settledFrames).toEqual(PROTOTYPE_FRAMES);
});

test("wheel input remains native and advances the same continuous progress value", async ({ page }) => {
  await openDesktopTimeline(page);
  const before = await readProgress(page);

  await page.mouse.wheel(0, 480);
  await page.waitForTimeout(200);

  const after = await readProgress(page);
  const prevented = await page.evaluate(() => {
    const state = window as typeof window & { __deltaPreventedWheel?: number };
    return state.__deltaPreventedWheel ?? 0;
  });
  expect(after).toBeGreaterThan(before);
  expect(prevented).toBe(0);
});

test("reverse scrolling follows the same deterministic interpolation", async ({ page }) => {
  await openDesktopTimeline(page);

  await scrollToProgress(page, 0.75);
  const forwardFrame = await page.locator("[data-home-stage]").getAttribute("data-settled-frame");
  await scrollToProgress(page, 0.48);
  const reverseFrame = await page.locator("[data-home-stage]").getAttribute("data-settled-frame");
  await scrollToProgress(page, 0.75);
  const replayedFrame = await page.locator("[data-home-stage]").getAttribute("data-settled-frame");

  expect(forwardFrame).toBe("tests");
  expect(reverseFrame).toBe("philosophy");
  expect(replayedFrame).toBe("tests");
});

test("mobile uses normal document flow without a pinned stage or scroll interception", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), INTRO_KEY);
  await page.goto("/");

  await expect(page.locator("[data-home-timeline]")).toHaveAttribute("data-home-motion", "flow");
  await expect(page.locator("[data-home-stage]")).toHaveCSS("position", "static");
  await expect(page.locator("[data-prototype-frame]")).toHaveCount(PROTOTYPE_FRAMES.length);

  const [initialY, initialHeight] = await page.evaluate(() => [window.scrollY, document.documentElement.scrollHeight]);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(100);
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeGreaterThan(initialY);
  expect(initialHeight).toBeGreaterThan(720);
});

test("reduced motion skips the intro and renders stable normal-flow frames", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((key) => window.sessionStorage.removeItem(key), INTRO_KEY);
  await page.goto("/");

  await expect(page.locator("[data-home-intro]")).toHaveCount(0);
  await expect(page.locator("[data-home-timeline]")).toHaveAttribute("data-home-motion", "flow");
  await expect(page.locator("[data-home-stage]")).toHaveCSS("position", "static");

  for (const frame of await page.locator("[data-prototype-frame]").all()) {
    await expect(frame).toHaveCSS("transform", "none");
    await expect(frame).toHaveCSS("animation-name", "none");
  }
});
