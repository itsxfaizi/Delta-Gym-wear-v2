import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The landing deck derives frame visibility, aria-hidden and inert from React
 * state that only exists after hydration. Everything here asserts the document
 * a user actually receives: the server HTML plus CSS, before (or without) that
 * state, and the keyboard path through the hydrated deck.
 */

const INTRO_KEY = "delta-home-intro-seen";
const MOBILE = { width: 375, height: 720 };
const DESKTOP = { width: 1440, height: 900 };
const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** The copy each frame must actually paint - id of its heading, its exact text, and one line of body copy. */
const FRAME_CONTENT = [
  { frame: "hero", heading: "#landing-title", text: "Built for those who run with intent", body: "show up when no one" },
  { frame: "engineered", heading: "#engineered-title", text: "Engineered, not just stitched", body: "the last rep" },
  { frame: "philosophy", heading: "#philosophy-title", text: "Function first always, excess removed", body: "Product philosophy" },
  { frame: "tests", heading: "#tests-title", text: "Every product must pass three tests", body: "Moves without restriction" },
  { frame: "newsletter-footer", heading: "#newsletter-title", text: "No fluff. Just drops.", body: "info@deltagymwear.com" },
] as const;

/** Names every [data-motion] wrapper the browser is painting below full opacity. */
async function dimmedMotionWrappers(scope: Locator) {
  return scope.locator("[data-motion]").evaluateAll((elements) =>
    elements
      .filter((element) => Number.parseFloat(getComputedStyle(element).opacity) < 1)
      .map((element) => `${element.closest("[data-prototype-frame]")?.getAttribute("data-prototype-frame") ?? "?"}/${element.getAttribute("data-motion")}`),
  );
}

/**
 * Every frame paints its real copy at full opacity. The frame's own opacity and
 * its [data-motion] wrappers are both checked: the heading node itself computes
 * to opacity 1 even when an ancestor zeroes it, so a text-only check would pass
 * against a completely invisible section.
 */
async function expectEverySectionVisible(page: Page) {
  await expect(page.locator("[data-prototype-frame]")).toHaveCount(FRAME_CONTENT.length);

  for (const { frame, heading, text, body } of FRAME_CONTENT) {
    const section = page.locator(`[data-prototype-frame="${frame}"]`);
    await expect(section, `${frame} frame is painted`).toHaveCSS("opacity", "1");
    // Guards the emptiness case: an empty list of dimmed wrappers must mean
    // "none dimmed", not "none present".
    await expect(section.locator("[data-motion]"), `${frame} still carries its motion wrappers`).not.toHaveCount(0);
    expect(await dimmedMotionWrappers(section), `${frame} motion wrappers at full opacity`).toEqual([]);
    await expect(section.locator(heading), `${frame} heading is laid out`).toBeVisible();
    await expect(section.locator(heading)).toHaveText(text);
    await expect(section, `${frame} body copy is present`).toContainText(body);
  }

  // Five opaque frames stacked on one origin would satisfy every check above while
  // painting four of them underneath the fifth. Until the deck engages they have to
  // hold their own place in the document.
  const tops = await page.locator("[data-prototype-frame]").evaluateAll((elements) =>
    elements.map((element) => ({ frame: element.getAttribute("data-prototype-frame"), top: Math.round(element.getBoundingClientRect().top + window.scrollY) })),
  );
  expect(tops.map((entry) => entry.top), `frames must not stack: ${JSON.stringify(tops)}`).toEqual([...tops.map((entry) => entry.top)].sort((a, b) => a - b));
  expect(new Set(tops.map((entry) => entry.top)).size, `frames must not stack: ${JSON.stringify(tops)}`).toBe(tops.length);
}

/** Sections must never be withheld from assistive technology in the delivered document. */
async function expectNoSectionHiddenFromAssistiveTech(page: Page) {
  await expect(page.locator("[data-prototype-frame]")).toHaveCount(FRAME_CONTENT.length);
  const withheld = await page.locator("[data-prototype-frame]").evaluateAll((elements) =>
    elements
      .filter((element) => element.hasAttribute("inert") || element.getAttribute("aria-hidden") === "true")
      .map((element) => {
        const flags = [element.hasAttribute("inert") ? "inert" : "", element.getAttribute("aria-hidden") === "true" ? "aria-hidden" : ""].filter(Boolean);
        return `${element.getAttribute("data-prototype-frame")}[${flags.join(" ")}]`;
      }),
  );
  expect(withheld).toEqual([]);
}

for (const viewport of [MOBILE, DESKTOP]) {
  test.describe(`landing deck with javascript disabled at ${viewport.width}px`, () => {
    test.use({ javaScriptEnabled: false });

    test(`every section renders visible content at ${viewport.width}px without javascript`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expectEverySectionVisible(page);
    });

    test(`no section is hidden from assistive technology at ${viewport.width}px without javascript`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expectNoSectionHiddenFromAssistiveTech(page);
    });
  });

  test(`every section renders visible content at ${viewport.width}px before hydration`, async ({ page }) => {
    // Javascript stays enabled - only the framework bundle never arrives, which is
    // the state every visitor passes through between first paint and hydration.
    // The stylesheet is served from the same /_next/static/chunks/ prefix, so the
    // block is narrowed to .js or the page would render unstyled and prove nothing.
    await page.route((url) => url.pathname.startsWith("/_next/static/chunks/") && url.pathname.endsWith(".js"), (route) => route.abort());
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator('[data-home-timeline][data-timeline-ready="false"]'), "the controller has not run").toBeAttached();
    await expectEverySectionVisible(page);
    await expectNoSectionHiddenFromAssistiveTech(page);
  });
}

test("tab from a clean start reaches content in every section that holds a control", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), INTRO_KEY);
  await page.goto("/");
  // The reachable set is a property of the hydrated deck, so wait for the
  // controller's own readiness flag rather than sampling a half-booted page.
  await page.locator('[data-home-timeline][data-timeline-ready="true"]').waitFor();
  await page.evaluate(() => document.fonts.ready);

  const { tabbableCount, framesWithControls } = await page.evaluate((selector) => {
    const laidOut = (element: Element) => (element as HTMLElement).offsetParent !== null || getComputedStyle(element).position === "fixed";
    const tabbables = [...document.querySelectorAll(selector)].filter(laidOut);
    const frames = [...document.querySelectorAll("[data-prototype-frame]")]
      .filter((frame) => [...frame.querySelectorAll(selector)].some(laidOut))
      .map((frame) => frame.getAttribute("data-prototype-frame") ?? "?");
    return { tabbableCount: tabbables.length, framesWithControls: frames };
  }, TABBABLE);
  expect(tabbableCount, "the page offers controls to walk").toBeGreaterThan(0);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const stops: { frame: string; label: string }[] = [];
  for (let step = 0; step < tabbableCount + 5; step += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      // Focus on <body> means the ring left the page; NEXTJS-PORTAL is the dev
      // overlay, which sits after all page content and means the same thing.
      if (!element || element === document.body || element.tagName === "NEXTJS-PORTAL") return null;
      return {
        frame: element.closest("[data-prototype-frame]")?.getAttribute("data-prototype-frame") ?? "shell",
        label: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40),
      };
    });
    if (!stop) break;
    stops.push(stop);
  }

  const reachedFrames = [...new Set(stops.map((stop) => stop.frame))].filter((frame) => frame !== "shell");
  expect(reachedFrames.sort(), `tab walk stopped at ${JSON.stringify(stops)}`).toEqual([...framesWithControls].sort());
  expect(stops.length, "focus left the page before visiting every control").toBeGreaterThanOrEqual(tabbableCount);
});

test("scrubbing past the focused frame does not drop focus to the document body", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), INTRO_KEY);
  await page.goto("/");
  await page.locator('[data-home-timeline][data-timeline-ready="true"]').waitFor();
  await page.evaluate(() => document.fonts.ready);

  const heroLink = page.getByRole("link", { name: "Explore the range" });
  await heroLink.focus();
  await expect(heroLink).toBeFocused();

  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * 0.3));
  // Assert on the settle contract rather than a delay: the focus verdict is only
  // meaningful once the deck has actually moved off the hero frame.
  await expect(page.locator("[data-home-stage]")).toHaveAttribute("data-settled-frame", "engineered");

  const active = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    return { tag: element?.tagName ?? "NONE", label: (element?.getAttribute("aria-label") ?? element?.textContent ?? "").trim().slice(0, 40) };
  });
  expect(active.tag, "focus was silently dropped when the settled frame changed").not.toBe("BODY");
});

/**
 * Records what the timeline claims and what it withholds from the first parsed
 * byte onward. These values only exist between parse and hydration; any check
 * that samples after the fact reads the hydrated value and proves nothing.
 */
async function recordUnhydratedContract(page: Page) {
  await page.addInitScript(() => {
    const motionSeen: string[] = [];
    const withheldSeen: string[] = [];
    Object.assign(window, { __deltaMotionSeen: motionSeen, __deltaWithheldSeen: withheldSeen });
    const record = () => {
      const timeline = document.querySelector("[data-home-timeline]");
      if (timeline) {
        const motion = timeline.getAttribute("data-home-motion") ?? "missing";
        if (motionSeen[motionSeen.length - 1] !== motion) motionSeen.push(motion);
      }
      for (const frame of document.querySelectorAll("[data-prototype-frame]")) {
        if (!frame.hasAttribute("inert") && frame.getAttribute("aria-hidden") !== "true") continue;
        const id = frame.getAttribute("data-prototype-frame") ?? "?";
        if (!withheldSeen.includes(id)) withheldSeen.push(id);
      }
    };
    new MutationObserver(record).observe(document, { subtree: true, childList: true, attributes: true });
    record();
  });
}

for (const width of [320, 375]) {
  test(`mobile ${width}px reports honest timeline state under 20x cpu throttling`, async ({ page }) => {
    // A 20x slower main thread is the budget, not a flake allowance: it widens the
    // pre-hydration window rather than changing what the document should say.
    test.setTimeout(90_000);
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate: 20 });
    await recordUnhydratedContract(page);
    await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), INTRO_KEY);
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/");
    await page.locator('[data-home-timeline][data-timeline-ready="true"]').waitFor({ timeout: 60_000 });

    const motionSeen = await page.evaluate(() => (window as unknown as { __deltaMotionSeen: string[] }).__deltaMotionSeen);
    const withheldSeen = await page.evaluate(() => (window as unknown as { __deltaWithheldSeen: string[] }).__deltaWithheldSeen);
    expect(motionSeen, `data-home-motion values observed at ${width}px`).toEqual(["flow"]);
    expect(withheldSeen, `frames withheld from assistive technology at ${width}px`).toEqual([]);
    await expect(page.locator("[data-home-stage]")).toHaveCSS("position", "static");
  });
}
