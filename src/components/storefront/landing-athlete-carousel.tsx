import Image from "next/image";
import type { CSSProperties } from "react";

export type AthleteImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  revealFrom?: string;
  revealIndex: number;
};

/**
 * States 5-6 (66:6469 / 72:7103) — the five-up staggered athlete rail.
 *
 * At desktop widths the five-up composition fits and landing-motion.tsx spreads it on scroll.
 * Below 64rem it is a swipe carousel: native horizontal scroll with scroll-snap, one card
 * centred with its neighbours peeking. The Previous/Next athlete buttons were removed on
 * 2026-09-27 at the owner's request; touch and trackpad swipe it, and the rail itself is
 * focusable so the arrow keys scroll it from the keyboard. It never auto-advances.
 */
export function LandingAthleteCarousel({ images, label }: { images: readonly AthleteImage[]; label: string }) {
  return (
    <div className="landing-athlete-carousel">
      <div className="landing-athlete-strip" role="group" aria-label={label} tabIndex={0}>
        {images.map((image) => (
          <Image
            key={image.src}
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(max-width: 63.99rem) 62vw, 24rem"
            data-reveal
            style={{ "--reveal-index": image.revealIndex, ...(image.revealFrom ? { "--reveal-from": image.revealFrom } : {}) } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
