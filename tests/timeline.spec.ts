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
  // At rest the rendered progress already agrees with the scroll position, so the
  // settle check cannot tell a hydrated page from a static one and would return
  // before the scroll listener exists — dumping all hydration latency into the
  // first scroll's budget. Wait for the controller's own readiness flag first.
  await page.locator('[data-home-timeline][data-timeline-ready="true"]').waitFor();
  // Webfonts change metrics and therefore scrollHeight; settle before measuring.
  await page.evaluate(() => document.fonts.ready);
  await waitForInterpolationSettled(page);
}

async function readProgress(page: import("@playwright/test").Page) {
  return page.locator("[data-home-stage]").evaluate((stage) => {
    const value = getComputedStyle(stage).getPropertyValue("--timeline-progress").trim();
    return Number.parseFloat(value);
  });
}

/**
 * The controller derives progress from getBoundingClientRect() inside a
 * requestAnimationFrame-throttled scroll listener, so the rendered value lags the
 * scroll by at least a frame — and a late webfont swap can still change
 * scrollHeight after the first scrollTo. Waiting a fixed delay races both.
 * Instead: settle layout, re-apply the offset, then block until the rendered
 * progress agrees with what the live scroll position implies.
 */
async function waitForInterpolationSettled(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const root = document.querySelector<HTMLElement>("[data-home-timeline]");
      if (!root) return false;
      const range = Math.max(root.offsetHeight - window.innerHeight, 1);
      const expected = Math.min(Math.max(-root.getBoundingClientRect().top / range, 0), 1);
      const rendered = Number.parseFloat(root.getAttribute("data-scroll-progress") ?? "");
      return Number.isFinite(rendered) && Math.abs(rendered - expected) < 0.0005;
    },
    undefined,
    { timeout: 5_000, polling: "raf" },
  );
}

async function scrollToProgress(page: import("@playwright/test").Page, fraction: number) {
  await page.evaluate(async (ratio) => {
    await document.fonts.ready;
    const target = () => Math.max(0, (document.documentElement.scrollHeight - window.innerHeight) * ratio);
    window.scrollTo(0, target());
    // Re-apply after a frame so a post-font-swap layout shift cannot strand us
    // at an offset computed from a stale scrollHeight.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    window.scrollTo(0, target());
  }, fraction);
  await waitForInterpolationSettled(page);
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

  // mouse.wheel dispatches asynchronously, so the settle check must not sample
  // before the scroll lands — at that instant the rendered progress and the
  // scroll position still agree at their old values and it would return early.
  // Wait for the document to actually move first, then for interpolation to catch up.
  const beforeY = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 480);
  await page.waitForFunction((y) => window.scrollY !== y, beforeY, { timeout: 5_000, polling: "raf" });
  await waitForInterpolationSettled(page);

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

  // The server now renders the honest flow state, so every assertion below is
  // satisfied by the raw HTML. Wait for the controller to attach before reading
  // it, or the test proves the markup shipped rather than that the client ran.
  await page.locator('[data-home-timeline][data-timeline-ready="true"]').waitFor();

  await expect(page.locator("[data-home-timeline]")).toHaveAttribute("data-home-motion", "flow");
  await expect(page.locator("[data-home-stage]")).toHaveCSS("position", "static");
  await expect(page.locator("[data-prototype-frame]")).toHaveCount(PROTOTYPE_FRAMES.length);

  await page.evaluate(() => document.fonts.ready);
  const [initialY, initialHeight] = await page.evaluate(() => [window.scrollY, document.documentElement.scrollHeight]);
  await page.mouse.wheel(0, 500);
  // Wait for the scroll offset to stop moving rather than for the asserted
  // condition, so the assertion below still has to earn its pass.
  await page.waitForFunction(
    () => {
      const state = window as typeof window & { __deltaLastY?: number };
      const settled = state.__deltaLastY === window.scrollY;
      state.__deltaLastY = window.scrollY;
      return settled;
    },
    undefined,
    { timeout: 5_000, polling: "raf" },
  );
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeGreaterThan(initialY);
  expect(initialHeight).toBeGreaterThan(720);
});

test("reduced motion skips the intro and renders stable normal-flow frames", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((key) => window.sessionStorage.removeItem(key), INTRO_KEY);
  await page.goto("/");

  // The server now renders the honest flow state, so every assertion below is
  // satisfied by the raw HTML. Wait for the controller to attach before reading
  // it, or the test proves the markup shipped rather than that the client ran.
  await page.locator('[data-home-timeline][data-timeline-ready="true"]').waitFor();

  await expect(page.locator("[data-home-intro]")).toHaveCount(0);
  await expect(page.locator("[data-home-timeline]")).toHaveAttribute("data-home-motion", "flow");
  await expect(page.locator("[data-home-stage]")).toHaveCSS("position", "static");

  for (const frame of await page.locator("[data-prototype-frame]").all()) {
    await expect(frame).toHaveCSS("transform", "none");
    await expect(frame).toHaveCSS("animation-name", "none");
  }
});
