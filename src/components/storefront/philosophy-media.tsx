"use client";

import Image from "next/image";
import { useState } from "react";

const PHOTOS = [
  { src: "/design-reference/assets/landing/philosophy-athlete.png", alt: "Athlete standing in a dark training studio" },
  { src: "/design-reference/assets/landing/engineered-bodybuilder.png", alt: "Athlete pressing a dumbbell in a training studio" },
] as const;

const SLOTS = ["landing-philosophy-secondary", "landing-philosophy-primary"] as const;

/** Both photographs render in both slots; clicking crossfades which one leads. */
export function PhilosophyMedia() {
  const [swapped, setSwapped] = useState(false);
  const leadIndex = swapped ? 1 : 0;

  return (
    <button type="button" className="philosophy-swap" onClick={() => setSwapped((current) => !current)} aria-pressed={swapped} aria-label="Swap the featured photograph">
      {SLOTS.map((slot, slotIndex) => {
        const isFront = slotIndex === SLOTS.length - 1;

        return (
          <span key={slot} className={slot}>
            {PHOTOS.map((photo, photoIndex) => {
              const isVisible = isFront ? photoIndex === leadIndex : photoIndex !== leadIndex;

              return (
                <Image
                  key={photo.src}
                  src={photo.src}
                  alt={isFront && isVisible ? photo.alt : ""}
                  width={842}
                  height={1263}
                  sizes="(max-width: 63.99rem) 86vw, 38vw"
                  data-visible={isVisible}
                />
              );
            })}
          </span>
        );
      })}
    </button>
  );
}
