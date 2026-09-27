# Public storefront motion pass

Status: partially superseded on 2026-08-30. The home-route generic reveal/parallax treatment was removed after the authoritative Figma Full motion export and its source assets became available. No motion dependency was added.

The supplied WhatsApp MP4 is visual art direction only. It supplies no authoritative Figma timing, easing, or keyframes, so no exact timing was inferred from it. The deferred Figma `Circles` motion remains untouched.

| Surface | Motion treatment | Stable fallback |
| --- | --- | --- |
| Home hero | Original Figma background video may play only after hydration when reduced motion is not requested; copy and source poster are always visible | The original Figma poster renders with no video or scroll-linked movement |
| Home editorial sections | Static source order and source images; no generic scroll reveals are applied | The same complete content is visible without script |
| Catalog/collections | Product grid uses the same capped grouped stagger; filter/search/sort do not animate layout | Full grid is visible without IntersectionObserver |
| PDP | Gallery scales from a near-resting crop; detail hierarchy enters separately with a short offset | Gallery and controls remain visible and usable immediately |
| Cart/navigation | Existing drawer transition is preserved; no scroll-linked header mutation was added because it did not improve hierarchy | Existing keyboard/focus/inert/scroll-lock behavior unchanged |

All choreography uses transform/opacity-adjacent transitions, no layout animation, and a `prefers-reduced-motion` path that disables parallax, stagger, and reveal transforms. Interaction controls remain immediate and all source imagery remains local and unchanged.

## Cinematic scene pass — 2026-08-30

Figma MCP motion context for `Full` (`142:4326`) identifies only one authored animated node: `Circles` (`142:4364`), rotating from -180° to 0° over 2 seconds with `easeOut`, looping. It exposes no authored scene-transition or scroll-timeline data for the rest of the landing page.

Desktop and tablet use a home-only native scroll-scrubbed timeline: a sticky stage maps natural document progress to source-ordered frame ranges. Wheel, trackpad, keyboard, scrollbar, and touch all use the same scroll position; no wheel interception or scroll snap is used. Source media and content are present before JavaScript.

Mobile and `prefers-reduced-motion` use ordinary document flow, no snap, no intercepted wheel/key navigation, no autoplay video, and stable final-state content. The exact `Circles` animation is still deferred because the source vector/resting asset is unavailable locally.

## Prototype authority and blocker — 2026-08-30

The home interaction follows the Figma prototype (`64:5965`, first-load logo `66:6339`), not the Full MP4. Browser playback confirms the logo, hero, engineered, and philosophy frames. The Circles vector and exact prototype handoff keyframes remain unavailable from the connector, so timing is explicitly approximate and no substitute vector is presented as authoritative.
## Prototype frame timeline (2026-08-30)

The public home now follows the browser-verified prototype sequence: first-session logo opening → hero → engineered → philosophy. Desktop/tablet use a sticky pinned viewport and measured scroll track; wheel and keyboard inputs advance one deterministic frame, while mobile and reduced-motion use normal document flow. No generic scene observer, scroll-snap, newsletter, footer scene, or decorative motion is used. The opening logo and frame handoffs use local source-backed assets. Exact Figma timing/keyframes remain unavailable because the exposed MCP wrappers resolve to an unknown underlying tool; this is a timing limitation only.

## Pinned scroll choreography restored — 2026-09-21

**This section reverses the two decisions recorded above.** Both reversals are owner-instructed
(2026-09-21) after the designer supplied the first authored motion artifact this project has had.

**New source of authority:** `design-reference/motion/designer-walkthrough-2026-09-21.mp4`
(31.4s, 720x464). It was analysed frame by frame at 2fps (63 frames). Until this file arrived,
`get_motion_context` had returned **no authored timeline for any landing node**, and every
timing in this repo was an `[APPROX]` proposal. The state ORDER was evidenced; the TRANSITIONS
were not. They now are.

### What the recording shows, and what is now built

| Beat | Recording | Implementation |
| --- | --- | --- |
| Opening | f002-f006: wordmark settles, its amber bolt glyph scales up and swallows the frame, amber field lifts | `opening-curtain.tsx` renders the exact `#FDB515` path from `delta-logo.svg` over its own position in the wordmark; `opening-bolt` scales it to 90x. Curtain is `overflow: clip` — mandatory, see the note in `landing-sequence.css`. |
| Engineered | f026-f033: pinned; heading scales in, then five images fan out from behind the centre one, outermost last | `landing-motion.tsx`, pinned `+=140%`, scrubbed `fromTo` per card with an index-based stagger. Collapsed offsets are computed per card at runtime, so the `clamp()` flex bases are untouched. |
| Engineered -> Philosophy | f033-f035: cream panel rides UP OVER the dark section, covering the amber CTAs | CSS only: `z-index: 2` + `margin-block-start: -18vh` on `.landing-philosophy`. |
| Philosophy | f035-f044: pinned; dots keep orbiting, front card parallaxes | Pinned `+=90%`; the orbit is the pre-existing infinite CSS animation, untouched. Parallax is `y: -40` scrubbed. |
| Three tests | f046-f055: pinned; only the display phrase rolls, in a masked line box, holding then swapping fast | **NOT IMPLEMENTED — deliberately.** Built, reviewed and reverted the same day: "this section was previously fine". Keeps the 2s-per-statement CSS autoplay and its WCAG 2.2.2 pause control. This is a knowing deviation from the recording. |

### Two implementation notes worth keeping

1. **`fromTo`, never `from`.** A bare `gsap.from()` re-records its end values from the element's
   current state on every `ScrollTrigger.refresh()`. Refresh fires on `document.fonts.ready`, by
   which time the element is already at its collapsed start — so the tween runs
   collapsed -> collapsed and the fan silently freezes on its first beat. This was hit and fixed
   during the build; do not "simplify" these back to `from()`.
2. **No ScrollTrigger `snap`.** Tried while the tests roll was still scrubbed. Snap reproduces
   the video's discrete word-swap steps, but does it by animating the page's own scroll position
   — measured at ~540px per step, which throws the reader half a viewport whenever they stop
   scrolling. Recorded here because the same trap applies to any future scrubbed step sequence.

3. **Pin lengths are shorter than the recording's dwell.**
   First pass matched the video literally: `+=140%` / `+=90%` / `+=120%` pins and a 1.1s Lenis
   duration. That took the page from 5490px to 8526px and was rejected as sluggish — the
   recording is a 31s guided walkthrough where the presenter lingers, and a reader scrolling at
   their own pace experiences that dwell as dead distance. Now `+=80%` / `+=50%`, page 6546px.

4. **No smooth-scroll library. Native scroll only.** Lenis was added and removed the same day
   after two review rounds (`duration: 1.1`, then `lerp: 0.12`; both rejected as laggy). A
   smooth-scroll library replaces the OS scroll curve with its own, and where the native curve
   already carries momentum the hand is calibrated to, the second easing reads as lag rather
   than smoothness. It also makes scrubbed timelines follow the smoothed position, so a fast
   flick outruns the animation. `scrub: true` on native scroll tracks exactly. **Do not
   reintroduce Lenis/Locomotive here without asking the owner first.**

5. **The fan never animates `opacity`.** First version faded the four outer cards in from 0,
   which was rejected as looking "fake when the images pop" — correctly, because nothing
   physical appears by fading. They are now parked at scale 0.5 dead centre, full opacity,
   behind the centre card via z-index (`3,4,5,4,3`), and slide out from behind it. The centre
   card's footprint (~352x578 at 1440) fully contains an outer card at 0.5 (~88x145), so the
   occlusion is real.

### Dependencies

`gsap` was added. `lenis` was added and then removed the same day (see note 4). `motion@13` was removed: it had been in `package.json` since an
earlier pass and was imported nowhere. The stance recorded above as "no motion dependency was
added" no longer holds and is superseded by this section.

### Degradation — unchanged guarantees

`prefers-reduced-motion: reduce` returns before GSAP or Lenis are even imported. **Verified in
browser:** 0 pin spacers, no `lenis` class on `<html>`, curtain `display: none`, every athlete
card at identity transform, and document height 5490px vs 8526px animated — i.e. ordinary
document flow at the resting composition. Below 64rem nothing pins either; the athlete rail stays
the native scroll-snap carousel with its prev/next controls. No content, control or copy is
exclusive to a motion state.

The WCAG 2.2.2 pause control on the tests roll is **removed while scrubbed**, because scrubbed
motion only moves when the user scrolls it. It returns automatically wherever the CSS autoplay
still runs (no JS, or the roll never handed over).
