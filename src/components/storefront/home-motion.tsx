/**
 * Named landing motion intents. The name is the whole contract: each intent is
 * defined exactly once, in globals.css, under [data-motion="<intent>"].
 *
 * Every intent animates transform and opacity only, rests at opacity 1 /
 * transform none, and takes its entry state from the frame's own
 * data-frame-state. Under prefers-reduced-motion every frame is permanently
 * settled, so the resting state is what renders, with no transition.
 *
 * Plain module, not a client component: the landing view is a server component
 * and only spreads the returned attributes.
 */
import type { CSSProperties } from "react";

export type HomeMotionIntent =
  | "heroEntrance"
  | "sectionReveal"
  | "athleteRailReveal"
  | "philosophyCardEnter"
  | "testsReveal"
  | "footerReveal";

/** Spreads one named intent, and its stagger slot, onto an element. */
export function homeMotion(intent: HomeMotionIntent, index = 0) {
  return { "data-motion": intent, style: { "--motion-index": index } as CSSProperties };
}
