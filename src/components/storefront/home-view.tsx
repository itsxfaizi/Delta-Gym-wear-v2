import Link from "next/link";
import type { CSSProperties } from "react";

import "@/features/landing/landing-sequence.css";

import { HomeScene } from "./home-scene";
import { LandingAthleteCarousel } from "./landing-athlete-carousel";
import { LandingHeroMedia } from "./landing-hero-media";
import { LandingTestsStatement, TEST_STATEMENT_COUNT } from "./landing-tests-statement";
import { OpeningCurtain } from "./opening-curtain";
import { PhilosophyMedia } from "./philosophy-media";
import { StorefrontFooter } from "./storefront-footer";

/**
 * The five-up staggered rail from 72:7103, centre-out. `revealFrom` is the [APPROX] entry
 * offset from docs/opening-motion-spec.md; `revealIndex` orders the stagger so the centre
 * lands first and the outermost pair last. The staggered *layout* is design, not motion,
 * so it is kept under reduced motion — only the offsets are dropped.
 */
const ENGINEERED_IMAGES = [
  { src: "/design-reference/assets/landing/engineered-gym-man.png", alt: "Athlete standing in a gym", width: 900, height: 1478, revealFrom: "translateX(-48px)", revealIndex: 4 },
  { src: "/design-reference/assets/landing/engineered-night-runner.png", alt: "Runner moving through a night street", width: 900, height: 1350, revealFrom: "translateX(-24px)", revealIndex: 3 },
  { src: "/design-reference/assets/landing/engineered-bodybuilder.png", alt: "Athlete lifting a dumbbell", width: 247, height: 370, revealFrom: "scale(1.02)", revealIndex: 2 },
  { src: "/design-reference/assets/landing/engineered-day-runner.png", alt: "Runner in training gear", width: 900, height: 1200, revealFrom: "translateX(24px)", revealIndex: 3 },
  { src: "/design-reference/assets/landing/engineered-skip-rope.png", alt: "Athlete training with a jump rope", width: 900, height: 1350, revealFrom: "translateX(48px)", revealIndex: 4 },
] as const;

function reveal(index: number, from?: string): CSSProperties {
  return { "--reveal-index": index, ...(from ? { "--reveal-from": from } : {}) } as CSSProperties;
}

export function HomeView() {
  return (
    <>
      <OpeningCurtain />
      <main className="landing-page" aria-label="Delta landing">
        {/* State 3 — hero (64:5965). Server-rendered under the curtain, never gated by it.
            CONTENT GATE: the stats bar (4.8 Average Rating / 98% Reorder Rate / 5 Yr Trusted
            Track Record) is omitted — ratings and performance claims with no approved source. */}
        <HomeScene sceneId="hero" className="landing-hero" aria-labelledby="landing-title">
          <LandingHeroMedia />
          <div className="landing-hero-copy">
            <h1 id="landing-title" data-reveal style={reveal(0)}>Built for those who <em>run</em> with intent</h1>
            <p data-reveal style={reveal(1)}>Built for the ones who show up when no one&apos;s watching.</p>
            <Link className="landing-cta" href="/shop" data-reveal style={reveal(2)}>Explore the range</Link>
          </div>
        </HomeScene>

        {/* States 4-6 — the black hold is this section's leading space on the invert surface;
            states 5 and 6 are one section at two beats (single image, then the fan-out). */}
        <HomeScene sceneId="engineered" className="landing-engineered" aria-labelledby="engineered-title">
          <header>
            <h2 id="engineered-title" data-reveal style={reveal(0)}>Engineered, not just stitched</h2>
            <p data-reveal style={reveal(1)}>We don&apos;t design for the mirror. We design for the mile you almost skipped, the last rep, the early mornings no one sees. Performance first — everything else follows.</p>
          </header>
          {/* OWNER-SPECIFIED carousel behaviour (docs/figma-audit.md, 2026-09-15). The frame
              evidences the resting five-up composition only — it is kept, and scrolling is
              added on top of it. Never auto-advances. */}
          <LandingAthleteCarousel images={ENGINEERED_IMAGES} label="Delta athletes in motion" />
          {/* No approved gender-collection contract exists (docs/figma-audit.md), so both
              CTAs resolve to the approved catalog route rather than an invented one. */}
          <div className="landing-cta-pair">
            <Link className="landing-cta" href="/shop" data-reveal style={reveal(5)}>Shop men</Link>
            <Link className="landing-cta" href="/shop" data-reveal style={reveal(5)}>Shop women</Link>
          </div>
        </HomeScene>

        {/* State 7 — philosophy (127:3240). The orbit ring and dots are omitted: no vector export. */}
        <HomeScene sceneId="philosophy" id="philosophy" className="landing-philosophy" aria-labelledby="philosophy-title">
          <div className="landing-philosophy-media" data-reveal style={reveal(0, "translateY(20px)")}>
            <PhilosophyMedia />
          </div>
          <div className="landing-philosophy-copy">
            <p data-reveal style={reveal(1)}>Product philosophy</p>
            <h2 id="philosophy-title" data-reveal style={reveal(2)}>Function first <em>always</em>, excess removed</h2>
            <p data-reveal style={reveal(3)}>We don&apos;t design for the mirror. We design for the mile you almost skipped, the last rep, the early mornings no one sees. Performance first — everything else follows.</p>
          </div>
        </HomeScene>

        {/* State 8 — three tests (142:4702). The hard-clipped two-line window is MEASURED from
            the 2026-09-15 prototype recording; the ADVANCE is not. The recording scroll-scrubs
            the column inside a pinned section — the owner asked for it to run on its own, so it
            is a 2s-per-statement autoplay and the section is an ordinary one, not pinned and not
            three viewports tall. `--tests-count` sets the cycle length in landing-tests.css.
            The overlapping-square motif and concentric arcs now ship: get_design_context on
            244:1850 returns the square's exact geometry (150x149, r8, 1px #353535 inside,
            90% opacity, 135deg 10% gradient fill), so they are measured, not guessed. They
            sit on the pin because the recording shows them pixel-static while the column
            scrubs. Decorative only -> aria-hidden, no text, not in the a11y tree. */}
        <HomeScene
          sceneId="tests"
          className="landing-tests"
          aria-labelledby="tests-title"
          style={{ "--tests-count": TEST_STATEMENT_COUNT } as CSSProperties}
        >
          {/* Siblings of the copy block, not children of it: in Figma these sit in the SECTION,
              outside and around the copy, so they are positioned against the section too. */}
          <span className="landing-tests-arcs" aria-hidden="true" />
          <span className="landing-tests-motif landing-tests-motif--start" aria-hidden="true" />
          <span className="landing-tests-motif landing-tests-motif--end" aria-hidden="true" />
          <div className="landing-tests-frame">
            <h2 id="tests-title" data-reveal style={reveal(0)}>Every product must pass three tests</h2>
            <p data-reveal style={reveal(1)}>If it fails any of these conditions, it does not ship. No exceptions. No compromises.</p>
            <LandingTestsStatement style={reveal(2, "translateY(16px)")} />
          </div>
        </HomeScene>

        {/* State 9 — newsletter + footer (142:5060). CONTENT GATE: submission stays visual-only
            until an email integration is approved, so no dead control and no fabricated address. */}
        <HomeScene sceneId="newsletter-footer" className="landing-newsletter-footer" aria-labelledby="newsletter-title">
          <section className="landing-newsletter">
            <p data-reveal style={reveal(0)}>Stay in the loop</p>
            <h2 id="newsletter-title" data-reveal style={reveal(1)}>No fluff. Just drops.</h2>
            <p data-reveal style={reveal(2)}>New product launches, training content, and brand updates. That&apos;s it. We don&apos;t do noise.</p>
            <p className="landing-newsletter-pending" data-reveal style={reveal(3)}>Newsletter signup opens at launch.</p>
          </section>
          <StorefrontFooter compact />
        </HomeScene>
      </main>
    </>
  );
}
