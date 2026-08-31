"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type RevealVariant = "editorial" | "cards" | "pdp-gallery" | "pdp-details";

export function Reveal({ children, variant, index = 0, className = "" }: { children: ReactNode; variant: RevealVariant; index?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setIsVisible(true);
      observer.disconnect();
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`motion-reveal motion-reveal--${variant} ${isVisible ? "is-visible" : ""} ${className}`} style={{ "--motion-index": index } as CSSProperties}>{children}</div>;
}
