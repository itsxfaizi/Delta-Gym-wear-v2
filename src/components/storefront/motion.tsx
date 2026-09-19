"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type RevealVariant = "editorial" | "cards" | "pdp-gallery" | "pdp-details";

/**
 * Marks an element as revealed once it first scrolls into view.
 *
 * Fails open by design: the revealed flag only ever *arms* a decorative offset. Reduced
 * motion short-circuits the observer and the resting state is restored in CSS, and with no
 * script at all the hidden state is never armed, so content is never trapped behind this.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setRevealed(true);
      observer.disconnect();
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed };
}

export function Reveal({ children, variant, index = 0, className = "" }: { children: ReactNode; variant: RevealVariant; index?: number; className?: string }) {
  const { ref, revealed } = useReveal<HTMLDivElement>();

  return <div ref={ref} className={`motion-reveal motion-reveal--${variant} ${revealed ? "is-visible" : ""} ${className}`} style={{ "--motion-index": index } as CSSProperties}>{children}</div>;
}
