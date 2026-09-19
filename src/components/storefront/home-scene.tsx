"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { useReveal } from "./motion";

/**
 * A landing section in normal document flow. Per docs/opening-motion-spec.md the sequence
 * is scroll-*triggered*, never scroll-jacked: nothing is pinned, nothing is `inert`, and
 * every section is in the DOM and keyboard-reachable from first paint. `data-revealed`
 * only un-arms the decorative entry offsets declared in landing-sequence.css.
 */
export function HomeScene({ sceneId, children, className = "", ...props }: { sceneId: string; children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  const { ref, revealed } = useReveal<HTMLElement>();

  return (
    <section ref={ref} {...props} className={`landing-scene ${className}`} data-landing-scene={sceneId} data-revealed={revealed}>
      {children}
    </section>
  );
}
