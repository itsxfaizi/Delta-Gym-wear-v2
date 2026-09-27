import Link from "next/link";
import type { CSSProperties } from "react";

import "@/features/landing/landing-sequence.css";

import { LandingMotion } from "@/features/landing/landing-motion";

import { HomeScene } from "./home-scene";
import { LandingAthleteCarousel } from "./landing-athlete-carousel";
import { LandingHeroMedia } from "./landing-hero-media";
import { LandingTestsStatement, TEST_STATEMENT_COUNT } from "./landing-tests-statement";
import { PhilosophyMedia } from "./philosophy-media";
import { NewsletterForm } from "@/components/ui/newsletter-form";

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
      {/* The opening curtain now lives in the storefront shell (route-curtain.tsx) so it
          also plays on every page switch. */}
      {/* ScrollSmoother + GSAP ScrollTrigger pins for states 5-8. Renders nothing, bails entirely
          under prefers-reduced-motion, and every collapsed start state is set from JS, so
          the composition below is unchanged with no script. */}
      <LandingMotion />
      {/* ScrollSmoother's wrapper/content pair. Plain divs until landing-motion.tsx creates
          the smoother, so with no script the page scrolls natively and nothing changes. */}
      <div data-smooth-wrapper>
      <div data-smooth-content>
      <main className="landing-page" aria-label="Delta landing">
        {/* State 3 — hero (64:5965). Server-rendered under the curtain, never gated by it.
            CONTENT GATE: the mockup's glass stats bar showed 4.8 Average Rating / 98% Reorder
            Rate / 5 Yr Trusted Track Record. Those are unsourced claims for a pre-launch brand,
            so the glass panel ships (client request, 2026-09-27) carrying the three brand
            principles instead. */}
        <HomeScene sceneId="hero" className="landing-hero" aria-labelledby="landing-title">
          <LandingHeroMedia />
          <div className="landing-hero-copy">
            {/* Two fixed lines on wide screens (client mockup); spans wrap freely when narrow. */}
            <h1 id="landing-title" data-reveal style={reveal(0)}>
              <span>Built for those who</span> <span><em>train</em> with intent.</span>
            </h1>
            <p data-reveal style={reveal(1)}>Gymwear for the work you put in. For men and women who show up, put in the reps, and keep building.</p>
            {/* data-reveal sits on a wrapper, never on .landing-cta: its transition rule would
                otherwise replace the button's hover transition. */}
            <div data-reveal style={reveal(2)}><Link className="landing-cta" href="/shop">Explore Delta</Link></div>
          </div>
          <dl className="landing-proof" data-reveal style={reveal(3, "translateY(16px)")}>
            <div><dt>Fit</dt><dd>With purpose</dd></div>
            <div><dt>Freedom</dt><dd>To train</dd></div>
            <div><dt>Everyday</dt><dd>Commitment</dd></div>
          </dl>
        </HomeScene>

        {/* States 4-6 — the black hold is this section's leading space on the invert surface;
            states 5 and 6 are one section at two beats (single image, then the fan-out). */}
        <HomeScene sceneId="engineered" className="landing-engineered" aria-labelledby="engineered-title">
          <header>
            <h2 id="engineered-title" data-reveal style={reveal(0)}><span>Your training.</span> <span>Our starting point.</span></h2>
            <p data-reveal style={reveal(1)}>The stretch at the bottom of a squat. The reach of an overhead press. The focus before your next set. These moments shape how we approach gymwear, with purpose in the fit, the fabric, and every detail.</p>
          </header>
          {/* OWNER-SPECIFIED carousel behaviour (docs/figma-audit.md, 2026-09-15). The frame
              evidences the resting five-up composition only — it is kept, and scrolling is
              added on top of it. Never auto-advances. */}
          <LandingAthleteCarousel images={ENGINEERED_IMAGES} label="Delta athletes in motion" />
          {/* No approved gender-collection contract exists (docs/figma-audit.md), so both
              CTAs resolve to the approved catalog route rather than an invented one. */}
          {/* Each CTA sits in its own clipping mask so landing-motion.tsx can slide it up into
              view (the "button reveal" the client asked for) using transform only. */}
          <div className="landing-cta-pair">
            <span className="landing-cta-mask" data-reveal style={reveal(5)}><Link className="landing-cta" href="/shop">Shop men</Link></span>
            <span className="landing-cta-mask" data-reveal style={reveal(5)}><Link className="landing-cta" href="/shop">Shop women</Link></span>
          </div>
        </HomeScene>

        {/* State 7 — philosophy (127:3240). The orbit ring and dots are omitted: no vector export. */}
        <HomeScene sceneId="philosophy" id="philosophy" className="landing-philosophy" aria-labelledby="philosophy-title">
          <div className="landing-philosophy-media" data-reveal style={reveal(0, "translateY(20px)")}>
            <PhilosophyMedia />
          </div>
          <div className="landing-philosophy-copy">
            <p data-reveal style={reveal(1)}>The Delta approach</p>
            <h2 id="philosophy-title" data-reveal style={reveal(2)}><span>Purpose in</span> <span>every <em>detail.</em></span></h2>
            <p data-reveal style={reveal(3)}>What you wear should feel right from your warm-up to your final set. Our approach brings together considered fits, freedom of movement, and a clean, confident aesthetic. Gymwear you want to train in, and keep reaching for.</p>
            <p className="landing-philosophy-tagline" data-reveal style={reveal(4)}>Born in Pakistan. Built around the way you train.</p>
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
            <h2 id="tests-title" data-reveal style={reveal(0)}>Every detail has a job.</h2>
            <p data-reveal style={reveal(1)}>Three priorities guide our approach to every piece.</p>
            <LandingTestsStatement style={reveal(2, "translateY(16px)")} />
          </div>
        </HomeScene>

        {/* State 9 — newsletter + footer (142:5060). The form validates and then reports
            honestly that signup is not live yet: no provider is connected, nothing is stored. */}
        <HomeScene sceneId="newsletter-footer" className="landing-newsletter-footer" aria-labelledby="newsletter-title">
          <section className="landing-newsletter">
            <p data-reveal style={reveal(0)}>Delta is coming</p>
            <h2 id="newsletter-title" data-reveal style={reveal(1)}><span>Your next</span> <span>training essentials.</span></h2>
            <p data-reveal style={reveal(2)}>A new gymwear brand for Pakistan&rsquo;s training community. Follow the first collection, meet the pieces, and be part of what comes next.</p>
            <div className="landing-newsletter-form" data-reveal style={reveal(3)}>
              <NewsletterForm idPrefix="landing-newsletter" submitLabel="Keep me updated" />
            </div>
          </section>
          <StorefrontFooter compact />
        </HomeScene>
      </main>
      </div>
      </div>
    </>
  );
}
