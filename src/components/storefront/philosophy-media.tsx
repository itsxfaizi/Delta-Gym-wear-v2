"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { PhilosophyOrbit } from "@/features/landing/philosophy-orbit";
import "@/features/landing/philosophy-stack.css";

type StackPhoto = { readonly src: string; readonly alt: string; readonly width: number; readonly height: number };

/**
 * Ordered front-to-back. TWO entries, and the authoritative prototype recording
 * (design-reference/motion/figma-proto-recording-2026-09-15.mov, frame 390 edge scan)
 * CONFIRMS two cards, not three: one axis-aligned front card and one same-size card behind
 * it rotated +8deg clockwise and offset +57 CSS px in x. No third photo is invented here.
 * Adding one is appending an entry — the depth slot in philosophy-stack.css is computed
 * from the index, not hard-coded per photo.
 *
 * `engineered-bodybuilder.png`'s alt text is the one already authored for the same asset in
 * home-view.tsx, not a new description.
 */
const PHOTOS: readonly StackPhoto[] = [
  { src: "/design-reference/assets/landing/philosophy-athlete.png", alt: "Athlete standing in a dark training studio", width: 842, height: 1263 },
  { src: "/design-reference/assets/landing/engineered-bodybuilder.png", alt: "Athlete lifting a dumbbell", width: 247, height: 370 },
];

/**
 * The tilted photo stack in state 7 (127:3240). One photo is in front, the rest sit behind it
 * rotated; activating a card brings it to the front and sends the previous front card to the
 * back. OWNER-SPECIFIED interaction, KEPT: the prototype recording neither confirms nor
 * refutes it — the operator never clicks the stack (the cursor is parked on the cream to the
 * right of the cards for the whole 171-frame hold) and the cards are pixel-static throughout.
 * The recording does NOT show a different behaviour, so there is nothing to match instead.
 *
 * The swap is transform/opacity only. Reduced motion keeps the swap and drops the transition.
 *
 * The orbit ring and dot artwork is now BUILT (philosophy-orbit.tsx) as an owner-directed
 * reconstruction from that recording — two circle strokes and six dots, geometric primitives
 * that need no vector export. It is decorative: aria-hidden, unfocusable, no information.
 */
export function PhilosophyMedia() {
  const [frontIndex, setFrontIndex] = useState(0);
  // Empty on first paint, so the live region announces nothing until a user acts.
  const [announcement, setAnnouncement] = useState("");
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    setFrontIndex(index);
    setAnnouncement(`${PHOTOS[index]!.alt} is now at the front of the stack.`);
  }

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    cardRefs.current[(index + step + PHOTOS.length) % PHOTOS.length]?.focus();
  }

  return (
    <div className="philosophy-stack" role="group" aria-label="Philosophy photo stack">
      {PHOTOS.map((photo, index) => {
        const depth = (index - frontIndex + PHOTOS.length) % PHOTOS.length;
        const isFront = depth === 0;
        return (
          <button
            key={photo.src}
            ref={(node) => { cardRefs.current[index] = node; }}
            type="button"
            className="philosophy-stack-card"
            style={{ "--stack-depth": depth } as CSSProperties}
            aria-current={isFront}
            aria-label={isFront ? `${photo.alt}, at the front of the stack` : `Bring ${photo.alt} to the front of the stack`}
            onClick={() => select(index)}
            onKeyDown={(event) => moveFocus(event, index)}
          >
            <Image src={photo.src} alt="" width={photo.width} height={photo.height} sizes="(max-width: 63.99rem) 86vw, 38vw" />
          </button>
        );
      })}
      <PhilosophyOrbit />
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  );
}
