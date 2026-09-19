# Delta — opening + scroll motion spec

**Created:** 2026-09-15. **Owner:** design systems / UI-UX. **Status:** implementation source of truth for the home route (`/`) opening sequence and scroll choreography.

**Authoritative source:** Figma file key `kfa2hxqQkoRYUc4sAPKVrs` ("Delta"), page `0:1`, via the MCP PNG exports in `design-reference/exports/mcp-2026-09-15/` (export date 2026-09-15). Each state below cites the real node ID encoded in its filename.

---

## Honesty statement — read before implementing

This is the part of the spec that is **not** negotiable to summarise away.

- **State order is source-evidenced.** Frames `66:6339 → 66:6450 → 64:5965 → 66:6253 → 66:6469 → 72:7103 → 127:3240 → 142:4702 → 142:5060` are a storyboard exported in order from the Figma file, and the four progressive `full-*` composition exports independently corroborate the same section order. Build against this order.
- **No timing or easing value in this document is Figma-authored.** `get_motion_context` returned **no authored timelines** for these nodes, and the Figma MCP server is quota-blocked for this window (per `AGENTS.md` "Figma MCP quota fallback" — do not retry it). Every duration, delay, easing curve, stagger, and distance below is marked **[APPROX]** and is an implementation proposal derived from `design.md`'s motion budget, not a source value.
- **Colour and geometry values are measured**, by sampling the PNG exports listed above. They are marked **[MEASURED]**. Where a measurement is scaled, the scale factor is stated and is itself an inference.
- The only previously recorded authored motion in this repo is the `Circles / Rotation` track (2000 ms, −180°→0°, easeOut, infinite) in `design-reference/manifest.md`. It is **not** part of this sequence and remains excluded — its asset is still invalid.

If a later session regains Figma MCP access, re-run `get_motion_context` on each node ID below and replace the **[APPROX]** column with source values. Until then, no PR, changelog, or comment may describe these timings as coming from Figma.

---

## Global motion contract

Applies to every state.

| Rule | Value |
| --- | --- |
| Animated properties | `opacity` and `transform` **only**. No `height`, `width`, `top`, `filter`, `background-position`, or layout-affecting property. |
| Control feedback budget | 120–200 ms (`--duration-control`, 160 ms) |
| Entry/exit budget | 180–280 ms (`--duration-panel`, 240 ms; `--duration-entry-long`, 280 ms) |
| Easing (entry) | `--ease-out` `cubic-bezier(0.22, 1, 0.36, 1)` |
| Easing (brand / opening curtain) | `--ease-brand` `cubic-bezier(0.16, 1, 0.3, 1)` |
| Holds | Holds are **delays**, not animations. No single animated segment exceeds 280 ms. |
| Total opening curtain | ≤ 1000 ms from first paint to hero interactive **[APPROX]** |
| Interaction | Motion never gates interaction. The hero (`64:5965`) is in the DOM, focusable, and keyboard-reachable from first paint; the curtain overlay is `aria-hidden="true"` + `pointer-events: none` and must sit **below** the skip link in stacking order. |
| Errors/status | No error, status, or live-region output may be hidden behind or delayed by any segment here. |
| Scroll-triggered states | Use `IntersectionObserver` with a resting-state-first class toggle (the existing `.motion-reveal` / `.is-visible` pattern in `src/styles/globals.css`). Content is fully present and readable with JS off or the observer never firing. |

### `prefers-reduced-motion: reduce` — global fallback

1. **The opening curtain (states 1–3) does not render at all.** The page paints directly at state 3 (hero). No logo overlay, no wipe, no fade.
2. **Scroll states 4–9 render at their resting state on first paint.** No translate, no scale, no staggered opacity. Every section is fully opaque and fully reachable immediately.
3. No content, control, or copy is exclusive to a motion state. Reduced motion loses decoration only.

---

## The sequence

Scale note for all pixel figures: the nine storyboard PNGs are 900 × 588. Read against the 1440-wide compositions (`full-c`, `full-d`), that implies a ×1.6 scale to a 1440 × 941 frame. **The ×1.6 factor is an inference**, not a stated export setting; treat derived px values as ±2 px.

### State 1 — Opening logo hold

- **Node:** `66:6339` · `design-reference/exports/mcp-2026-09-15/open-01-logo-66-6339.png`
- **On screen:** Full-bleed near-black field (`#131417` **[MEASURED]**). Centred DELTA wordmark: white letterforms with the amber bolt/triangle mark (`#FCB515` **[MEASURED]**) replacing the final A. Nothing else — no nav, no copy, no control.
- **Trigger:** Page load (first paint of `/`). First-visit and every visit alike unless the build agent proposes a session-scoped suppression, which is a product decision, not a design one — flag it, do not decide it.
- **Animated:** `opacity` 0 → 1 and `transform: scale(0.96) → scale(1)` on the wordmark only. The black field paints instantly; it is the page background, not an animation.
- **Duration / easing [APPROX]:** 240 ms `--ease-brand`, then a 360 ms hold (delay) before state 2.
- **Reduced motion:** Not rendered. Page paints at state 3.

### State 2 — Amber wipe

- **Node:** `66:6450` · `open-02-amber-wipe-66-6450.png`
- **On screen:** Full-bleed flat amber, sampled `#FCB515` at centre and both corners with no gradient **[MEASURED]**. No content whatsoever — this is a pure transition curtain, not a screen.
- **Trigger:** Automatic, on completion of state 1's hold. Not scroll, not input.
- **Animated:** An amber panel enters over the black field with `transform: translateY(100%) → translateY(0)` and covers it, then exits with `translateY(0) → translateY(-100%)` to reveal state 3. `opacity` stays 1 throughout; the wipe reads as a shutter, not a fade. Direction is an **[APPROX]** choice — the exports show only the covered state, not the wipe axis.
- **Duration / easing [APPROX]:** 280 ms in, 40 ms hold, 280 ms out; `--ease-brand` both directions.
- **Reduced motion:** Not rendered.
- **Accessibility note:** amber `#FCB515` against `#131417` is a decorative field with no text — no contrast obligation — but the panel must never cover a focused element. Because the hero is already focusable underneath, the curtain must be inert (`pointer-events: none`, `aria-hidden`), and a keyboard user who tabs during the curtain must see focus land on real hero content, not be trapped.

### State 3 — Hero (resting entry state of the page)

- **Node:** `64:5965` · `open-03-hero-64-5965.png`
- **On screen:** Full-bleed beach-runner photograph with a dark scrim; transparent header over it (SHOP / ABOUT / CONTACT US left, DELTA mark centre, search / favourite / bag right); `BUILT FOR THOSE WHO` / `RUN WITH INTENT` with `RUN` in amber; one line of supporting copy; a solid amber `EXPLORE THE RANGE` CTA; and a translucent bordered stats bar across the bottom.
- **Trigger:** Page load, revealed by state 2's exit. This is the page's true resting state.
- **Animated:** Hero copy block staggers in — `opacity` 0 → 1 with `transform: translateY(12px) → 0` **[APPROX]**, in order: headline, supporting line, CTA, stats bar. The hero media itself does not animate (it is already painted behind the curtain).
- **Duration / easing [APPROX]:** 220 ms per item, `--ease-out`, 60 ms stagger; first item starts as the amber panel begins its exit so the reveal feels continuous.
- **Reduced motion:** Full hero rendered statically on first paint, all four items at final position and opacity.
- **CONTENT GATE — do not implement as shown.** The stats bar reads `4.8 Average Rating`, `98% Reorder Rate`, `5 Yr Trusted Track Record`. These are ratings and commercial performance claims with no approved source. Per `AGENTS.md`, **omit the stats bar content**; do not substitute invented numbers, and do not reuse the Figma values as placeholder copy. Either drop the bar or ship it only once the owner supplies verified figures. This gap is recorded in `docs/figma-audit.md`.

### State 4 — Black hold

- **Node:** `66:6253` · `open-04-black-66-6253.png`
- **On screen:** Full-bleed near-black `#131417` **[MEASURED]**, no content. In the `full-a` composition this same field sits between the hero and the engineered section as a large empty invert band, so it is a compositional breath, not a loading state.
- **Trigger:** Scroll progress past the hero. No auto-advance.
- **Animated:** Nothing. This is a resting surface (`--color-surface-invert`) that the hero media scrolls off to reveal.
- **Duration / easing:** n/a — scroll-driven position only.
- **Reduced motion:** Identical. Nothing changes.
- **Note for build agents:** do not implement this as a scroll-jacked pause, a pinned section, or a timed hold. It is vertical space on the invert surface. Its exact height is not extractable from a 588 px-tall storyboard crop; use the `full-a` / `full-b` compositions for proportion and treat the value as an implementation decision.

### State 5 — "Engineered, not just stitched" (single image)

- **Node:** `66:6469` · `open-05-engineered-single-66-6469.png`
- **On screen:** Invert surface. Centred display heading `ENGINEERED, NOT JUST STITCHED` in white; two lines of muted centred body copy (`#BBBBBB` **[MEASURED]**); one centred portrait image (gym / dumbbell) with a small corner radius.
- **Trigger:** Scroll — section crosses roughly 60% of viewport height **[APPROX]**.
- **Animated:** Heading `opacity` 0 → 1 + `translateY(16px) → 0`; body copy same, +60 ms; centre image `opacity` 0 → 1 + `scale(1.02) → 1` **[APPROX]**.
- **Duration / easing [APPROX]:** 240 ms `--ease-out`, 60 ms stagger.
- **Reduced motion:** Static, fully opaque, no transform.

### State 6 — "Engineered" gallery fan-out

- **Node:** `72:7103` · `open-06-engineered-gallery-72-7103.png`
- **On screen:** The **same** heading, copy, and centre image as state 5, with four further images fanned outward — two left, two right — in a staggered five-up rail. Heights step down from the centre outward (centre tallest), verticals are offset so the row reads as a stagger rather than a grid. Below the rail: two amber CTAs, `SHOP MEN` and `SHOP WOMEN`.
- **Trigger:** Scroll, continuing from state 5. States 5 and 6 are **one section at two moments**, not two sections — the single image is the first beat, the fan-out is the second. Build it as one component.
- **Animated:** The four outer images enter from behind the centre image outward: `opacity` 0 → 1 with `transform: translateX(-48px | -24px | +24px | +48px) → 0` **[APPROX]**, mirrored left/right, outermost last. The two CTAs enter last with `opacity` + `translateY(12px) → 0`.
- **Duration / easing [APPROX]:** 240 ms per image, `--ease-out`, 70 ms stagger outward; CTA pair 200 ms after the final image.
- **Reduced motion:** All five images and both CTAs render in their final staggered rail positions on first paint. The staggered *layout* is design, not motion — keep it.
- **Accessibility:** `SHOP MEN` / `SHOP WOMEN` are links to real routes with visible focus; amber `#FCB515` on `#131417` with dark label text is the evidenced treatment — verify the label-on-amber contrast pairing at implementation.

### State 7 — Product philosophy (cream)

- **Node:** `127:3240` · `open-07-philosophy-127-3240.png`
- **On screen:** Full surface inversion to cream. Base `#F3F3F3` **[MEASURED]** with a warm wash toward the top-left and bottom-right corners, sampled `#F4EEE1` and `#F5EEDF` **[MEASURED]**. Left: two stacked photographs, each tilted a few degrees in opposite directions, the front one a full-body athlete in black-and-white. Behind and around them, a large thin concentric orbit arc with three small coloured dots on its path (sampled `#7A949E` slate-blue, `#825C61` muted red, and one near-surface light dot). Right: amber eyebrow `PRODUCT PHILOSOPHY` (`#E4C071`–`#FCB821` range **[MEASURED]**), display heading `FUNCTION FIRST ALWAYS, EXCESS REMOVED` with `ALWAYS` in amber, and three lines of body copy in `#555658` **[MEASURED]**, which matches the existing `--color-ink-soft`.
- **Trigger:** Scroll. The surface change from invert to cream is the section boundary itself — a background swap in normal document flow, **not** an animated colour transition (colour is not an allowed animated property here).
- **Animated:** Photo stack `opacity` 0 → 1 + `translateY(20px) → 0` **[APPROX]**; copy column staggers eyebrow → heading → body with `opacity` + `translateY(12px) → 0`.
- **Duration / easing [APPROX]:** 260 ms photo stack, 220 ms per copy item, 60 ms stagger, `--ease-out`.
- **Photo tilt:** the tilt is the **resting** state, a static `rotate()` on each card. Do not animate the rotation. Under reduced motion the tilt stays.
- **Reduced motion:** Static, fully opaque, tilt and stagger layout preserved.
- **SOURCE GAP:** the orbit ring + dot artwork has **no exact vector export**. Do not redraw it by hand and do not approximate it in CSS. Omit it and ship the section without it until the SVG is supplied. This is unchanged from the 2026-08-31 audit entry.

### State 8 — "Every product must pass three tests"

- **Node:** `142:4702` · `open-08-three-tests-142-4702.png`
- **On screen:** Back to the invert surface `#131417` **[MEASURED]**. Top-left and lower-right: a motif of two or three overlapping outlined squares with a soft amber inner glow (sampled `#423415` where the glow sits over invert — i.e. the accent at low alpha, not a solid fill). Top-right: very large, very faint concentric arcs. Heading `EVERY PRODUCT MUST PASS THREE TESTS` in white; one supporting line in `#BBBBBB`; then a large display line `MOVES WITHOUT RESTRICTION` filled with a **horizontal gradient running white → gold, left to right**.
- **Gradient [MEASURED]:** sampled across the glyph run at 50 px intervals (900 px export): `#FEFEFC`, `#FBF5E8`, `#F7EBD0`, `#F3E1B9`, `#EFD7A1`, `#EACC88`, `#E7C271`, `#E3B859`, `#DFAE42`. Ship as `linear-gradient(90deg, #FFFFFF 0%, #DFAE42 100%)` with `background-clip: text`. Endpoints are measured; the interpolation being a simple linear ramp is an inference (the samples are consistent with one).
- **Trigger:** Scroll.
- **Animated:** Heading and supporting line `opacity` + `translateY(16px) → 0`; display line the same, +80 ms. Decorative square motifs and arcs fade with `opacity` only — **no rotation, no continuous/ambient motion**. The gradient itself never animates.
- **Duration / easing [APPROX]:** 240 ms `--ease-out`, 60–80 ms stagger.
- **Reduced motion:** Static and fully opaque. The gold gradient is a static fill and stays.
- **Accessibility:** the display line is real text with a clipped gradient — it must remain selectable and in the accessible name tree, with a solid-colour fallback (`--color-accent` or white) where `background-clip: text` is unsupported. The lightest gradient end is white and the darkest sampled end `#DFAE42` on `#131417` clears AA for large text; verify at implementation size.
- **SOURCE GAP:** the overlapping-square motif and the concentric arc artwork have **no exact vector export**. Omit; do not recreate in CSS.

### State 9 — Newsletter + footer

- **Node:** `142:5060` · `open-09-footer-142-5060.png`
- **On screen:** Two stacked blocks. **Newsletter**, on the cream surface `#F3F3F3` **[MEASURED]**: amber eyebrow `STAY IN THE LOOP`, display heading `NO FLUFF. JUST DROPS.` in near-black `#060607`, one supporting line, and a single horizontal control — a dark `#131417` email field joined flush to a solid amber `#FCB515` `SUBSCRIBE` button, no radius. **Footer**, on the invert surface: the DELTA bolt mark, two lines of brand copy, phone / email / web lines, and three link columns (`SHOP`, `BRAND`, `SUPPORT`) with links in `#8F8F8F` **[MEASURED]**. Behind the lower-left, a giant ghost `DELTA` wordmark in `#1F2023` **[MEASURED]** — barely above the surface. Bottom right: a copyright line.
- **Trigger:** Scroll.
- **Animated:** Newsletter block staggers eyebrow → heading → copy → control (`opacity` + `translateY(12px) → 0`). Footer columns stagger left to right. The ghost wordmark fades with `opacity` only and does not move.
- **Duration / easing [APPROX]:** 220 ms `--ease-out`, 60 ms stagger.
- **Reduced motion:** Static, fully opaque.
- **Accessibility:** the newsletter field needs a real programmatic `<label>` (visually hidden is fine — the export shows placeholder-style text only), a visible focus ring that survives the flush-joined layout, and a real submit control. Both loading and error states are required; neither may be hidden behind motion.
- **CONTENT GATE:** the footer shows `Sizing Guide`, `Returns`, and `FAQs` links, a phone number, an email address, a web address, and `DELTA © 2023`. Contact details and the year are brand facts the owner must confirm; `Returns` implies a returns policy that is explicitly not approved. Ship only links that resolve to real routes with approved content; omit the rest rather than creating empty or fabricated policy pages. Newsletter submission stays visual-only until an email integration is approved.

---

## Sequence summary

| # | Node | State | Trigger | Animated | Duration **[APPROX]** | Easing **[APPROX]** | Reduced motion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `66:6339` | Opening logo | Page load | opacity, scale | 240 ms + 360 ms hold | `--ease-brand` | Not rendered |
| 2 | `66:6450` | Amber wipe | Auto (after 1) | transform (translateY) | 280 ms in / 280 ms out | `--ease-brand` | Not rendered |
| 3 | `64:5965` | Hero | Page load (reveal) | opacity, translateY | 220 ms, 60 ms stagger | `--ease-out` | Static hero on first paint |
| 4 | `66:6253` | Black hold | Scroll | none | n/a | n/a | Identical |
| 5 | `66:6469` | Engineered (single) | Scroll | opacity, translateY, scale | 240 ms, 60 ms stagger | `--ease-out` | Static |
| 6 | `72:7103` | Engineered (gallery) | Scroll (same section) | opacity, translateX/Y | 240 ms, 70 ms stagger | `--ease-out` | Static, rail layout kept |
| 7 | `127:3240` | Philosophy (cream) | Scroll | opacity, translateY | 260/220 ms, 60 ms stagger | `--ease-out` | Static, tilt kept |
| 8 | `142:4702` | Three tests | Scroll | opacity, translateY | 240 ms, 60–80 ms stagger | `--ease-out` | Static, gradient kept |
| 9 | `142:5060` | Newsletter + footer | Scroll | opacity, translateY | 220 ms, 60 ms stagger | `--ease-out` | Static |

---

## Tokens this sequence requires

Added to `src/styles/globals.css` in this pass. Existing tokens are reused, not duplicated.

| Token | Value | Status | Evidence |
| --- | --- | --- | --- |
| `--color-surface-invert` | `#131417` | **added** | **[MEASURED]** flat field in `66:6339`, `66:6253`, `66:6469`, `72:7103`, `142:4702`, and the `142:5060` footer. Distinct from `--color-ink` (`#101114`), which is a *text* token; the landing must stop using ink as a surface. |
| `--color-surface-warm` | `#f5eedf` | **added** | **[MEASURED]** warm corner wash in `127:3240` (`#F4EEE1` top-left, `#F5EEDF` bottom-right) over the `#F3F3F3` base. |
| `--color-on-invert` | `#ffffff` | **added** | **[MEASURED]** heading fill on invert in `66:6469`, `142:4702`. |
| `--color-on-invert-muted` | `#bbbbbb` | **added** | **[MEASURED]** body copy on invert in `66:6469` and `142:4702`. Replaces the `#d7d7d9` / `#e0e0e0` literals currently in `globals.css`. |
| `--color-on-invert-subtle` | `#8f8f8f` | **added** | **[MEASURED]** footer link colour in `142:5060`. |
| `--color-ink-ghost` | `#1f2023` | **added** | **[MEASURED]** giant ghost DELTA wordmark on invert in `142:5060`. |
| `--gradient-display-gold` | `linear-gradient(90deg, #ffffff 0%, #dfae42 100%)` | **added** | **[MEASURED]** endpoints from the `MOVES WITHOUT RESTRICTION` glyph run in `142:4702`. |
| `--ease-brand` | `cubic-bezier(0.16, 1, 0.3, 1)` | **added** | **[APPROX]** — de-duplicates the literal already inline in `.home-intro-mark`. Not a Figma value. |
| `--duration-entry-long` | `280ms` | **added** | **[APPROX]** — top of `design.md`'s 180–280 ms entry budget, for the amber wipe. Not a Figma value. |
| `--color-accent` | `#fdb515` | **reused** | Sampled amber is `#FCB515` **[MEASURED]** across `66:6450`, `64:5965` CTA, `72:7103` CTAs, `142:5060` SUBSCRIBE. One unit of red off the existing token — within export/rounding noise. **Do not add a second amber token.** |
| `--color-surface` | `#f3f3f3` | **reused** | **[MEASURED]** cream base in `127:3240` and the `142:5060` newsletter block. |
| `--color-ink` / `--color-ink-soft` | `#101114` / `#4f5053` | **reused** | Philosophy body copy sampled `#555658` **[MEASURED]** ≈ `--color-ink-soft`. |
| `--color-inverse` | `#ffffff` | **reused** | Newsletter heading sampled `#060607`; use `--color-ink` family, not a new near-black. |
| `--duration-control`, `--duration-panel`, `--ease-out` | 160 ms / 240 ms / `cubic-bezier(0.22, 1, 0.36, 1)` | **reused** | Already present and already within budget. |

## Display type scale

**[MEASURED]** glyph heights from the storyboard PNGs, ×1.6 to a 1440-wide frame. Anti-aliasing inflates each raw run by roughly 1–2 px, so treat the derived font sizes as ±2 px and verify against `full-d-142-4326.png` before locking them. The font-size column is **derived** (glyph height ÷ ~0.72 cap ratio), not measured, and no Figma text style was captured.

| Role | Node | Glyph height @900 | @1440 | Proposed size | Notes |
| --- | --- | --- | --- | --- | --- |
| Hero `h1` | `64:5965` | 41 px | 66 px | `clamp(3rem, 6.4vw, 5.75rem)` | Line advance **measured** 69 px @900 = 110 px @1440 → line-height ≈ 1.2, **not** the 0.94 currently in `globals.css`. Fix this. |
| Engineered `h2` | `66:6469` | 43 px | 69 px | `clamp(2.5rem, 6.6vw, 6rem)` | Current `globals.css` caps at 5.25rem — slightly under source. |
| Footer/newsletter `h2` | `142:5060` | 39 px | 62 px | `clamp(2.5rem, 6vw, 5.5rem)` | Matches current. |
| Three-tests `h2` | `142:4702` | 38 px | 61 px | `clamp(2.25rem, 5.8vw, 5.25rem)` | |
| Three-tests display line | `142:4702` | 37 px | 59 px | `clamp(2.25rem, 5.6vw, 5.125rem)` | Gradient-filled. Current `globals.css` sets 9rem — far over source. Fix this. |
| Philosophy `h2` | `127:3240` | 34 px | 54 px | `clamp(2.25rem, 5.2vw, 4.75rem)` | |
| Hero stat number | `64:5965` | 33 px | 53 px | `clamp(2.25rem, 4vw, 4.5rem)` | Content gated — see state 3. |
| Eyebrow (uppercase) | `127:3240`, `142:5060` | 11 px | 18 px | `1rem`, weight 700+, tracking ≈ 0.04em | |
| Body on invert / cream | `66:6469`, `127:3240` | 11 px | 18 px | `1.125rem` | |
| Nav link, footer column head | `64:5965`, `142:5060` | 6–7 px | 10–11 px | `0.75rem` uppercase | Matches current. |

Type **weights, line heights beyond the hero, letter-spacing, and the display typeface itself are not captured** — the `Outfit` family recorded in the earlier audit is a body face and does not match the condensed grotesque visible in these display headings. That typeface is an open source gap; do not guess a substitute in code.

## Responsive

The 13 exports are desktop-width only (900 × 588 storyboard crops and 1440-wide compositions). **There is no mobile or tablet frame for any state in this sequence.** At 320 / 768 / 1024:

- Keep the state order and the copy unchanged.
- States 5–6: the five-up rail must wrap or become a horizontal scroller with keyboard access; it must not compress below a readable image.
- State 7: the two-column philosophy layout stacks, copy after the photo stack.
- State 9: link columns stack; the flush email + submit control becomes a stacked field and full-width button with a 44 px minimum target.
- The opening curtain (states 1–3) behaves identically at all widths, but its cost is highest on mobile — build agents should confirm it does not delay LCP; if it does, suppress it below 768 px and record that as a deviation.

These are approved inferences, not source. Record any further deviation in `docs/figma-audit.md`.

## What build agents must not do

- Do not present any timing or easing here as a Figma value.
- Do not implement the hero stats bar figures, the footer contact details, the `© 2023` year, or `Returns` / `Sizing Guide` / `FAQs` destinations without approved content.
- Do not redraw the philosophy orbit-and-dots artwork, the three-tests overlapping squares, or the concentric arcs. Omit; the vectors are missing.
- Do not animate anything but `opacity` and `transform`.
- Do not scroll-jack, pin, or add ambient/looping motion — including on state 4, which is empty space, not a pause.
- Do not add a dependency for any of this. `IntersectionObserver` plus the existing `.motion-reveal` CSS pattern covers the whole sequence.
