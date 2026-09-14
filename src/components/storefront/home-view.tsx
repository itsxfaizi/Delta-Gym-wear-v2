import Image from "next/image";
import Link from "next/link";

import { PhilosophyMedia } from "./philosophy-media";

import type { CatalogProduct } from "@/features/catalog/types";

import { StorefrontFooter } from "./storefront-footer";
import { HomeScene, HomeSceneController } from "./home-scene";
import { LandingHeroMedia } from "./landing-hero-media";

const ENGINEERED_IMAGES = [
  { src: "/design-reference/assets/landing/engineered-gym-man.png", alt: "Athlete standing in a gym", width: 900, height: 1478 },
  { src: "/design-reference/assets/landing/engineered-night-runner.png", alt: "Runner moving through a night street", width: 900, height: 1350 },
  { src: "/design-reference/assets/landing/engineered-bodybuilder.png", alt: "Athlete lifting a dumbbell", width: 247, height: 370 },
  { src: "/design-reference/assets/landing/engineered-day-runner.png", alt: "Runner in training gear", width: 900, height: 1200 },
  { src: "/design-reference/assets/landing/engineered-skip-rope.png", alt: "Athlete training with a jump rope", width: 900, height: 1350 },
] as const;

export function HomeView({ products }: { products: readonly CatalogProduct[] }) {
  void products;

  return (
    <HomeSceneController>
      <HomeScene sceneId="hero" className="landing-hero" aria-labelledby="landing-title">
        <LandingHeroMedia />
        <div className="landing-hero-copy">
          <h1 id="landing-title">Built for those who <em>run</em> with intent</h1>
          <p>Built for the ones who show up when no one&apos;s watching.</p>
          <Link className="landing-cta" href="/shop">Explore the range</Link>
        </div>
      </HomeScene>

      <HomeScene sceneId="engineered" className="landing-engineered" aria-labelledby="engineered-title">
        <header>
          <h2 id="engineered-title">Engineered, not just stitched</h2>
          <p>We don&apos;t design for the mirror. We design for the mile you almost skipped, the last rep, the early mornings no one sees. Performance first — everything else follows.</p>
        </header>
        <div className="landing-athlete-strip" aria-label="Delta athletes in motion">
          {ENGINEERED_IMAGES.map((image) => <Image key={image.src} src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 63.99rem) 20vw, 16vw" />)}
        </div>
        <div className="landing-cta-pair">
          <Link className="landing-cta" href="/shop">Shop men</Link>
          <Link className="landing-cta" href="/shop">Shop women</Link>
        </div>
      </HomeScene>

      <HomeScene sceneId="philosophy" id="philosophy" className="landing-philosophy" aria-labelledby="philosophy-title">
        <div className="landing-philosophy-media">
          <div className="philosophy-orbits" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
          <PhilosophyMedia />
        </div>
        <div className="landing-philosophy-copy">
          <p>Product philosophy</p>
          <h2 id="philosophy-title">Function first <em>always</em>, excess removed</h2>
          <p>We don&apos;t design for the mirror. We design for the mile you almost skipped, the last rep, the early mornings no one sees. Performance first — everything else follows.</p>
        </div>
      </HomeScene>

      <HomeScene sceneId="tests" className="landing-tests" aria-labelledby="tests-title">
        <div>
          <h2 id="tests-title">Every product must pass three tests</h2>
          <p>If it fails any of these conditions, it does not ship. No exceptions. No compromises.</p>
          <p className="landing-tests-statement">Moves <em>without</em> restriction</p>
        </div>
      </HomeScene>

      <HomeScene sceneId="newsletter-footer" className="landing-newsletter-footer" aria-labelledby="newsletter-title">
        <section className="landing-newsletter">
          <p>Stay in the loop</p>
          <h2 id="newsletter-title">No fluff. Just drops.</h2>
          <p>New product launches, training content, and brand updates. That&apos;s it. We don&apos;t do noise.</p>
          <div className="landing-newsletter-static" role="group" aria-label="Newsletter signup unavailable at launch">
            <span>info@deltagymwear.com</span>
            <span aria-hidden="true">Subscribe</span>
          </div>
        </section>
        <StorefrontFooter compact />
      </HomeScene>
    </HomeSceneController>
  );
}
