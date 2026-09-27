"use client";

import { useEffect } from "react";

/**
 * Landing scroll choreography — scroll-linked GSAP ScrollTrigger effects, NO PINS, under a
 * LIGHT GSAP ScrollSmoother.
 *
 * Smooth scroll was removed on 2026-09-21 and brought back on 2026-09-27 at the client's
 * request, with the owner's explicit approval. Read the note in the effect below before
 * changing its strength.
 *
 * PROVENANCE: section order is from the 13 MCP exports. The designer's walkthrough recording
 * (2026-09-21) PINNED the engineered fan and the philosophy hold. Both pins were removed on
 * 2026-09-27 after the owner's own review recording: pinned sections stop the page under the
 * user's hand and read as stuck, then loose. Every effect here now tracks the scroll 1:1.
 * Durations are scroll DISTANCES, not seconds, so design.md's 180-280ms entry budget does
 * not apply to them — it still governs the discrete enter/exit transitions in CSS.
 *
 * The three-tests word roll is not scroll-driven either: it keeps its timed autoplay (owner
 * decision, "this section was previously fine"). See the State 8 note below.
 *
 * FAILS OPEN, exactly like the existing useReveal primitive. Every collapsed start state is the
 * `from` half of a `fromTo` created here, never a rule in the stylesheet, so with no script, a
 * failed chunk, or `prefers-reduced-motion: reduce` the page paints its resting composition and
 * scrolls natively. Nothing here gates content, focus or interaction.
 */
export function LandingMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let dispose = () => {};
    let cancelled = false;

    // Dynamic import keeps GSAP out of the hero's critical path — the LCP is the hero
    // poster, and none of this can run before first paint anyway.
    void (async () => {
      const [{ gsap }, { ScrollTrigger }, { ScrollSmoother }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("gsap/ScrollSmoother"),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

      // ---- SMOOTH SCROLL: light, desktop pointer only ---------------------------------
      // History: Lenis was added on 2026-09-21 and removed the same day ("the whole app
      // scrolls too slow, it is not smooth"; `duration: 1.1` and `lerp: 0.12` both rejected).
      // Any smoother puts the page slightly behind the finger, and on macOS the native curve
      // already has momentum, so a heavy setting reads as lag.
      //
      // 2026-09-27: the client asked for GSAP smooth scroll and the owner approved a LIGHT
      // one. ScrollSmoother (not Lenis) because ScrollTrigger then reads the smoothed
      // position natively, so the pins and scrubs below stay in lockstep with what is on
      // screen. `smooth: 0.6` is deliberately below GSAP's 0.8 default. Touch devices and
      // narrow viewports keep native scrolling; reduced motion never gets here at all.
      // Created BEFORE any ScrollTrigger, as ScrollSmoother requires.
      const wrapper = document.querySelector<HTMLElement>("[data-smooth-wrapper]");
      const content = document.querySelector<HTMLElement>("[data-smooth-content]");
      const smoother = wrapper && content && window.matchMedia("(min-width: 64rem) and (pointer: fine)").matches
        ? ScrollSmoother.create({ wrapper, content, smooth: 0.6, effects: false })
        : null;

      // The content now scrolls by transform, so a browser hash jump (/#philosophy,
      // /#contact) no longer moves anything. Route same-page hash links through the smoother.
      const onHashLink = (event: MouseEvent) => {
        if (!smoother || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
        const link = (event.target as Element | null)?.closest?.("a[href*='#']");
        if (!(link instanceof HTMLAnchorElement)) return;
        const url = new URL(link.href, window.location.href);
        if (url.pathname !== window.location.pathname || !url.hash) return;
        const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (!target) return;
        event.preventDefault();
        history.pushState(null, "", url.hash);
        smoother.scrollTo(target, true, "top top");
      };
      document.addEventListener("click", onHashLink);

      const ctx = gsap.context(() => {
        const desktop = window.matchMedia("(min-width: 64rem)").matches;

        // ---- States 5-6: engineered — unpinned, scroll-linked spread ----------------
        // REWORKED 2026-09-27 after the owner's review recording ("it feels so fake"). The
        // walkthrough version PINNED this section and fanned five cards out from half size
        // behind the centre card, with the heading zooming in from 0.85. Two problems:
        // the page stopped following the hand while it played (scroll-jacking), and cards
        // emerging out of one another is not something real objects do, so it read as a
        // slideshow effect. It also meant scrolling into an empty black screen, because the
        // heading stayed at opacity 0 until the pin engaged.
        //
        // Now: no pin, so the page always moves 1:1 with the scroll. The client's
        // "expanding leftward and rightward" is kept, but as a gentle spread: every card is
        // visible from the start, 30% of the way in toward the centre and slightly smaller,
        // and settles into its resting slot as the rail travels up the viewport. The heading
        // and body use the ordinary CSS reveal like every other section.
        const strip = document.querySelector<HTMLElement>(".landing-athlete-strip");

        if (desktop && strip) {
          // The rail is a native scroll container at rest. While the spread is driving
          // transforms it must not also scroll, or it generates its own overflow.
          strip.dataset.fan = "true";

          const cards = Array.from(strip.children) as HTMLElement[];
          const stripBox = strip.getBoundingClientRect();
          const stripCentre = stripBox.left + stripBox.width / 2;
          const middle = (cards.length - 1) / 2;

          const timeline = gsap.timeline({
            scrollTrigger: { trigger: strip, start: "top 95%", end: "center 55%", scrub: true },
          });

          cards.forEach((card, index) => {
            const box = card.getBoundingClientRect();
            const distance = Math.abs(index - middle);
            // Pulled inward they overlap slightly, so the centre sits on top and each
            // outward pair one level behind.
            gsap.set(card, { zIndex: cards.length - distance });
            // fromTo, never from: a bare `.from()` re-records its end values on every
            // ScrollTrigger.refresh(), and can freeze on its start state.
            timeline.fromTo(
              card,
              { x: (stripCentre - (box.left + box.width / 2)) * 0.3, scale: 0.94 },
              { x: 0, scale: 1, ease: "power2.out" },
              0,
            );
          });
        }

        // ---- Section 2 button reveal (client request 2026-09-27) --------------------
        // Each CTA rises out of its own clipping mask (.landing-cta-mask) as the pair
        // scrolls into view. Transform only; played once, not scrubbed.
        const ctas = document.querySelectorAll<HTMLElement>(".landing-cta-mask > .landing-cta");
        if (ctas.length) {
          gsap.fromTo(ctas, { yPercent: 110 }, {
            yPercent: 0, duration: 0.6, stagger: 0.1, ease: "power3.out",
            scrollTrigger: { trigger: ".landing-cta-pair", start: "top 92%", once: true },
          });
        }

        // ---- State 7: philosophy — unpinned, gentle stack parallax -------------------
        // The walkthrough held this section PINNED for half a viewport. Removed 2026-09-27
        // after the owner's review recording: only a 40px drift played during that hold, so
        // it read as the page getting stuck and then snapping loose. The orbit is the
        // infinite CSS animation in philosophy-stack.css; the only scroll effect left is a
        // parallax across the section's whole pass through the viewport.
        const philosophy = document.querySelector<HTMLElement>('[data-landing-scene="philosophy"]');
        if (desktop && philosophy) {
          // The WHOLE stack drifts, never a card: a GSAP transform on a card replaces its
          // depth tilt/offset from philosophy-stack.css, so after a click-to-swap the back
          // card sat untilted exactly behind the front one and the stack read as one photo.
          gsap.fromTo(philosophy.querySelector(".philosophy-stack"), { y: 40 }, {
            y: -40,
            ease: "none",
            scrollTrigger: { trigger: philosophy, start: "top bottom", end: "bottom top", scrub: true },
          });
        }

        // ---- State 8: three tests — DELIBERATELY NOT TOUCHED ----------------------
        // REVERTED 2026-09-21, same day it was added, on the owner's instruction: "this
        // section was previously fine". It keeps the timed autoplay described in
        // landing-tests.css — 2s per statement, 300ms roll, with its WCAG 2.2.2 pause control.
        //
        // The walkthrough recording does scroll-scrub this section, so matching the video
        // exactly would mean pinning it. That is knowingly not done. The scrubbed version was
        // built, worked, and was rejected: pinning it added ~1100px of scroll distance and
        // put a third pin back-to-back with the other two, and the section already reads
        // correctly on its own clock. If it is ever wanted back, the handover is one line
        // (`window_.dataset.scrub = "true"`) plus a hold/roll timeline — landing-tests.css
        // still carries the `[data-scrub]` rules that switch the CSS animation off.
      });

      // Pins change document height; recalculate once images and fonts have settled or the
      // trigger ends are measured against a shorter page than the user actually scrolls.
      void document.fonts?.ready.then(() => {
        ScrollTrigger.refresh();
        // Arriving on /#contact etc. from another page: jump once layout has settled.
        const initial = window.location.hash && document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
        if (smoother && initial) smoother.scrollTo(initial, false, "top top");
      });

      dispose = () => {
        document.removeEventListener("click", onHashLink);
        smoother?.kill();
        ctx.revert();
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      };
    })();

    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  return null;
}
