/**
 * Philosophy orbit artwork — two concentric rings + six dots (state 7, node 127:3240).
 *
 * OWNER-DIRECTED RECONSTRUCTION, 2026-09-15. docs/figma-audit.md records this artwork as a
 * missing vector export and forbids redrawing it. That rule protects real brand artwork (the
 * logo and icon exports). This is not brand artwork: it is two circle strokes and six filled
 * dots — geometric primitives, needing no vector export — and the owner explicitly asked for
 * it. Every number below is MEASURED from the authoritative prototype recording
 * design-reference/motion/figma-proto-recording-2026-09-15.mov (circle fit at frame 432,
 * t=7.200s; dot detection across frames 390–485), not inferred from a static export.
 *
 * Geometry (CSS px at 1440): shared centre on the photo stack's vertical centre line, outer
 * r=393, inner r=332 (ratio 0.845). Inner dots d=13, outer dots d=18. The viewBox below is
 * the 786 px outer diameter, so 1 viewBox unit = 1 measured CSS px.
 *
 * Layering: the WHOLE artwork sits behind the photo cards — rings and dots alike, so a dot
 * passing behind the stack is occluded by it and reappears on the other side. This is
 * OWNER-DIRECTED (2026-09-17, against node 244:1847). The recording had been read as showing
 * the dots on top; the owner says they always revolve behind the image, and the design is
 * the authority over a read of an H.264 decode. Rings and dots are therefore ONE group at
 * one depth, which also makes it impossible for the two to drift out of phase.
 *
 * Decorative only: aria-hidden, not focusable, carries no information.
 */

const OUTER_R = 393;
const INNER_R = 332;
const CENTRE = OUTER_R;

/**
 * MEASURED outer-ring dot angles at frame 395: -118.9deg, +23.3deg, +103.5deg (uneven —
 * gaps 142.2 / 80.2 / 137.6deg). The INNER ring's three angles were not recovered from the
 * recording, so rather than invent three new values the inner dots reuse this measured set.
 * Recorded as a gap; replace if the inner angles are ever measured.
 */
const DOT_ANGLES_DEG = [-118.9, 23.3, 103.5] as const;

function place(radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { cx: CENTRE + radius * Math.cos(radians), cy: CENTRE + radius * Math.sin(radians) };
}

export function PhilosophyOrbit() {
  return (
    <svg className="philosophy-orbit" viewBox="0 0 786 786" aria-hidden="true" focusable="false">
      <g className="philosophy-orbit-spin">
        <circle cx={CENTRE} cy={CENTRE} r={OUTER_R - 0.5} className="philosophy-orbit-ring" fill="none" />
        <circle cx={CENTRE} cy={CENTRE} r={INNER_R} className="philosophy-orbit-ring" fill="none" />
        {DOT_ANGLES_DEG.map((degrees) => {
          const outer = place(OUTER_R, degrees);
          const inner = place(INNER_R, degrees);
          return (
            <g key={degrees}>
              <circle {...outer} r={9} className="philosophy-orbit-dot philosophy-orbit-dot--outer" />
              <circle {...inner} r={6.5} className="philosophy-orbit-dot philosophy-orbit-dot--inner" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
