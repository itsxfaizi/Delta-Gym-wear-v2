import Image from "next/image";

/**
 * States 1-3 of docs/opening-motion-spec.md: the black wordmark hold (66:6339) and the
 * full-bleed amber wipe (66:6450) that uncovers the hero (64:5965).
 *
 * Deliberately a Server Component with no script of any kind. The whole sequence is CSS
 * animation, so it cannot delay hydration, cannot gate the hero, and cannot trap focus.
 * The overlay is inert (`aria-hidden` + `pointer-events: none`) and sits at z-index 90,
 * below the z-index 100 skip link, so a keyboard user who tabs during the curtain lands
 * on real hero content. Under `prefers-reduced-motion: reduce` it is `display: none`
 * from first paint, so reduced-motion users never see a flash.
 *
 * No timing in the stylesheet is a Figma value; see the spec's honesty statement.
 */
export function OpeningCurtain() {
  return (
    <div className="opening-curtain" data-opening-curtain aria-hidden="true">
      <div className="opening-curtain-field">
        <Image className="opening-curtain-mark" src="/design-reference/assets/delta-logo.svg" alt="" width={336} height={84} priority unoptimized />
      </div>
      <div className="opening-curtain-wipe" />
    </div>
  );
}
