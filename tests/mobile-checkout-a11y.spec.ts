import { expect, test, type Page } from "@playwright/test";

/**
 * 320 and 375. Pass 1 measured the keyboard path at 1440 and the timeline's honest
 * `flow` state on mobile; this covers the two things a phone user hits that a
 * desktop walk never does — a page that scrolls sideways, and a form that cannot be
 * completed without a mouse.
 */

const MOBILE_WIDTHS = [320, 375] as const;
const ROUTES = ["/", "/shop", "/products/ease-fit-trouser", "/cart", "/checkout"] as const;

/** A cart in browser storage, so /checkout renders the form instead of the empty state. */
async function seedCart(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("delta-home-intro-seen", "true");
    window.localStorage.setItem(
      "delta-cart:public",
      JSON.stringify([{ productHandle: "ease-fit-trouser", variantId: "dev-ease-black-m", quantity: 1 }]),
    );
  });
}

/**
 * The browser's own horizontal-scroll condition, plus the widest offenders as
 * diagnostics. Deliberately NOT an assertion about any element's right edge: the
 * home marquee overflows its own clipping container by design, and a check on
 * element geometry would fail on that while missing a genuinely scrolling page.
 */
async function measureOverflow(page: Page) {
  return page.locator("body").evaluate(() => {
    const root = document.documentElement;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter((entry) => entry.box.width > 0 && Math.round(entry.box.right) > root.clientWidth + 1)
      .slice(0, 6)
      .map((entry) => `${entry.element.tagName.toLowerCase()}.${String(entry.element.className).split(" ")[0]}@${Math.round(entry.box.right)}`);
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, bodyScrollWidth: document.body.scrollWidth, offenders };
  });
}

for (const width of MOBILE_WIDTHS) {
  /**
   * Fails when any storefront route can be scrolled sideways at a phone width —
   * `documentElement.scrollWidth` exceeding `clientWidth` is the browser's own
   * definition of that, not a proxy for it. The first half proves the measurement
   * can fail at all: a 5000px element is injected, the same measurement has to
   * report overflow, and it is removed before the real reading is taken. Without
   * that, a measurement that always returned equal numbers would pass forever.
   */
  test(`no storefront route scrolls sideways at ${width}px`, async ({ page }) => {
    await seedCart(page);
    await page.setViewportSize({ width, height: 720 });
    // Steady-state layout. The entrance transforms (`.motion-reveal--pdp-details`
    // is `translateX(1.25rem)` until it is observed) push content past the right
    // edge WHILE they animate, so measuring with motion on reads the transition,
    // not the layout, and the reading depends on when the sample lands. Reduced
    // motion pins every reveal to `transform: none`, which is the layout a user
    // ends up with either way.
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/shop");
    await page.locator("body").evaluate((body) => {
      const probe = body.ownerDocument.createElement("div");
      probe.id = "qa-overflow-probe";
      probe.style.cssText = "width:5000px;height:4px";
      body.append(probe);
    });
    const injected = await measureOverflow(page);
    expect(
      injected.scrollWidth,
      "a 5000px element did not widen the document — the measurement below cannot detect overflow",
    ).toBeGreaterThan(injected.clientWidth);
    await page.locator("#qa-overflow-probe").evaluate((probe) => probe.remove());

    const findings: string[] = [];
    for (const route of ROUTES) {
      await page.goto(route);
      // The deck writes its layout on the client; read after it says it is ready.
      await page.locator("[data-timeline-ready], main, body").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const measured = await measureOverflow(page);
      if (measured.scrollWidth > measured.clientWidth) {
        findings.push(
          `${route}: scrollWidth ${measured.scrollWidth} > clientWidth ${measured.clientWidth}; widest: ${measured.offenders.join(", ")}`,
        );
      }
      if (measured.bodyScrollWidth > measured.clientWidth) {
        findings.push(`${route}: body scrollWidth ${measured.bodyScrollWidth} > ${measured.clientWidth}`);
      }
    }

    expect(findings, `the page scrolls horizontally at ${width}px`).toEqual([]);
  });

  /**
   * Fails if any checkout input loses its label association (a phone user relying on
   * a screen reader would hear an unnamed edit field), if the tab ring cannot reach
   * every input and the submit button in document order, if a server-side rejection
   * is not announced through a live region, or if the invalid field is not tied to
   * its own error text by `aria-describedby`.
   */
  test(`the checkout form is operable by keyboard at ${width}px`, async ({ page }) => {
    await seedCart(page);
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    // --- labels ------------------------------------------------------------
    const unnamed = await page.locator("form.checkout-layout input").evaluateAll((inputs) =>
      inputs
        .filter((input) => (input as HTMLInputElement).type !== "hidden")
        .filter((input) => {
          const element = input as HTMLInputElement;
          const label = Array.from(element.labels ?? []).map((node) => node.textContent ?? "").join(" ").trim();
          return label === "" && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby");
        })
        .map((input) => (input as HTMLInputElement).name),
    );
    expect(unnamed, "a checkout input has no accessible name").toEqual([]);

    const fieldNames = await page.locator("form.checkout-layout input").evaluateAll((inputs) =>
      inputs.filter((input) => (input as HTMLInputElement).type !== "hidden").map((input) => (input as HTMLInputElement).name),
    );
    expect(fieldNames, "the checkout form renders no visible inputs").not.toEqual([]);
    const fieldNamesSet = new Set(fieldNames);

    // --- tab ring ----------------------------------------------------------
    // Walked from a blurred document rather than from a focus() call: React
    // re-renders the form when the cart hydrates, and a focus set before that
    // commit is silently dropped, which would make the walk start from the shell
    // and read as a failure that is really a race.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const walked: string[] = [];
    for (let step = 0; step < 60; step += 1) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return null;
        return { name: element.getAttribute("name") ?? "", tag: element.tagName, text: (element.textContent ?? "").trim().slice(0, 30) };
      });
      if (stop === null) break;
      if (stop.name && fieldNamesSet.has(stop.name)) walked.push(stop.name);
      if (stop.tag === "BUTTON" && stop.text.includes("Place COD order")) {
        walked.push("submit");
        break;
      }
    }
    expect(walked, "tabbing did not reach every checkout field and the submit button in order").toEqual([
      ...fieldNames,
      "submit",
    ]);

    // --- a server-side rejection, reached and read by keyboard --------------
    // `fullName` is the one required field the browser cannot pre-validate: it has
    // no minlength, so a single character passes the native check and only the
    // server's `min(2)` rejects it. That is what makes this a round trip.
    await page.getByLabel("Full name").fill("A");
    await page.getByLabel("Pakistani mobile number").fill("03001234567");
    await page.getByLabel("Address line 1").fill("House 12, Street 4");
    await page.getByLabel("City").fill("Lahore");
    await page.getByRole("button", { name: "Place COD order" }).focus();
    await page.keyboard.press("Enter");

    const alert = page.getByRole("alert");
    await expect(alert.first(), "the rejection was not announced through a live region").toBeVisible();
    await expect(alert.first()).not.toHaveText("");

    const fullName = page.getByLabel("Full name");
    await expect(fullName, "the rejected field is not marked invalid").toHaveAttribute("aria-invalid", "true");
    const describedBy = await fullName.getAttribute("aria-describedby");
    expect(describedBy, "the rejected field points at no error description").not.toBeNull();
    const description = page.locator(`#${describedBy}`);
    await expect(description, "aria-describedby points at nothing on the page").toBeVisible();
    await expect(description, "the error description is empty").not.toHaveText("");

    // A form that blanks itself on every rejection is not operable on a phone.
    await expect(fullName, "the submitted value was wiped by the rejection").toHaveValue("A");
  });
}
