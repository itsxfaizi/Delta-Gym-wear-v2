# Delta Gym Wear — local design reference manifest

**Purpose:** Source-controlled reference pack for Phase 4A while Figma MCP is offline. Browser exports below were taken from the signed-in Figma file [Delta](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta) on **2026-08-30**. Browser-visible layers do not expose stable node IDs; each such entry therefore records `node ID: unavailable — MCP offline`.

**Implementation gate:** The project owner approved the documented Phase 4A deviations on 2026-08-30. Temporary component-crop seed assets, derived responsive layouts, and accessible interaction/error states are approved for this slice. The three desktop screens were already exported and were not re-exported in this pass. A valid browser-generated Figma Motion export for the full landing composition was acquired on 2026-08-30; it supersedes the earlier statement that the landing reference had no usable motion artifact.

## Phase 4B visual fidelity closeout attempt — 2026-08-30

- [x] Exact dark catalog-header logo SVG is now present locally as `design-reference/assets/delta-logo-dark.svg` (112 × 28). Browser-visible source: current Delta file → `Nav → Light → Layer 2`; node ID unavailable because MCP is offline. This is authoritative for the catalog header; the user-supplied PNG remains retained as a temporary fallback/reference.
- [x] Exact Catalog component crops are now present locally as `design-reference/assets/product-card-normal.png` and `product-card-hover.png` (each 280 × 463). Browser-visible source: current Delta file → Components → `Catalog` → Normal/Hover; node IDs unavailable because MCP is offline. These are authoritative for development catalog card treatment; they contain the complete card crop including typography and badge.
- [x] Earlier browser export attempt for the same logo timed out; subsequent local artifact verification found the exact 112 × 28 SVG and 280 × 463 Catalog crops. These verified files are now recorded above.
- [ ] Additional distinct product identities beyond the single Catalog crop family (Normal/Hover) are still missing; the approved desktop reference shows repeated cards but no further original local crops are available.
- [ ] Circles motion/video and valid resting frame. Still blocked: prior browser export was transparent 1 × 1 and no motion file was exposed. Do not recreate.

These are explicit source/asset blockers, not invented substitutes. Phase 4A implementation may continue only against the already approved local exports; visual closeout and any broader route work remain deferred until authoritative artifacts are available.

## Required screen exports (already complete; not re-exported)

| Done | Figma source / exact layer | Node ID | Export date | Format / dimensions | Route or component | Local path | Missing interaction details |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | [Delta](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta) · Design layer `10` | unavailable — MCP offline | 2026-08-30 | PNG · 1440 × 1606 | `catalog` | `design-reference/exports/catalog-desktop-1440.png` | Filter URL/query contract, category-tab behavior, sort semantics, search/favourites behavior, loading/empty/error states, keyboard equivalents |
| [x] | [Delta](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta) · Design layer `14` | unavailable — MCP offline | 2026-08-30 | PNG · 1440 × 1606 | `/products/[handle]` | `design-reference/exports/product-detail-desktop-1440.png` | Variant availability/validation, size guide, quantity limits, gallery zoom/keyboard behavior, add-to-cart failure/success, loading/unavailable/error states |
| [x] | [Delta](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta) · Design layer `13` | unavailable — MCP offline | 2026-08-30 | PNG · 1440 × 1024 | Cart drawer | `design-reference/exports/catalog-cart-drawer-desktop-1440.png` | Focus trap/restore, Escape/close, quantity/remove semantics, persistence, unavailable-item handling, live announcements, checkout action (out of scope) |

## Homepage frame exports — 2026-08-31

| Done | Figma source / exact layer | Node ID | Export date | Format / dimensions | Source filename | Local path | Route or component / intended use | Missing interaction details | Authority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | `Delta` · Design → `Full` landing composition | `142:4326` | 2026-08-31 | PNG · 1440 × 4700 | `Full.png` | `design-reference/exports/home/home-desktop-1440.png` | Public homepage full-page visual reference | Mobile/tablet variants, hover/focus/active states, per-connection transition timings, and scroll-model behavior are not established by this export | authoritative |

## Brand mark

| [x] | User-supplied dark Delta logo image (provided in chat on 2026-08-30) | user-provided; no Figma node ID | 2026-08-30 | PNG · 8334 × 4167 | `codex-clipboard-32d71e2f-8906-4a18-86c1-420c3b0bc5ab.png` | `design-reference/assets/delta-logo-dark-user.png` and `public/design-reference/assets/delta-logo-dark-user.png` | User-provided temporary dark header reference; displayed with CSS crop to remove whitespace. Not an SVG/vector export; replace with authoritative Figma SVG when available. | Source contains white padding; no vector metadata or responsive variants. |
| [x] | Current Delta file · `Nav → Light → Layer 2` | unavailable — MCP offline | 2026-08-30 | SVG · 112 × 28 viewBox | `delta-logo-dark.svg` | `design-reference/assets/delta-logo-dark.svg` and `public/design-reference/assets/delta-logo-dark.svg` | Authoritative dark catalog-header mark from the verified local export. | Mobile sizing/clear-space rules are not authored. |

| Done | Exact Figma layer/component | Node ID | Export date | Format / dimensions | Source filename | Destination | Intended use / notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | [Delta](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta) · Design → frame `1` → `Logo` | unavailable — MCP offline | 2026-08-30 | SVG · 294 × 73 viewBox | `Logo.svg` | `design-reference/assets/delta-logo.svg` | Approved vector mark for public navigation/brand use; source export, not redrawn. | Clear-space, responsive sizing, and accessible name are not authored in Figma. |

## Exact UI icon exports

All rows below are [Delta](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta) → Components → `Icon` variants. Every SVG is a browser export at 24 × 24 viewBox; source filenames are retained here exactly as downloaded (`Property 1=…`).

| Done | Exact variant | Node ID | Export date | Format / dimensions | Source filename | Destination | Intended use | Missing interaction details |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | `Icon / Search` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Search.svg` | `design-reference/assets/icons/search.svg` | Header/search control | Accessible name and hover/focus/disabled states are not authored. |
| [x] | `Icon / Bag` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Bag.svg` | `design-reference/assets/icons/bag.svg` | Empty/unselected cart trigger | Accessible name and hover/focus/disabled states are not authored. |
| [x] | `Icon / Bag-Filled` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Bag-Filled.svg` | `design-reference/assets/icons/bag-filled.svg` | Filled cart trigger | Accessible name and hover/focus/disabled states are not authored. |
| [x] | `Icon / Heart` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Heart.svg` | `design-reference/assets/icons/heart.svg` | Product favourite affordance (behavior remains unapproved) | Accessible name and active/hover/focus states are not authored. |
| [x] | `Icon / Zoom` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Zoom.svg` | `design-reference/assets/icons/zoom.svg` | Gallery zoom affordance | Keyboard equivalent and focus state are not authored. |
| [x] | `Icon / Add` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Add.svg` | `design-reference/assets/icons/add.svg` | Quantity increment | Quantity limit, disabled state, and accessible label are not authored. |
| [x] | `Icon / Minus` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Minus.svg` | `design-reference/assets/icons/minus.svg` | Quantity decrement | Quantity floor, disabled state, and accessible label are not authored. |
| [x] | `Icon / Up` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Up.svg` | `design-reference/assets/icons/up.svg` | Chevron/up control | Keyboard behavior and expanded/collapsed semantics are not authored. |
| [x] | `Icon / Down` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Down.svg` | `design-reference/assets/icons/down.svg` | Chevron/down control | Keyboard behavior and expanded/collapsed semantics are not authored. |
| [x] | `Icon / Star` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Star.svg` | `design-reference/assets/icons/star.svg` | Unfilled rating star | Rating semantics and accessible text are not authored. |
| [x] | `Icon / Filled Star` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Filled Star.svg` | `design-reference/assets/icons/filled-star.svg` | Filled rating star | Rating semantics and accessible text are not authored. |
| [x] | `Icon / Check` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Check.svg` | `design-reference/assets/icons/check.svg` | Check affordance | Control semantics and accessible label are not authored. |
| [x] | `Icon / Check Empty` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Check Empty.svg` | `design-reference/assets/icons/check-empty.svg` | Unselected filter/check state | Checkbox keyboard/state semantics are not authored. |
| [x] | `Icon / Check Filled` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Check Filled.svg` | `design-reference/assets/icons/check-filled.svg` | Selected filter/check state | Checkbox keyboard/state semantics are not authored. |
| [x] | `Icon / Cross` | unavailable — MCP offline | 2026-08-30 | SVG · 24 × 24 | `Property 1=Cross.svg` | `design-reference/assets/icons/cross.svg` | Close/remove affordance | Close/remove action semantics and focus behavior are not authored. |

## Product image exports

These are exact browser exports of [Delta](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta) → Components → `Image` variants used by the catalog/PDP/cart compositions. The selected Large/Normal fill exposed embedded source `upscale_image [Upscaled]`, original image metadata 2800 × 2100, with no authored alt text. Figma browser export produced the component crop dimensions below; an original 2800 × 2100 source file was not exposed for download, so the original-format requirement remains an open gate.

| Done | Exact variant | Node ID | Export date | Format / exported dimensions | Source filename | Destination | Intended use / limitation | Missing interaction details |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | `Image / Large, Normal` | unavailable — MCP offline | 2026-08-30 | PNG · 638 × 720 | `Property 1=Large, Property 2=Normal.png` | `design-reference/assets/product-large-normal.png` | PDP primary/gallery and catalog card source crop; development reference, not original source file | Alt text, focal point/crop rules, and responsive source mapping are not authored. |
| [x] | `Image / Large, Hover` | unavailable — MCP offline | 2026-08-30 | PNG · 638 × 720 | `Property 1=Large, Property 2=Hover.png` | `design-reference/assets/product-large-hover.png` | PDP hover/zoom state crop; development reference | Hover keyboard equivalent, zoom behavior, and alt text are not authored. |
| [x] | `Image / Small, Normal` | unavailable — MCP offline | 2026-08-30 | PNG · 148 × 124 | `Property 1=Small, Property 2=Normal.png` | `design-reference/assets/product-small-normal.png` | Gallery/cart thumbnail crop | Thumbnail selection semantics and alt text are not authored. |
| [x] | `Image / Small, Selected` | unavailable — MCP offline | 2026-08-30 | PNG · 152 × 128 | `Property 1=Small, Property 2=Selected.png` | `design-reference/assets/product-small-selected.png` | Selected gallery/cart thumbnail; exported border makes this 4 px larger than Normal | Selection announcement, keyboard behavior, and alt text are not authored. |
| [x] | `Catalog / Normal` | unavailable — MCP offline | 2026-08-30 | PNG · 280 × 463 | `product-card-normal.png` | `design-reference/assets/product-card-normal.png` | Authoritative complete catalog card crop for development seed mapping and desktop density comparison | Crop includes authored card text/badge; responsive variants are not authored. |
| [x] | `Catalog / Hover` | unavailable — MCP offline | 2026-08-30 | PNG · 280 × 463 | `product-card-hover.png` | `design-reference/assets/product-card-hover.png` | Authoritative hover-state catalog card crop | Hover interaction is implemented accessibly with focus-visible parity; no mobile hover state is authored. |

## Authored motion inspection

Motion mode was inspected on [Delta](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta) → Design → `Full` → `Circles`; the browser timeline exposed `Rotation`, duration `2000 ms`, loop control, and the audited authored motion is −180° → 0° with `easeOut`, repeating infinitely. Node ID: unavailable — MCP offline.

| Done | Exact layer/track | Export date | Format / dimensions | Source filename | Destination | Result / intended use | Missing interaction details |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | `Full / Circles / Rotation` (resting endpoint tested at 2000 ms) | 2026-08-30 | PNG · browser output 1 × 1 transparent (invalid) | `Circles.png` | `design-reference/motion/circles-resting-browser-export-1x1.png` | Diagnostic only; rejected as reduced-motion frame because browser export is blank/1 × 1. | Valid static resting frame and reduced-motion rendering contract are missing. |
| [ ] | `Full / Circles / Rotation` (second endpoint export) | 2026-08-30 | PNG · browser output 1 × 1 transparent (invalid) | `Circles (1).png` | `design-reference/motion/circles-resting-endpoint-browser-export-1x1.png` | Diagnostic only; rejected as reduced-motion frame because browser export is blank/1 × 1. | Valid static resting frame and reduced-motion rendering contract are missing. |
| [ ] | `Full / Circles / Rotation` | 2026-08-30 | MP4/GIF/WebM not exposed by browser Motion export controls | — | — | No authored video export available through this browser surface. Do not recreate or substitute motion. | Loop encoding, timing delivery, and reduced-motion fallback are missing. |
| [x] | [Delta `Full`](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta?node-id=142-4326) / full landing composition, including `Circles / Rotation` | 2026-08-30 | MP4 · 1176 × 3840 · 30 fps · 2,000 ms | `Full.mp4` | `design-reference/motion/figma-full-142-4326.mp4` | **Authoritative browser Figma Motion export.** It shows the landing composition from hero through footer and its authored motion. Use as the home visual/composition reference; do not present it as a standalone product-video asset without an approved placement decision. | Browser UI exposes the full-frame timeline, but does not isolate the `Circles` layer into an independently valid media file or resting-frame export. |

## Landing source-asset recovery — 2026-08-30

The owner-provided local `Delta.fig` package was inspected after the browser Motion export established [Full](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta?node-id=142-4326) as the approved landing composition. The binaries below are unmodified embedded Figma package assets, copied to both the reference pack and their public local mappings. Individual asset-node IDs are unavailable because MCP is offline; the `Full` source node is the authoritative composition that visibly uses them.

| Done | Figma source / selected composition | Node ID | Export date | Format / dimensions | Source filename | Destination | Intended use | Authority / missing detail |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | `Full` hero beach runner | unavailable — MCP offline; composition `142:4326` | 2026-08-30 | MP4 · 960 × 540 | `194e4def8f6b573b0b9c4e5692e2fcee0c9f6888.mp4` | `design-reference/assets/landing/hero-run.mp4`; `public/design-reference/assets/landing/hero-run.mp4` | Home hero enhancement | Original Figma embedded asset. Playback controls/cue points are not authored. |
| [x] | `Full` hero beach runner resting image | unavailable — MCP offline; composition `142:4326` | 2026-08-30 | PNG · 960 × 540 | `ee712d43e07d4e8ad3ce914c16fecdf5da0467b0.png` | `design-reference/assets/landing/hero-run.png`; `public/design-reference/assets/landing/hero-run.png` | Home hero static and reduced-motion poster | Original Figma embedded asset. |
| [x] | `Full` engineered athlete strip | unavailable — MCP offline; composition `142:4326` | 2026-08-30 | PNG · 247 × 370 | `59055bb650404d968a6e2805ca6d42d94437d0f3.png` | `design-reference/assets/landing/engineered-bodybuilder.png`; `public/design-reference/assets/landing/engineered-bodybuilder.png` | First athlete tile | Original Figma embedded asset. |
| [x] | `Full` engineered athlete strip | unavailable — MCP offline; composition `142:4326` | 2026-08-30 | PNG · 900 × 1200 | `6bc53acc040243210b93b72890a520227054cfc4.png` | `design-reference/assets/landing/engineered-day-runner.png`; `public/design-reference/assets/landing/engineered-day-runner.png` | Second athlete tile | Original Figma embedded asset. |
| [x] | `Full` engineered athlete strip | unavailable — MCP offline; composition `142:4326` | 2026-08-30 | PNG · 900 × 1478 | `5c0a5ed8607dba2584043fb2d3675cd77748ce36.png` | `design-reference/assets/landing/engineered-gym-man.png`; `public/design-reference/assets/landing/engineered-gym-man.png` | Third athlete tile | Original Figma embedded asset. |
| [x] | `Full` engineered athlete strip | unavailable — MCP offline; composition `142:4326` | 2026-08-30 | PNG · 900 × 1350 | `57a78f305f806597f3eb0a2b6ff3a1ebd3e628fa.png` | `design-reference/assets/landing/engineered-night-runner.png`; `public/design-reference/assets/landing/engineered-night-runner.png` | Fourth athlete tile | Original Figma embedded asset. |
| [x] | `Full` engineered athlete strip | unavailable — MCP offline; composition `142:4326` | 2026-08-30 | PNG · 900 × 1350 | `963e7f3795360c12e7023a1cb1ef87de9ded2381.png` | `design-reference/assets/landing/engineered-skip-rope.png`; `public/design-reference/assets/landing/engineered-skip-rope.png` | Fifth athlete tile | Original Figma embedded asset. |
| [x] | `Full` product philosophy | unavailable — MCP offline; composition `142:4326` | 2026-08-30 | PNG · 842 × 1263 | `a6c45e75466814e50b9d4808d9a47d1a1e6bcdcb.png` | `design-reference/assets/landing/philosophy-athlete.png`; `public/design-reference/assets/landing/philosophy-athlete.png` | Product philosophy image | Original Figma embedded asset. |

## Missing states and approval gates

- [x] Valid authored motion export for the full landing frame: `figma-full-142-4326.mp4`. The isolated `Circles` resting-frame export remains unavailable; reduced motion must therefore render the source layout in its stable, non-animated state rather than play the export.
- [ ] Mobile frames for catalog, PDP, and cart drawer. **Approved deviation:** derive mobile layouts from the desktop exports and document each deviation in `docs/figma-audit.md`.
- [ ] Tablet frames for catalog, PDP, and cart drawer. **Approved deviation:** derive tablet layouts from the desktop exports and document each deviation in `docs/figma-audit.md`.
- [x] Approved responsive deviations for 320, 768, and 1024 px; implementation must document the derived rules.
- [x] Keyboard/focus, dialog semantics, loading, empty, error, unavailable-variant, and add-to-cart failure states may be implemented as documented accessibility/product deviations.
- [ ] Asset rights, final alt text, and font delivery/licensing.
- [x] Original product image files in their available source format (approved deviation: use the exact exported Figma component crops as temporary development seed assets).

**Local-reference gate:** **Ready for the approved Phase 4A public storefront slice and source-backed home-composition planning.** Component crops are explicitly temporary development seed assets and responsive/interaction behavior must follow the approved deviations. Exact individual landing image exports and mobile/tablet source frames remain outstanding.

## Prototype corrective rebuild evidence — 2026-08-31

The signed-in browser prototype at [Delta root `64:5965`](https://www.figma.com/proto/6zqT0W5qCdhBpVEGEu6G3i/Delta?node-id=64-5965&t=kgUcv3geNTskdtYo-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=66%3A6339) was rechecked on 2026-08-31. Browser playback has no stable node IDs for its later screens while MCP remains unavailable.

| Source state | Export status | Intended use | Authority / gap |
| --- | --- | --- | --- |
| Hero, Engineered, Philosophy | Existing original local crops listed above | Home prototype frame composition | Authoritative local images; browser verified sequence. |
| Three Tests | No standalone browser/local vector asset | `tests` frame | Visible source copy is authoritative; the decorative squares are not recreated without the exact vector export. |
| Newsletter + footer | Existing local `delta-logo.svg` and source-backed footer copy | Final `newsletter-footer` frame | Browser-verified visible final frame. Subscribe is presentation-only; no email provider is approved. |
| Philosophy orbit/dots | No valid local vector or resting frame | Not rendered | Explicitly omitted; do not redraw or substitute. |
