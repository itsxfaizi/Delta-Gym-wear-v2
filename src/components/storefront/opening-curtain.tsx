import Image from "next/image";

import "@/features/landing/opening-curtain.css";

/** The amber "A" of the wordmark, lifted verbatim from delta-logo.svg (path 6, #FDB515).
 *  Not redrawn — this is the exact glyph, so scaling it up is the logo's own bolt growing,
 *  which is what the 2026-09-21 walkthrough shows at f004. */
const BOLT_PATH =
  "M246.569 36.9639L253.754 25.5076L253.776 25.5382L246.569 36.9639L253.776 25.5382L257.614 19.4469L261.456 13.3555L253.614 0.568909L225.936 45.9871H233.922L224.838 73L258.647 36.9639H246.569Z";

/**
 * States 1-3 of docs/opening-motion-spec.md: the black wordmark hold (66:6339) and the
 * full-bleed amber wipe (66:6450) that uncovers the hero (64:5965).
 *
 * The middle beat is now MEASURED rather than approximated. The designer's 2026-09-21
 * walkthrough (f002-f006) shows the wordmark settling, then its amber bolt glyph scaling up
 * until it swallows the frame, then the flat amber field lifting away. The bolt is the same
 * path as the logo's, positioned over where it already sits in the wordmark, so the growth
 * reads as continuous rather than as a second shape appearing.
 *
 * Since 2026-09-27 it also plays on every storefront route switch — see route-curtain.tsx,
 * which owns WHEN it plays. This component stays script-free and only renders the frame.
 *
 * Still deliberately a Server Component with no script of any kind. The whole sequence is CSS
 * animation, so it cannot delay hydration, cannot gate the hero, and cannot trap focus.
 * The overlay is inert (`aria-hidden` + `pointer-events: none`) and sits at z-index 90,
 * below the z-index 100 skip link, so a keyboard user who tabs during the curtain lands
 * on real hero content. Under `prefers-reduced-motion: reduce` it is `display: none`
 * from first paint, so reduced-motion users never see a flash.
 */
export function OpeningCurtain({ phase = "play", fromHold = false }: { phase?: "hold" | "play"; fromHold?: boolean }) {
  return (
    <div className="opening-curtain" data-opening-curtain data-phase={phase} data-from-hold={fromHold || undefined} aria-hidden="true">
      <div className="opening-curtain-field">
        <div className="opening-curtain-mark-wrap">
          <Image className="opening-curtain-mark" src="/design-reference/assets/delta-logo.svg" alt="" width={336} height={84} priority unoptimized />
          {/* viewBox is the bolt's own bounding box, so the SVG box and the glyph are the
              same rectangle and `transform-origin: center` is the centre of the bolt. */}
          <svg className="opening-curtain-bolt" viewBox="224.838 0 36.618 73" focusable="false">
            <path d={BOLT_PATH} fill="var(--color-accent)" />
          </svg>
        </div>
      </div>
      <div className="opening-curtain-wipe" />
    </div>
  );
}
