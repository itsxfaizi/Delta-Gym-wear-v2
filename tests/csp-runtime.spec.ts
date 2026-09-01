import { expect, test, type Page } from "@playwright/test";

import { probe } from "./qa-http";

/**
 * CSP, both directions. "Zero violations" is satisfied perfectly by a policy that
 * blocks everything, because nothing then loads to violate anything. Every test
 * here therefore asserts the negative AND the positive together: no violation was
 * reported, and the page demonstrably did the things a working page does.
 *
 * The positive half is chosen so each assertion maps to one CSP directive:
 *
 *   style-src-elem  -> the app stylesheet applied (body colour and font family are
 *                      the app's, not the user-agent default)
 *   style-src-attr  -> the inline style="" attributes that carry the motion
 *                      system's CSS custom properties parsed into the CSSOM, and
 *                      `.prototype-frame { opacity: var(--frame-opacity, 0) }`
 *                      computed to 1. A blocked style attribute leaves the
 *                      attribute text in the HTML but an empty CSSStyleDeclaration
 *                      and the 0 fallback, i.e. an invisible hero.
 *   script-src      -> hydration completed: `data-timeline-ready="true"` is set by
 *                      a client effect, and the <video> element only exists after
 *                      that effect runs, so its presence is a second, independent
 *                      hydration proof.
 *   img-src         -> every <img> reports a non-zero naturalWidth.
 *   media-src       -> the hero video reached readyState >= HAVE_METADATA.
 *
 * SCOPE LIMIT: this is `next dev`. The development policy carries 'unsafe-eval'
 * and the HMR websocket; production does not, and this file cannot prove the
 * production policy renders the same page. `security-headers.spec.ts` carries the
 * production-policy check as a unit test of the header-building function.
 */

type Violation = { directive: string; blockedURI: string; sample: string };

declare global {
  interface Window {
    __qa3CspViolations?: Violation[];
  }
}

/** Console CSP text plus the DOM event, because the two do not always both fire. */
async function watchCsp(page: Page): Promise<{ consoleHits: string[]; events: () => Promise<Violation[]> }> {
  const consoleHits: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/content security policy|violates the following|refused to (?:load|execute|apply|connect)/i.test(text)) {
      consoleHits.push(`${message.type()}: ${text.slice(0, 300)}`);
    }
  });
  page.on("pageerror", (error) => {
    if (/content security policy/i.test(error.message)) consoleHits.push(`pageerror: ${error.message.slice(0, 300)}`);
  });

  await page.addInitScript(() => {
    window.__qa3CspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__qa3CspViolations?.push({
        directive: event.effectiveDirective || event.violatedDirective,
        blockedURI: event.blockedURI,
        sample: (event as SecurityPolicyViolationEvent).sample ?? "",
      });
    });
  });

  return { consoleHits, events: async () => (await page.evaluate(() => window.__qa3CspViolations)) ?? [] };
}

/**
 * Fails if the homepage reports any CSP violation, if hydration never completes,
 * if the app stylesheet is not applied, if the hero video element or its metadata
 * never arrives, if any image has a zero naturalWidth, or if the inline CSS custom
 * properties that drive the whole motion system do not reach the CSSOM. The last
 * of those is the one the contract calls the hardest CSP decision here: drop
 * `style-src 'unsafe-inline'` and `--frame-opacity` falls back to 0, which turns
 * the hero into a blank screen that a naive "no violations" test would still pass.
 */
test("the homepage renders completely under CSP, with zero violations", async ({ page }) => {
  const csp = await watchCsp(page);

  await page.goto("/");
  // Deterministic hydration gate: this attribute starts at "false" in the server
  // markup and is flipped by the timeline controller's effect.
  await page.locator('[data-home-timeline][data-timeline-ready="true"]').waitFor();

  const rendered = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const frame = document.querySelector(".prototype-frame--hero");
    const viewport = document.querySelector<HTMLElement>(".prototype-viewport");
    const images = [...document.querySelectorAll("img")];
    return {
      bodyColor: body.color,
      bodyFont: body.fontFamily,
      stylesheets: document.styleSheets.length,
      imageCount: images.length,
      brokenImages: images.filter((image) => image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
      videoCount: document.querySelectorAll("video").length,
      // Attribute text present but CSSOM empty == the style attribute was blocked.
      viewportAttrText: viewport?.getAttribute("style") ?? null,
      viewportCssomLength: viewport?.style.length ?? -1,
      timelineProgress: viewport?.style.getPropertyValue("--timeline-progress") ?? null,
      heroFrameOpacity: frame === null ? null : getComputedStyle(frame).opacity,
      // `.prototype-frame { position: absolute !important }` comes only from the
      // app stylesheet. Without it, "opacity: 1" below could be the element
      // default rather than proof that --frame-opacity resolved.
      heroFramePosition: frame === null ? null : getComputedStyle(frame).position,
      heroFrameAttrText: frame?.getAttribute("style") ?? null,
    };
  });

  const violations = await csp.events();
  expect(csp.consoleHits, "the browser logged a CSP violation").toEqual([]);
  expect(violations, "a securitypolicyviolation event fired").toEqual([]);

  // --- positive half: prove the page actually loaded ------------------------
  expect(rendered.stylesheets, "no stylesheet reached the CSSOM").toBeGreaterThan(0);
  expect(rendered.bodyColor, "body colour is the user-agent default - the app stylesheet did not apply").not.toBe(
    "rgb(0, 0, 0)",
  );
  expect(rendered.bodyFont, "the self-hosted next/font face is not applied").toContain("Outfit");

  expect(rendered.imageCount, "no images on the homepage - the img-src check would be vacuous").toBeGreaterThan(5);
  expect(rendered.brokenImages, "an image has naturalWidth 0 - it never decoded").toEqual([]);

  expect(rendered.videoCount, "the hero <video> is absent - it is client-rendered, so hydration did not run").toBe(1);
  await expect
    .poll(async () => page.evaluate(() => document.querySelector("video")?.readyState ?? -1), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(1);

  expect(rendered.viewportAttrText, "the timeline viewport has no style attribute - the fixture changed").not.toBeNull();
  expect(
    rendered.viewportCssomLength,
    `style attribute "${rendered.viewportAttrText}" is in the HTML but parsed to an empty CSSOM declaration - style-src-attr blocked it`,
  ).toBeGreaterThan(0);
  expect(rendered.timelineProgress, "--timeline-progress did not reach the CSSOM").not.toBe("");

  expect(rendered.heroFrameAttrText, "the hero frame has no style attribute - the fixture changed").toContain(
    "--frame-opacity",
  );
  expect(
    rendered.heroFramePosition,
    "the .prototype-frame stylesheet rule is not in effect, so the opacity check below would be meaningless",
  ).toBe("absolute");
  expect(
    rendered.heroFrameOpacity,
    "the hero frame computed to its 0 fallback: --frame-opacity did not apply, so the hero is invisible",
  ).toBe("1");

  // Anti-vacuity, asserted last so the diagnostics above are still readable: with
  // no enforced policy on the document, the zero-violation result proves nothing.
  const document_ = await probe("/");
  expect(
    document_.headers.get("content-security-policy"),
    "the homepage carries no enforced Content-Security-Policy, so 'zero violations' above is vacuous",
  ).not.toBeNull();
});

/**
 * The contract's measured facts are counted on a product page: 9 inline style
 * attributes and 32 <script> tags including a dangerouslySetInnerHTML JSON-LD
 * block. Fails if any of those is blocked - specifically if the JSON-LD script
 * never reaches the DOM (script-src too strict, or a nonce that does not match),
 * if the product images do not decode, or if any CSP violation is reported.
 */
test("a product page renders its inline scripts and inline styles under CSP", async ({ page }) => {
  const csp = await watchCsp(page);

  await page.goto("/products/ease-fit-trouser");
  await page.locator("h1").first().waitFor();

  const rendered = await page.evaluate(() => {
    const images = [...document.querySelectorAll("img")];
    const styled = [...document.querySelectorAll<HTMLElement>("[style]")];
    const jsonLd = [...document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')];
    let parsedJsonLd: string | null = null;
    try {
      parsedJsonLd = jsonLd[0] ? (JSON.parse(jsonLd[0].textContent ?? "{}")["@type"] ?? null) : null;
    } catch {
      parsedJsonLd = "unparseable";
    }
    return {
      scripts: document.querySelectorAll("script").length,
      jsonLdCount: jsonLd.length,
      jsonLdType: parsedJsonLd,
      styledCount: styled.length,
      // Every element carrying a style attribute must have parsed it.
      deadStyleAttributes: styled.filter((element) => element.style.length === 0).map((element) => element.getAttribute("style") ?? ""),
      imageCount: images.length,
      brokenImages: images.filter((image) => image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
      bodyFont: getComputedStyle(document.body).fontFamily,
    };
  });

  const violations = await csp.events();
  expect(csp.consoleHits, "the browser logged a CSP violation on the product page").toEqual([]);
  expect(violations, "a securitypolicyviolation event fired on the product page").toEqual([]);

  expect(rendered.scripts, "almost no <script> tags - the flight payload did not stream").toBeGreaterThan(10);
  expect(rendered.jsonLdCount, "the JSON-LD block is absent from the DOM").toBeGreaterThan(0);
  expect(rendered.jsonLdType, "the JSON-LD block did not parse as a typed object").not.toBeNull();
  expect(rendered.jsonLdType, "the JSON-LD block reached the DOM as unparseable text").not.toBe("unparseable");

  expect(rendered.styledCount, "no inline style attributes here - the style-src-attr check would be vacuous").toBeGreaterThan(5);
  expect(rendered.deadStyleAttributes, "an inline style attribute parsed to an empty declaration - style-src-attr blocked it").toEqual([]);

  expect(rendered.imageCount, "no product images to check").toBeGreaterThan(0);
  expect(rendered.brokenImages, "a product image has naturalWidth 0").toEqual([]);
  expect(rendered.bodyFont, "the self-hosted next/font face is not applied on the product page").toContain("Outfit");

  const document_ = await probe("/products/ease-fit-trouser");
  expect(
    document_.headers.get("content-security-policy"),
    "the product page carries no enforced Content-Security-Policy, so 'zero violations' above is vacuous",
  ).not.toBeNull();
});

/**
 * The contract's nonce clause: "/_not-found is statically prerendered; a
 * per-request nonce baked into cached HTML is worse than no nonce."
 *
 * Skipped, visibly, when the policy uses no nonce - a skip is honest where a pass
 * would be vacuous. When a nonce IS used this fails if the same nonce is served
 * twice (a reused nonce authorises an injected script forever), or if the nonce in
 * the HTML does not match the nonce in that same response's header, which is
 * exactly what happens when a per-request header meets prerendered markup.
 */
test("if the CSP uses a nonce it is per-request and matches the served HTML", async () => {
  const nonceOf = (policy: string | null): string | null => /'nonce-([A-Za-z0-9+/=_-]+)'/.exec(policy ?? "")?.[1] ?? null;

  const home = await probe("/");
  test.skip(nonceOf(home.headers.get("content-security-policy")) === null, "the CSP uses no nonce");

  const mismatches: string[] = [];

  for (const route of ["/", "/products/ease-fit-trouser", "/zzz-definitely-not-a-route"]) {
    const attempts = [await probe(route), await probe(route)];
    const headerNonces = attempts.map((result) => nonceOf(result.headers.get("content-security-policy")));

    if (headerNonces.some((nonce) => nonce === null)) {
      mismatches.push(`${route}: a response carried no nonce while / does`);
      continue;
    }
    if (headerNonces[0] === headerNonces[1]) {
      mismatches.push(`${route}: two consecutive requests were served the same nonce (${headerNonces[0]})`);
    }

    attempts.forEach((result, index) => {
      const markupNonces = [...new Set([...result.body.matchAll(/\snonce="([^"]*)"/g)].map((match) => match[1]))];
      for (const markupNonce of markupNonces) {
        if (markupNonce !== headerNonces[index]) {
          mismatches.push(`${route} request ${index + 1}: markup nonce ${markupNonce} != header nonce ${headerNonces[index]}`);
        }
      }
    });
  }

  expect(mismatches, "the CSP nonce is reused or disagrees with the served markup").toEqual([]);
});
