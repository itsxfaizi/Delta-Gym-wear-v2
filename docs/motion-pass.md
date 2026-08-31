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
