"use client";

import { useState, type CSSProperties } from "react";

import "@/features/landing/landing-tests.css";

/**
 * State 8 (142:4702) — the gold display statements of the three tests.
 *
 * PROVENANCE: the statement text and the hard-clipped two-line window are measured from
 * design-reference/motion/figma-proto-recording-2026-09-15.mov, frames 510-803.
 *
 * THE ADVANCE MECHANISM IS OWNER-SPECIFIED, NOT MEASURED. The recording is scroll-scrubbed —
 * the column's position there is a pure function of scroll offset, with no timer anywhere.
 * The owner asked for it to run on its own, so this is a 2s-per-statement autoplay. That is a
 * deliberate departure from the prototype, recorded here so nobody later "fixes" it back.
 *
 * Its pause control stays out of the visual composition, but remains keyboard and screen-reader
 * accessible for WCAG 2.2.2. Reduced-motion users receive the static list.
 *
 * All three statements are always in the DOM as a list, in reading order, with no aria-live:
 * an auto-rotating region would announce over whatever the user is reading. Casing is
 * sentence case to match the other landing headings; CSS uppercases for display, as they do.
 *
 * NOTE FOR THE OWNER: this is the order specified for the rebuild, but the recording presents
 * them in the reverse order on screen (top to bottom: MOVES / PERFORMS / HOLDS). Flip this
 * array to match the prototype exactly.
 */
const TEST_STATEMENTS = [
  "Holds structure under stress",
  "Performs after repeated",
  "Moves without restriction",
] as const;

/** Read by landing-tests.css to size the column's travel. */
export const TEST_STATEMENT_COUNT = TEST_STATEMENTS.length;

export function LandingTestsStatement({ style }: { style?: CSSProperties }) {
  const [paused, setPaused] = useState(false);

  // The window and the roll MUST stay two elements: `background-clip: text` builds its clip
  // mask from the UNTRANSFORMED glyph positions of its descendants, so putting the gold ramp
  // on the same element whose children move leaves statement 1 painted at the window top
  // forever. The window clips; the roll carries the ramp AND the transform together.
  return (
    <div className="landing-tests-cycle" data-reveal style={style}>
      <div className="landing-tests-window" data-paused={paused}>
        <ul className="landing-tests-roll">
          {TEST_STATEMENTS.map((statement) => (
            <li key={statement} className="landing-tests-statement">{statement}</li>
          ))}
          {/* Seamless loop: the column ends on a copy of the first statement, so the reset
              to 0% lands on an identical frame. Decorative duplicate -> out of the a11y tree,
              and CSS hides it entirely wherever the roll is a plain static list. */}
          <li className="landing-tests-statement landing-tests-statement--clone" aria-hidden="true">
            {TEST_STATEMENTS[0]}
          </li>
        </ul>
      </div>
      <button
        type="button"
        className="motion-accessibility-toggle"
        onClick={() => setPaused((value) => !value)}
        aria-pressed={paused}
      >
        {paused ? "Play statement animation" : "Pause statement animation"}
      </button>
    </div>
  );
}
