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

test("home presents the Figma logo intro once per browser session", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 940 });
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("delta-intro-test-initialized")) return;
    window.sessionStorage.removeItem("delta-home-intro-seen");
    window.sessionStorage.setItem("delta-intro-test-initialized", "true");
  });
  await page.addInitScript(() => {
    const probe = {} as { display?: string; time?: number };
    (window as typeof window & { __deltaIntroPaintProbe?: typeof probe }).__deltaIntroPaintProbe = probe;
    const observer = new MutationObserver(() => {
      const intro = document.querySelector("[data-home-intro]");
      if (!intro) return;
      probe.display = getComputedStyle(intro).display;
      probe.time = performance.now();
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto("/");

  const intro = page.locator("[data-home-intro]");
  const mark = intro.locator("img");
  const firstPaint = await page.evaluate(() => ({
    fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
    intro: (window as typeof window & { __deltaIntroPaintProbe?: { display?: string; time?: number } }).__deltaIntroPaintProbe,
  }));
  expect(firstPaint.intro?.display).toBe("grid");

  // The property under test is "the intro is in the first paint, not popped in
  // after hydration". Comparing the MutationObserver's callback timestamp to the
  // compositor's first-contentful-paint entry races those two clocks: the two are
  // recorded by different mechanisms and land within a millisecond of each other,
  // so under parallel load this failed by 1.2-4.7ms while the intro was in fact
  // server-rendered. Asserting on the delivered HTML proves the same property
  // deterministically, and proves more: an element present in the server response
  // cannot have been added after hydration, whatever the clocks say.
  const serverHtml = await (await fetch(new URL("/", page.url()).toString())).text();
  expect(serverHtml, "the intro overlay is not server-rendered, so it cannot be in the first paint").toContain(
    "data-home-intro",
  );
  expect(firstPaint.fcp, "no first-contentful-paint entry - the page never painted").toBeGreaterThan(0);
  await expect(intro).toBeVisible();
  await expect(intro).toHaveCSS("pointer-events", "none");
  await expect(mark).toHaveAttribute("src", "/design-reference/assets/delta-logo.svg");

  const animationNames = await intro.evaluate((overlay) => ({
    overlay: overlay.getAnimations().map((animation) => animation instanceof CSSAnimation ? animation.animationName : ""),
    mark: overlay.querySelector("img")?.getAnimations().map((animation) => animation instanceof CSSAnimation ? animation.animationName : "") ?? [],
  }));
  expect(animationNames.mark).toContain("home-intro-mark-arrive");
  expect(animationNames.overlay).toContain("home-intro-dissolve");

  const motion = await intro.evaluate(async (overlay) => {
    const logo = overlay.querySelector("img");
    const markAnimation = logo?.getAnimations().find((animation) => animation instanceof CSSAnimation && animation.animationName === "home-intro-mark-arrive");
    const dissolveAnimation = overlay.getAnimations().find((animation) => animation instanceof CSSAnimation && animation.animationName === "home-intro-dissolve");
    if (!logo || !markAnimation || !dissolveAnimation) throw new Error("Expected intro animations are missing");

    markAnimation.pause();
    dissolveAnimation.pause();
    const markTiming = markAnimation.effect!.getTiming();
    const dissolveTiming = dissolveAnimation.effect!.getTiming();
    const markDelay = markTiming.delay ?? 0;
    const dissolveDelay = dissolveTiming.delay ?? 0;
    const markDuration = Number(markTiming.duration);
    const dissolveDuration = Number(dissolveTiming.duration);

    markAnimation.currentTime = markDelay;
    await new Promise(requestAnimationFrame);
    const source = logo.getBoundingClientRect();
    markAnimation.currentTime = markDelay + markDuration;
    await new Promise(requestAnimationFrame);
    const destination = logo.getBoundingClientRect();

    dissolveAnimation.currentTime = dissolveDelay;
    await new Promise(requestAnimationFrame);
    const startOpacity = Number.parseFloat(getComputedStyle(overlay).opacity);
    dissolveAnimation.currentTime = dissolveDelay + dissolveDuration;
    await new Promise(requestAnimationFrame);
    const endOpacity = Number.parseFloat(getComputedStyle(overlay).opacity);

    return {
      mark: { delay: markDelay, duration: markDuration, easing: getComputedStyle(logo).animationTimingFunction },
      dissolve: { delay: dissolveDelay, duration: dissolveDuration, easing: getComputedStyle(overlay).animationTimingFunction, startOpacity, endOpacity },
      source: { x: source.x, y: source.y, width: source.width, height: source.height },
      destination: { x: destination.x, y: destination.y, width: destination.width, height: destination.height },
    };
  });

  expect(motion.mark.delay).toBeCloseTo(1000, 6);
  expect(motion.mark.duration).toBeCloseTo(3125.307321548462, 2);
  expect(motion.mark.easing).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
  expect(motion.dissolve.delay).toBeCloseTo(4135.307321324945, 2);
  expect(motion.dissolve.duration).toBeCloseTo(500, 6);
  expect(motion.dissolve.easing).toBe("ease-out");
  expect(motion.dissolve.startOpacity).toBe(1);
  expect(motion.dissolve.endOpacity).toBe(0);

  for (const [property, value] of Object.entries({ x: 573, y: 419, width: 293.3828430175781, height: 73.00000762939453 })) {
    expect(motion.source[property as keyof typeof motion.source]).toBeCloseTo(value, 1);
  }
  for (const [property, value] of Object.entries({ x: -23901, y: -3812, width: 29961.275390625, height: 7455 })) {
    expect(Math.abs(motion.destination[property as keyof typeof motion.destination] - value)).toBeLessThanOrEqual(1);
  }

  await page.reload();
  await expect(page.locator("[data-home-intro]")).toHaveCount(0);
  const reloadPaint = await page.evaluate(() => ({
    fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
    intro: (window as typeof window & { __deltaIntroPaintProbe?: { display?: string; time?: number } }).__deltaIntroPaintProbe,
  }));
  expect(reloadPaint.intro?.display).toBe("none");
  expect(reloadPaint.intro?.time).toBeLessThanOrEqual(reloadPaint.fcp!);
});

test("home does not visibly replay its intro after client navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 940 });
  await page.addInitScript(() => {
    window.sessionStorage.removeItem("delta-home-intro-seen");
    const displays: string[] = [];
    const seen = new WeakSet<HTMLElement>();
    (window as typeof window & { __deltaIntroDisplays?: string[] }).__deltaIntroDisplays = displays;
    new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>("[data-home-intro]").forEach((intro) => {
        if (!seen.has(intro)) {
          seen.add(intro);
          displays.push(getComputedStyle(intro).display);
        }
      });
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/");
  await expect(page.locator("[data-home-intro]")).toBeVisible();
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 6 });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.getByRole("link", { name: "Shop", exact: true }).click();
    await expect(page).toHaveURL(/\/shop$/);
    const displayCount = await page.evaluate(() => (window as typeof window & { __deltaIntroDisplays?: string[] }).__deltaIntroDisplays?.length ?? 0);

    await page.getByRole("banner").getByRole("link", { name: "Delta Gym Wear home" }).click();
    await expect(page).toHaveURL(/\/$/);
    // The property is "no visible replay". The original expectation was
    // toEqual(["none"]), which assumed the overlay is re-rendered on every client
    // navigation and merely hidden — leaving the result dependent on whether the
    // previous unmount's cleanup had written data-home-intro-state before React
    // inserted the new node, which raced and failed roughly one run in eight.
    // The overlay is now simply not rendered again after its first mount in a
    // document, so the honest assertion is that nothing visible appeared: every
    // newly observed overlay, if any, computed to "none".
    const newDisplays = await page.evaluate(
      (start) => (window as typeof window & { __deltaIntroDisplays?: string[] }).__deltaIntroDisplays?.slice(start) ?? [],
      displayCount,
    );
    expect(newDisplays.filter((display) => display !== "none"), "the intro replayed visibly after client navigation").toEqual([]);
    await expect(page.locator("[data-home-intro]"), "an intro overlay is visible after returning home").toBeHidden();
  }
});

test("home intro preserves its aspect ratio at the desktop breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");

  const ratio = await page.locator(".home-intro-mark").evaluate(async (logo) => {
    const animation = logo.getAnimations().find((candidate) => candidate instanceof CSSAnimation && candidate.animationName === "home-intro-mark-arrive");
    if (!animation) throw new Error("Expected home intro animation is missing");
    animation.pause();
    animation.currentTime = animation.effect!.getTiming().delay ?? 0;
    await new Promise(requestAnimationFrame);
    const bounds = logo.getBoundingClientRect();
    return bounds.width / bounds.height;
  });

  expect(ratio).toBeCloseTo(293.3828430175781 / 73.00000762939453, 3);
});

test("home intro does not replay after client-side navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 940 });
  await page.goto("/");
  await expect(page.locator("[data-home-intro]")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("delta-home-intro-seen"))).toBe("true");

  await page.getByRole("link", { name: "Explore the range" }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await page.evaluate(() => {
    const probe = { animationNames: [] as string[], visible: false };
    (window as typeof window & { __deltaClientIntroProbe?: typeof probe }).__deltaClientIntroProbe = probe;
    new MutationObserver(() => {
      const intro = document.querySelector("[data-home-intro]");
      if (!intro) return;
      probe.visible ||= getComputedStyle(intro).display !== "none" && Number.parseFloat(getComputedStyle(intro).opacity) > 0;
      probe.animationNames.push(...intro.getAnimations({ subtree: true }).filter((animation) => animation instanceof CSSAnimation).map((animation) => animation.animationName));
    }).observe(document.body, { childList: true, subtree: true });
  });

  await page.getByRole("link", { name: "Delta Gym Wear home" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const probe = await page.evaluate(() => (window as typeof window & { __deltaClientIntroProbe?: { animationNames: string[]; visible: boolean } }).__deltaClientIntroProbe);
  expect(probe?.visible).toBe(false);
  expect(probe?.animationNames).toEqual([]);
  await expect(page.locator("[data-home-intro]")).toHaveCount(0);
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

test("mobile flow preserves the desktop intro for the same browser session", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  // The server now renders the honest flow state, so every assertion below is
  // satisfied by the raw HTML. Wait for the controller to attach before reading
  // it, or the test proves the markup shipped rather than that the client ran.
  await page.locator('[data-home-timeline][data-timeline-ready="true"]').waitFor();
  await expect(page.locator(".prototype-viewport")).toHaveCSS("position", "static");
  await expect(page.locator("[data-prototype-frame]")).toHaveCount(5);
  await expect(page.locator("[data-home-intro]")).toHaveCount(0);
  expect(await page.evaluate(() => window.sessionStorage.getItem("delta-home-intro-seen"))).toBeNull();

  await page.setViewportSize({ width: 768, height: 720 });
  await page.reload();
  await expect(page.locator("[data-home-intro]")).toHaveCount(0);
  expect(await page.evaluate(() => window.sessionStorage.getItem("delta-home-intro-seen"))).toBeNull();

  await page.setViewportSize({ width: 1440, height: 940 });
  await page.reload();
  await expect(page.locator("[data-home-intro]")).toBeVisible();
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

test("shopper places a Cash on Delivery order and cart clears", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("delta-home-intro-seen", "true"));
  await page.goto("/products/ease-fit-trouser");
  await page.getByRole("radio", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "ADD TO CART" }).click();
  await page.getByRole("link", { name: "Check out" }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await page.getByLabel("Full name").fill("Ali Khan");
  await page.getByLabel("Pakistani mobile number").fill("03001234567");
  await page.getByLabel("Address line 1").fill("House 12, Street 4");
  await page.getByLabel("City").fill("Lahore");
  await page.getByLabel("Province (optional)").fill("Punjab");
  await page.getByRole("button", { name: "Place COD order" }).click();

  await expect(page).toHaveURL(/\/orders\/[a-f0-9]{64}$/);
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
  await expect(page.getByText(/DGW-[A-F0-9]{8}/)).toBeVisible();
  await expect(page.getByText("Cash on Delivery", { exact: true })).toBeVisible();
  await expect(page.getByText("Pending confirmation", { exact: true })).toBeVisible();
  await expect(page.getByText("Ease Fit Trouser")).toBeVisible();
  await expect(page.getByText("Black / M x 1")).toBeVisible();
  await expect(page.getByText("Our team will confirm it by phone or WhatsApp before dispatch.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open cart, 0 items" })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("delta-cart:public"))).toBe("[]");
});

test("checkout reports COD validation errors accessibly", async ({ page }) => {
  await page.goto("/products/ease-fit-trouser");
  await page.getByRole("radio", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "ADD TO CART" }).click();
  await page.getByRole("link", { name: "Check out" }).click();

  await page.getByLabel("Full name").fill("A");
  await page.getByLabel("Pakistani mobile number").fill("+923001234567");
  await page.getByLabel("Address line 1").fill("Bad");
  await page.getByLabel("City").fill("Lahore");
  await page.getByRole("button", { name: "Place COD order" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Check the highlighted fields and try again." })).toBeVisible();
  await expect(page.getByText("Enter a Pakistani mobile number like 03XXXXXXXXX.")).toBeVisible();
  await expect(page.getByLabel("Pakistani mobile number")).toHaveAttribute("aria-invalid", "true");
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
  expect(await page.evaluate(() => window.sessionStorage.getItem("delta-home-intro-seen"))).toBeNull();
  await expect(page.locator(".prototype-viewport")).toHaveCSS("position", "static");
  const duration = await page.getByRole("link", { name: "Explore the range" }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
  await expect(page.locator(".landing-hero-poster")).toBeVisible();
  await expect(page.locator(".landing-hero-video")).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect(page.locator("[data-home-intro]")).toBeVisible();
});

test("home uses Figma-authored media without layout shift", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".landing-hero-poster")).toBeVisible();
  await expect(page.locator(".landing-hero-video")).toHaveAttribute("src", "/design-reference/assets/landing/hero-run.mp4");
});

test("home intro bootstrap does not trigger a hydration warning", async ({ page }) => {
  const hydrationWarnings: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (text.includes("hydrated but some attributes of the server rendered HTML didn't match")) {
      hydrationWarnings.push(text);
    }
  });

  await page.setViewportSize({ width: 1440, height: 940 });
  await page.addInitScript(() => window.sessionStorage.removeItem("delta-home-intro-seen"));
  await page.goto("/");
  await expect(page.locator("[data-home-intro]")).toBeVisible();
  expect(hydrationWarnings).toEqual([]);
});
