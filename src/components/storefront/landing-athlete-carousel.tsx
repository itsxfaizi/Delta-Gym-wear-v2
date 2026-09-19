"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export type AthleteImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  revealFrom?: string;
  revealIndex: number;
};

/**
 * States 5-6 (66:6469 / 72:7103) — the five-up staggered athlete rail, as a carousel.
 *
 * PROVENANCE: OWNER-SPECIFIED interaction. Figma MCP is quota-blocked and
 * `get_motion_context` returned no authored timelines for `72:7103`; the export shows the
 * resting five-up composition only. See the 2026-09-15 entry in docs/figma-audit.md.
 *
 * The staggered heights/offsets are the *design* and are kept at every width and under
 * reduced motion. Scrolling is native: CSS scroll-snap plus `scrollBy`, so touch, trackpad
 * and the browser's own arrow-key scrolling on the focused region all keep working, and
 * `prefers-reduced-motion` swaps `scroll-behavior: smooth` for `auto` in CSS (the default
 * `behavior: "auto"` on `scrollBy` defers to that computed value). It never auto-advances.
 */
export function LandingAthleteCarousel({ images, label }: { images: readonly AthleteImage[]; label: string }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const max = strip.scrollWidth - strip.clientWidth;
    setOverflowing(max > 1);
    setAtStart(strip.scrollLeft <= 1);
    setAtEnd(strip.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [sync]);

  // Scroll to the next/previous item edge rather than a guessed pixel step, so one press
  // always moves exactly one image whatever the staggered widths are.
  const step = (direction: 1 | -1) => {
    const strip = stripRef.current;
    if (!strip) return;
    const edge = strip.getBoundingClientRect().left;
    const items = Array.from(strip.children);
    const target = direction === 1
      ? items.find((item) => item.getBoundingClientRect().left - edge > 1)
      : items.reverse().find((item) => item.getBoundingClientRect().left - edge < -1);
    strip.scrollBy({ left: target ? target.getBoundingClientRect().left - edge : direction * strip.clientWidth });
  };

  return (
    <div className="landing-athlete-carousel">
      <div
        ref={stripRef}
        id="landing-athlete-strip"
        className="landing-athlete-strip"
        role="group"
        aria-label={label}
        tabIndex={0}
        onScroll={sync}
        // The entry reveal offsets are transforms, so the scroll extent settles only once
        // they finish; re-measure then or the end control can be stuck disabled.
        onTransitionEnd={sync}
      >
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
      {/* Controls exist only when there is something to scroll — at 1440 the frame's five-up
          composition fits exactly, so the resting state matches 72:7103 with no dead chrome. */}
      {overflowing ? (
        <div className="landing-athlete-controls">
          {/* aria-disabled, not `disabled`: the ends stay focusable and discoverable, matching
              the repo's existing sold-out-option pattern. */}
          <button
            type="button"
            className="landing-strip-control"
            aria-disabled={atStart}
            aria-controls="landing-athlete-strip"
            onClick={() => { if (!atStart) step(-1); }}
          >
            Previous athlete
          </button>
          <button
            type="button"
            className="landing-strip-control"
            aria-disabled={atEnd}
            aria-controls="landing-athlete-strip"
            onClick={() => { if (!atEnd) step(1); }}
          >
            Next athlete
          </button>
        </div>
      ) : null}
    </div>
  );
}
