import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import type { CatalogProduct } from "@/features/catalog/types";

import { StorefrontFooter } from "./storefront-footer";
import { HomeScene, HomeSceneController } from "./home-scene";
import { homeMotion } from "./home-motion";
import { LandingHeroMedia } from "./landing-hero-media";

/**
 * Rail photos with their recovered Figma crops. `w` is the painted image width as
 * a percentage of its 13:18 card, `y` the image's top edge as a percentage of the
 * card height - the two numbers that reproduce a Figma image fill, which plain
 * object-fit: cover cannot express because it fixes the zoom.
 *
 * Each pair was recovered by scanning zoom x vertical offset against the approved
 * export and keeping the minimum mean absolute difference (docs/figma-audit.md,
 * pass 3). night-runner keeps its cover-equivalent numbers: its search never left
 * a dark local minimum, so no crop is claimed for it.
 */
const ENGINEERED_IMAGES = [
  { src: "/design-reference/assets/landing/engineered-gym-man.png", alt: "Athlete standing in a gym", width: 900, height: 1478, crop: { w: "132.91%", y: "-28.85%" } },
  { src: "/design-reference/assets/landing/engineered-night-runner.png", alt: "Runner moving through a night street", width: 900, height: 1350, crop: { w: "100%", y: "-4.167%" } },
  { src: "/design-reference/assets/landing/engineered-bodybuilder.png", alt: "Athlete lifting a dumbbell", width: 247, height: 370, crop: { w: "119.84%", y: "-23.97%" } },
  { src: "/design-reference/assets/landing/engineered-day-runner.png", alt: "Runner in training gear", width: 900, height: 1200, crop: { w: "139.76%", y: "-18.60%" } },
  { src: "/design-reference/assets/landing/engineered-skip-rope.png", alt: "Athlete training with a jump rope", width: 900, height: 1350, crop: { w: "128.32%", y: "-38.29%" } },
] as const;

export function HomeView({ products }: { products: readonly CatalogProduct[] }) {
  void products;

  return (
    <HomeSceneController>
      <HomeScene sceneId="hero" className="landing-hero" aria-labelledby="landing-title">
        <LandingHeroMedia />
        <div className="landing-hero-copy" {...homeMotion("heroEntrance")}>
          <h1 id="landing-title">Built for those who <em>run</em> with intent</h1>
          <p>Built for the ones who show up when no one&apos;s watching.</p>
          <Link className="landing-cta" href="/shop">Explore the range</Link>
        </div>
        {/* Values are read from the approved Figma export. They are unverified
            commercial claims pending docs/figma-audit.md open decision 4. */}
        <dl className="landing-proof" {...homeMotion("heroEntrance", 1)}>
          <div><dt>4.8</dt><dd>Average Rating</dd></div>
          <div><dt>98%</dt><dd>Reorder Rate</dd></div>
          <div><dt>5 Yr</dt><dd>Trusted Track Record</dd></div>
        </dl>
      </HomeScene>

      <HomeScene sceneId="engineered" className="landing-engineered" aria-labelledby="engineered-title">
        <header {...homeMotion("sectionReveal")}>
          <h2 id="engineered-title">Engineered, not just stitched</h2>
          <p>We don&apos;t design for the mirror. We design for the mile you almost skipped, the last rep, the early mornings no one sees. Performance first — everything else follows.</p>
        </header>
        <div className="landing-athlete-strip" aria-label="Delta athletes in motion">
          {ENGINEERED_IMAGES.map((image, index) => {
            const { style, ...motion } = homeMotion("athleteRailReveal", index);
            return (
              <span key={image.src} {...motion} style={{ ...style, "--crop-w": image.crop.w, "--crop-y": image.crop.y } as CSSProperties}>
                <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 63.99rem) 28vw, 24vw" />
              </span>
            );
          })}
        </div>
        <div className="landing-cta-pair" {...homeMotion("sectionReveal", 1)}>
          <Link className="landing-cta" href="/shop">Shop men</Link>
          <Link className="landing-cta" href="/shop">Shop women</Link>
        </div>
      </HomeScene>

      <HomeScene sceneId="philosophy" id="philosophy" className="landing-philosophy" aria-labelledby="philosophy-title">
        <div className="landing-philosophy-media" {...homeMotion("philosophyCardEnter")}>
          <Image className="landing-philosophy-secondary" src="/design-reference/assets/landing/engineered-bodybuilder.png" alt="" width={247} height={370} sizes="(max-width: 63.99rem) 35vw, 24vw" />
          <Image className="landing-philosophy-primary" src="/design-reference/assets/landing/philosophy-athlete.png" alt="Athlete standing in a dark training studio" width={842} height={1263} sizes="(max-width: 63.99rem) 86vw, 38vw" />
        </div>
        <div className="landing-philosophy-copy" {...homeMotion("sectionReveal")}>
          <p>Product philosophy</p>
          <h2 id="philosophy-title">Function first <em>always</em>, excess removed</h2>
          <p>We don&apos;t design for the mirror. We design for the mile you almost skipped, the last rep, the early mornings no one sees. Performance first — everything else follows.</p>
        </div>
      </HomeScene>

      <HomeScene sceneId="tests" className="landing-tests" aria-labelledby="tests-title">
        <span className="landing-tests-blocks landing-tests-blocks--start" aria-hidden="true"><i /><i /><i /></span>
        <span className="landing-tests-blocks landing-tests-blocks--end" aria-hidden="true"><i /><i /><i /></span>
        <div {...homeMotion("testsReveal")}>
          <h2 id="tests-title">Every product must pass three tests</h2>
          <p>If it fails any of these conditions, it does not ship. No exceptions. No compromises.</p>
          {/* One continuous gradient across the whole block; the source paints no
              single word separately, so there is no <em> here. */}
          <p className="landing-tests-statement">Moves without restriction</p>
        </div>
      </HomeScene>

      <HomeScene sceneId="newsletter-footer" className="landing-newsletter-footer" aria-labelledby="newsletter-title">
        <section className="landing-newsletter" {...homeMotion("footerReveal")}>
          <p>Stay in the loop</p>
          <h2 id="newsletter-title">No fluff. Just drops.</h2>
          <p>New product launches, training content, and brand updates. That&apos;s it. We don&apos;t do noise.</p>
          <div className="landing-newsletter-static" role="group" aria-label="Newsletter signup unavailable at launch">
            <span>info@deltagymwear.com</span>
            <span aria-hidden="true">Subscribe</span>
          </div>
        </section>
        <StorefrontFooter {...homeMotion("footerReveal", 1)} />
      </HomeScene>
    </HomeSceneController>
  );
}
