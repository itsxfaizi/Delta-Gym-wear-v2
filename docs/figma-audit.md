# Figma audit — Delta

**Source:** [Delta design file](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=0-1) · audited 2026-08-30.  This is a read-only audit; no Figma nodes were changed.

## Scope and source inventory

The file inventory contains five pages: [🎨 Design](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=0-1), [📌 Components](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=6-3), [📔 Color Book](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=32-976), an empty separator page (`32:974`), and [🖼️ Thumbnail](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=8-30). The substantive route/component audit covers Design and Components; Color Book and Thumbnail could not be deep-inspected after the Figma Starter-plan MCP call limit was reached. The Design page contains desktop-width (1440 px) public storefront explorations only; there are no named admin frames or mobile/tablet frames.

| Evidence | What it contains | Route/status supported by source |
| --- | --- | --- |
| [Frames 1–9](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=66-6339), [3](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=64-5965), and the [2820 px full composition](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=72-6719) | Brand/landing-page explorations: hero, metrics, navigation, product philosophy; later composites add gender CTAs and performance-test sections. Frame names are numeric. | Public landing/brand page is strongly evidenced; exact URL slug is not specified. |
| [3760 px full composition](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=100-10098) and [4700 px full composition](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=142-4326) | Extended landing composition; the latter ends with `DELTA / 2023 / All Rights Reserved`. | Same public landing page; the multiple unnamed `Full` frames are design iterations, not separate routes. |
| [Catalog / frame 10](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=200-758) | `All Products`, category tabs, Featured sort, 3-column product grid, left filters (size, colour swatches, gender checkboxes, price range). | Public product-listing route; exact path and query schema not specified. |
| [PDP / frame 14](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=200-666) | `Ease Fit Trouser`, gallery, rating, discounted PKR prices, colour and size selection, size guide, quantity, `ADD TO CART`, accordion facts, and recommendations. | Public product-detail route; dynamic handle and variant availability rules not specified. |
| [PDP/cart state / frame 15](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=201-654) | PDP with an overlaid/right cart panel. | Represents a cart-open UI state; source does not define navigation, persistence, or checkout behavior. |
| [Catalog/cart state / frame 11](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=226-860), [cart state / frame 12](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=231-2782), and [catalog + cart / frame 13](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=231-3130) | Listing plus right-side cart panel. The panel has cart items, quantity controls, subtotal and `CHECK OUT`; frame 13 includes a scrollbar. | Cart-open state is evidenced. Checkout destination/flow is not. |

The catalog and PDP content uses sample commercial content (`PKR`, `Ease Fit Trouser`, review count and discounts). It demonstrates required content fields, not approved commerce policy.

## Reusable component inventory

All components are on [📌 Components](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=6-3). Their actual Figma names are retained here; code names should be resolved later.

| Component evidence | Variants / observed states | Intended reusable role |
| --- | --- | --- |
| [Icon](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=13-1070) | Search, Bag, Bag-Filled, Heart, Zoom, Add/Minus, Up/Down, Star/Filled Star, Check/Check Empty/Check Filled, Cross | Icon glyph set; source has no accessible-name annotations. |
| [Nav](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=114-1108) | Light only (1438×77 component); links SHOP / ABOUT / CONTACT US and search/heart/bag icon instances | Public desktop header. No compact/mobile state is supplied. |
| [Image](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=175-586) | Large Normal/Hover (638×720); Small Normal/Selected (148×124). Hover includes a Zoom icon. | PDP image/gallery item. |
| [Size](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=178-739) | Normal and Selected (50×44) | Selectable product/filter size. Disabled/unavailable/error states are absent. |
| [cta](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=192-731) | Large 138×52; small 129×34 | Action control. Component text is `BUY NOW`; instances overwrite it (`ADD TO CART`, `CHECK OUT`). Hover/focus/disabled/loading variants are absent. |
| [Catalog](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=192-743) | Normal and Hover, 280×463 | Product tile with image, heart, badge, name and prices. |
| [Cart Item](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=231-1679) | Single 498×154 component with gallery image and +/- controls | Cart drawer item. Remove action and stock/error states are absent. |
| [Unnamed set `1`](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=244-1388) | Three visually named `Property 1=Default` variants | Meaning is ambiguous; do not implement or infer until renamed/confirmed. |

## Semantic token candidates

The file has one local variable collection, named `Premitives` (sic), one mode (`Mode 1`), and **only COLOR variables**. It has no local paint or text styles, spacing, radius, typography, or semantic-mode variables.

| Figma evidence | Candidate semantic use (proposed mapping, not an approved brand rule) |
| --- | --- |
| `Charcoal/50…900`, e.g. [Charcoal/50](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=0-1) = `#F3F3F3`, `Charcoal/500` = `#131416`, `Charcoal/900` = `#060607` | `color-surface-subtle`, `color-text-primary`/`color-surface-inverse` only after component bindings are inspected. |
| `Gold/50…900`, e.g. `Gold/500` = `#FDB515` | `color-accent-*`; usage/contrast pairing needs verification during implementation. |
| `Neutral/50…900`, e.g. `Neutral/50` = `#FFFFFF`, `Neutral/900` = `#353535` | `color-surface`, `color-border`, `color-text-muted` candidates. |
| Text inspected in catalog/PDP uses `Outfit` Regular/Medium/SemiBold/Bold; observed sizes include 12, 14, 16, 18, 20, 24 and 28 px. | Preserve this typeface only after its web-licensing/source is confirmed. Establish semantic type roles from approved route screenshots; no Figma text styles exist to map directly. |

## Assets and responsive evidence

* Product/gallery imagery is embedded inside [Image](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=175-586) and [Catalog](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=192-743) components. The audit did not export or identify source image rights/alt text; use Figma export/download only after asset ownership and delivery policy are confirmed.
* The Delta mark is drawn as vectors in the unnamed logo exploration [frame 1](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=66-6339). Treat it as a source asset, not a recreated text logo.
* Every routable screen is 1440 px wide. The only component-size variants are gallery large/small, CTA large/small, tile hover, thumbnail selected, size selected, and bag filled. There is no 320/768/1024 frame or mobile navigation/filter/cart design. Responsive breakpoint and drawer behavior are therefore an open design decision.

## Motion, prototype, and interaction evidence

* Figma motion context found one authored timeline within the extended landing composition: [Circles](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=142-4364) rotates from -180° to 0° over 2 s with `easeOut`, repeating infinitely. This is source-authored motion and must be preserved only with `prefers-reduced-motion` rendering a static resting state (0°); do not add unrelated motion.
* Motion context returned no authored timelines for the catalog frame 10 or catalog/cart frame 13. Catalog/PDP/cart top-level frames inspected also had no prototype reactions. The PDP motion query was blocked by the Figma Starter-plan MCP call limit before completion; treat it as **not fully verified**, not as evidence of no motion.
* Visual states supplied by component variants imply hover/selected/open behavior, but Figma does not supply keyboard, focus, loading, validation, empty, error, or transition specifications.

## Accessibility annotations and design gaps

* Use semantic navigation, headings, product/article structure, labelled quantity controls, radios for exclusive size/colour selection, checkboxes for multi-select filters, and a labelled range control. The visual swatches/icons alone are not accessible names.
* Cart must be a labelled modal/dialog or complementary region with managed focus, Escape/close control, announcement of updates, and a keyboard-safe quantity/remove flow. The supplied right drawer gives no focus or modal semantics.
* Hover-only gallery zoom, heart, icon buttons, and selected-state borders require non-pointer equivalents and visible focus. Contrast and target size must be measured against the bound variable values before implementation.
* `Free returns within 30 days`, shipping timing, prices, discount claims, ratings, and checkout copy are unverified business/legal content. Do not treat their appearance as approved policy.

## Open design decisions / blocking audit gaps

1. Confirm which landing composition is approved and rename target frames; numeric frames and duplicate `Full` frames do not identify a final route.
2. Provide/approve mobile and tablet variants for landing, catalog filters, PDP gallery/controls, navigation and cart; current source supports desktop only.
3. Confirm the intended route paths and interaction contracts for search, favourites, category tabs, sort, filters, gallery zoom, size guide, cart persistence and checkout. The Figma file documents presentation, not these behaviors.
4. Confirm approved content/asset rights, image alt text, the web font source/license, and replacement data for the visible sample products and commercial claims.
5. Provide named admin frames and its matching publishing workflow. None appear in this source file, so no admin UI can be Figma-faithfully scoped yet.
6. Resolve/rename component set [`1`](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=244-1388); its three indistinguishably named variants are not safely implementable.

## Audit conclusion

## Homepage export evidence — 2026-08-31

The approved landing composition `Full` at node `142:4326` was exported from the signed-in Figma browser as `PNG · 1440 × 4700` and verified on disk at `design-reference/exports/home/home-desktop-1440.png`. This is authoritative for the desktop full-page composition. No mobile/tablet frame or interaction-state export was available through the current access path, so those remain documented gaps and must use the already approved responsive deviations only after the owner confirms them.

The smallest Figma-supported storefront journey is **catalog → product detail → selected size/colour → add to cart → cart drawer**. It is visually evidenced by frames [10](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=200-758), [14](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=200-666), and [13](https://www.figma.com/design/JGztBol3zxJuf7O3rKXIuD/Delta?node-id=231-3130). The owner-approved deviations below unblock this public Phase 4A slice; admin design/workflow and landing motion remain outside its scope.

## Approved Phase 4A deviations — 2026-08-30

The project owner approved the following bounded deviations for the public storefront slice:

1. Use the exact exported Figma `Image` component crops in `design-reference/assets/` as temporary development seed assets. They are not production content or a claim about final image rights/source files.
2. Derive mobile and tablet layouts from the approved 1440 px desktop exports. The implementation must document every deviation at 320, 768, and 1024 px (grid columns, filter treatment, gallery behavior, drawer width, and sticky controls).
3. Implement semantic keyboard/focus behavior and loading, empty, error, unavailable-variant, and add-to-cart failure states as accessibility/product deviations because Figma does not author those states. These states must not alter the approved desktop composition when the source state exists.
4. Defer the `Circles` motion and landing/brand route until a valid authored motion export and resting frame are supplied. No substitute or invented motion is approved for Phase 4A.

The local-reference gate is therefore **ready for Phase 4A only** (catalog → dynamic PDP → variant selection → cart drawer), while motion/landing work remains blocked.

## Phase 4B closeout attempt — 2026-08-30

The signed-in in-app browser was available and exposed the current Components/Design layers. The catalog header logo was identified as `Nav → Light → Layer 2` (visible dimensions 112 × 28), but the browser export download did not complete: the download event timed out and no new local artifact appeared. Additional distinct product-card crops likewise produced no completed local downloads. No substitute or redrawn asset was introduced; existing component crops remain temporary development seed assets under the approved deviation. Circles motion remains deferred because the prior browser output was a transparent 1 × 1 diagnostic and no valid motion export exists.

The owner supplied a dark logo raster in chat on 2026-08-30 (`8334 × 4167` PNG). It is stored as a temporary user-provided reference at `design-reference/assets/delta-logo-dark-user.png`; CSS cropping is retained only as fallback behavior. It is not an authoritative vector export.

Subsequent local verification found `delta-logo-dark.svg` (112 × 28) and complete `Catalog / Normal` and `Catalog / Hover` crops (280 × 463) in the reference pack. These are now treated as authoritative local exports for the catalog header and card composition, respectively; the supplied raster remains retained as fallback reference only.

The fresh 1440 px comparison confirms the dark logo and complete card crop treatment now match the supplied reference. Only one product crop family is locally available (Normal/Hover states of the same visible product), so the reference’s repeated three-column catalog density cannot be reproduced with distinct product records without additional original crops. This remains a documented content-asset gap, not a UI substitution.

## Approved storefront expansion deviations — 2026-08-30

The project owner additionally approved inferred **home, collection, search, footer, mobile, and responsive** layouts for the public storefront. This approval resolves only the absence of their local frame/layout evidence; it does not create Figma evidence for their copy, interaction, commerce, or asset details. The implementation handoff in `docs/public-storefront-design-spec.md` therefore binds these surfaces to the established desktop catalog/PDP/cart visual language, uses the supplied vector marks and product component crops exactly, and records the remaining gaps rather than fabricating new assets or Circles motion.

## Public storefront sprint comparison — 2026-08-30

- The 1440 catalog retains the exact centered dark logo, left filter rail, compact product context, square controls, and three-column grid geometry. URL search and supported size/colour/sort controls are approved additions. Category/gender/price controls are omitted because the typed catalog has no approved fields for them.
- The complete 280 × 463 Catalog crops contain baked discounts and a different sample product. To satisfy the no-fake-promotions/content rule, they remain authoritative comparison artifacts but are not rendered as live cards; the implementation uses the source-exported PDP crop with typed development seed fields.
- The PDP retains the exact two-column/gallery/control composition and gold CTA. Reviews, discount/compare-at price, size guide, quantity, returns/shipping facts, detailed fabric/care claims, and recommendations are omitted because no approved commercial source exists.
- The drawer retains the right-side 1440 overlay composition, dimmed backdrop, item/variant/quantity/subtotal hierarchy, and exact icons. The Checkout control is replaced with `View cart`; checkout remains out of scope.
- Home, `/collections/all`, `/cart`, the inverse footer, and 320/768/1024 transformations are owner-approved inferred deviations. No Circles motion or replacement animation was added.
- Screenshot evidence is stored under `output/playwright/responsive/`. Remaining visual limitation: only one authoritative product/image family exists, so distinct multi-card density cannot be reproduced without source substitution.

### Release-hardening closeout

- The source-backed desktop sort control is positioned at the top-right of the catalog results rather than inside the filter rail.
- The 1440 px PDP gallery is capped at the evidenced 638 × 720 proportion; smaller breakpoints remain the approved derived responsive treatment.
- The cart drawer isolates the background, locks page scrolling, traps/restores focus, and keeps totals/actions in a persistent footer while cart lines scroll independently.
- Colour and size expose radio-group semantics with roving arrow-key selection. Unavailable variants remain disabled and explicitly named.
- Temporary Figma seed pricing and availability remain development content and are excluded from Schema.org `Offer` output. A production runtime without the tenant-scoped database fails closed.
- Browser screenshots were refreshed at 320, 768, 1024, and 1440 px. Remaining source differences are limited by the recorded missing responsive frames, distinct original product crops, footer frame/content, and Circles motion export.

## Motion pass — 2026-08-30

The owner-supplied WhatsApp MP4 was treated as visual art direction only. No executable instructions or exact Figma timing were inferred from it. The public motion pass is documented in `docs/motion-pass.md`; authoritative `Circles` motion remains deferred until a valid Figma motion export and resting frame are available.

## Landing-motion source correction — 2026-08-30

The owner clarified that the WhatsApp clip's visible landing content is represented in the Delta Figma file and is the intended storefront content, rather than merely generic motion inspiration. A signed-in browser inspection of [Delta `Full`](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta?node-id=142-4326) verified an authored `Circles` rotation timeline: **2,000 ms**, looping, with the existing audited rotation track. Figma then produced a valid **1176 × 3840, 30 fps, 2-second MP4** of the full landing composition, stored at `design-reference/motion/figma-full-142-4326.mp4` and registered in the local manifest.

This makes the full landing composition authoritative visual reference. It does **not** by itself establish an embedded-video placement, individual image/export rights, mobile/tablet frames, or a separate valid static `Circles` resting frame. The current home route's generic copy and inferred reveal choreography are therefore known visual deviations and must be replaced only by a source-backed landing implementation or an owner-approved decision to embed the full export.

## Landing closeout — source-backed implementation evidence — 2026-08-30

`figma-full-142-4326.mp4` was extracted at 1 fps to `artifacts/motion-frames/figma-full-142-4326/frame-001.jpg` and `frame-002.jpg`; both are non-empty 1176 × 3840 frames. The resulting [inspection map](../artifacts/motion-frames/figma-full-142-4326/section-map.md) confirms the source sequence: beach-runner hero and proof points; engineered athlete rail and CTAs; product philosophy; product-test panel; newsletter; inverse footer.

The current home route now follows that sequence natively. The exact original Figma-package hero video/poster, five athlete-rail images, and philosophy image are recorded in `design-reference/manifest.md` and mapped locally. The earlier generic home copy, product-card section, parallax, and generic reveal choreography were removed from this route.

Documented, bounded deviations:

- No mobile or tablet landing frames are present. The desktop composition stacks its editorial sections below 1024 px, compresses the athlete rail into equal source-image tiles, and keeps the hero content readable at 320 px.
- The browser exposes `Circles / Rotation` only inside the full composition, not as a usable isolated asset. It is not recreated; reduced motion renders stable final layout and the source hero poster instead of video.
- Historical note (superseded by the 2026-08-31 corrective rebuild): the product-test square motif had been reconstructed with CSS. It is now removed pending an exact vector export.
- `SHOP MEN` and `SHOP WOMEN` visibly link to the approved catalog route; gender-specific collections are not implemented because no collection contract is approved.
- Newsletter text is represented visually but has no input or submission behavior: email/marketing integration is out of scope.

Remaining source gaps: authoritative responsive frames, an isolated Circles resting asset, source-approved newsletter behavior, confirmed final alt text, and a gender-collection route/content contract. These are not hidden by substitute assets or invented flows.

Fresh final comparison captures are stored in `output/playwright/landing-reference/`: `home-1440.png`, `home-1024.png`, `home-768.png`, and `home-320.png`. At 1440 px the checked sequence, hero media crop, athlete-rail density, editorial image/copy split, inverse tests section, newsletter, and footer match the inspected full-frame composition. At 320 px, the documented responsive stack preserves all source sections and 44 px interactive controls; it necessarily differs from desktop because no mobile source frame exists.

## Cinematic landing-scene navigation — 2026-08-30

Figma MCP `get_motion_context` for `Full` (`142:4326`) confirms the export has no authored browser-scroll model or per-section transition data. Its only animated node is `Circles` (`142:4364`): -180° → 0°, 2 seconds, `easeOut`, looping. The owner approved a native cinematic scroll adaptation for desktop/tablet: a vertical wheel or non-interactive `Arrow`/`Page`/`Space` gesture advances exactly one source-ordered scene, prevents continuous wheel scrolling, and ignores further scene input while the incoming transition resolves. Touch navigation keeps native CSS snap.

Scene content and links are present before hydration. The active scene may replay its short source-informed transform/opacity entrance when revisited; the full export provides no independent timings, so these remain bounded implementation approximations at or below 700 ms. Catalog, PDP, collection, cart, and admin routes receive no cinematic-scene controls. Under reduced motion and below the mobile breakpoint, the home route returns to normal document flow and static final scene states.

### Prototype opening state — 2026-08-30

The Figma prototype starts at [`66:6339`](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta?node-id=66-6339): an isolated centered Delta logo on charcoal. The design context supplies no exported keyframe track for its prototype handoff. The home route therefore shows that source mark once per browser session, with one bounded scale/opacity settle before revealing the hero. It never receives pointer events, is skipped under `prefers-reduced-motion`, and is documented as an implementation approximation rather than an authored Figma timeline.

### Prototype MCP availability blocker — 2026-08-30

The approved home interaction source is the [Delta prototype](https://www.figma.com/proto/6zqT0W5qCdhBpVEGEu6G3i/Delta?node-id=64-5965&t=kgUcv3geNTskdtYo-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=66%3A6339), rather than the vertically composed `Full` MP4. Signed-in browser playback was inspected at the logo opening, hero, engineered, and product-philosophy frames. It visibly confirms a charcoal hero-to-engineered handoff and a vertical engineered-to-philosophy handoff.

The discoverable Figma wrappers for file `6zqT0W5qCdhBpVEGEu6G3i` still resolve to an unavailable underlying endpoint. The philosophy frame's Circles vector and precise prototype keyframes therefore remain unavailable; implementation proceeds from browser-observed source order and labels timing as approximate.
## Prototype timeline closeout (2026-08-30)

The signed-in Figma prototype at https://www.figma.com/proto/6zqT0W5qCdhBpVEGEu6G3i/Delta?node-id=64-5965 was inspected in-browser. Verified states: opening logo (`66:6339`), hero settled, hero→engineered transition and engineered settled, engineered→philosophy transition and philosophy settled. The available wrappers (`mcp__codex_apps__figma_get_design_context`, `...get_motion_context`, and asset/export wrappers) resolve to an unavailable underlying MCP endpoint, so no MCP keyframes were available. The home implementation uses these browser-observed discrete states in a pinned timeline; timing is intentionally documented as an evidence-backed approximation rather than invented Figma keyframes.

Approved implementation deviation: desktop/tablet use a pinned viewport with deterministic frame state; mobile and `prefers-reduced-motion` render the same content in normal flow. The philosophy frame's orbit/dot vector artwork has no matching local export; the local athlete crop is preserved and the missing vector is recorded as a source gap rather than replaced with generated imagery.

### Prototype timeline map — browser evidence (2026-08-30)

The signed-in prototype was inspected from the exact [prototype root `64:5965`](https://www.figma.com/proto/6zqT0W5qCdhBpVEGEu6G3i/Delta?node-id=64-5965&t=kgUcv3geNTskdtYo-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=66%3A6339), restarting at the [opening logo frame `66:6339`](https://www.figma.com/design/6zqT0W5qCdhBpVEGEu6G3i/Delta?node-id=66-6339). The table records visible states and handoffs only; the prototype browser surface did not expose stable node IDs for the subsequent frames.

| Timeline state | Browser-observed resting composition | Transition evidence captured | Stable node ID / evidence status |
| --- | --- | --- | --- |
| Frame 0 — opening logo | Centered white `DELTA` mark on a charcoal field. It is the first-session opening state and precedes the hero. | Restarted prototype and captured the opening before the hero resolved. The exact logo-to-hero keyframes were not exposed. | `66:6339` — exact opening node supplied by the prototype URL. |
| Frame 1 — hero | Charcoal/black landing composition with top navigation, centered white `DELTA`, beach-runner media, `BUILT FOR THOSE WHO RUN WITH INTENT`, gold `RUN`, supporting copy, and `EXPLORE THE RANGE`. | Hero settled capture confirmed after the opening. Forward keyboard step showed the hero holding briefly before a charcoal handoff into the engineered composition. | Node ID unavailable in browser playback; state belongs to prototype root `64:5965`. |
| Frame 2 — engineered | Charcoal field with `ENGINEERED, NOT JUST STITCHED`, supporting copy, five-athlete image rail, and `SHOP MEN` / `SHOP WOMEN` CTAs. | Forward step from hero: charcoal/blank handoff, then engineered content resolved. Reverse step was not assigned a separate authored track. | Node ID unavailable in browser playback; state belongs to prototype root `64:5965`. |
| Frame 3 — philosophy | Cream field with large front athlete image and a secondary/rear image, orbit/dot artwork, `PRODUCT PHILOSOPHY`, `FUNCTION FIRST ALWAYS`, `EXCESS REMOVED`, and supporting copy. | Forward step from engineered: vertical handoff with philosophy content rising into view; settled capture confirmed the cream composition. | Node ID unavailable in browser playback; state belongs to prototype root `64:5965`. |

**Exact remaining source gaps:** (1) MCP wrappers are discoverable but resolve to an unavailable underlying endpoint, so no design-context or motion keyframes were returned; (2) browser playback exposes no stable node IDs for hero, engineered, or philosophy states beyond the supplied root/opening IDs; (3) the logo, hero, and engineered-to-philosophy transition timings/easing are therefore not authoritative; (4) the philosophy orbit/dot vector has no valid local export or static resting-frame artifact; (5) no prototype mobile/tablet frame or breakpoint behavior is supplied; and (6) no independent browser export exists for the transition start/intermediate states. The local implementation may preserve the observed state order and handoff direction, but must label any timings as approximations and must not present them as Figma-authored values.

## Home corrective rebuild — 2026-08-31

The signed-in prototype was re-inspected in browser from [root `64:5965`](https://www.figma.com/proto/6zqT0W5qCdhBpVEGEu6G3i/Delta?node-id=64-5965&t=kgUcv3geNTskdtYo-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=66%3A6339). In addition to the earlier opening, hero, engineered, and philosophy evidence, the remaining visible prototype frames were confirmed:

| Verified state | Source-visible composition | Local implementation status |
| --- | --- | --- |
| Three tests | Inverse field; `EVERY PRODUCT MUST PASS THREE TESTS`; supporting line; large `MOVES WITHOUT RESTRICTION`. | Restored as the `tests` frame. The source-square ornament is omitted because no exact vector export is local. |
| Newsletter + footer | Cream newsletter block with `STAY IN THE LOOP`, `NO FLUFF. JUST DROPS.`, static email/Subscribe treatment; inverse footer beneath it. | Restored together as the prototype’s final `newsletter-footer` frame. Email capture remains visual-only because marketing/email integration is out of scope. |

The home route now contains the browser-verified five-frame sequence: `hero → engineered → philosophy → tests → newsletter-footer`. Desktop uses native-scroll deterministic forward and reverse frame presentation; mobile/tablet and reduced motion use normal document flow. The prior three-frame overlap implementation was removed, and its tests were replaced with coverage for the verified five-frame sequence.

Documented visual deviations remain source gaps, not substitutions:

- The philosophy orbit/dot vector has been **removed**; no CSS recreation remains. The paired rear image uses an existing original Figma crop, but the exact orbit asset is still absent.
- The Three Tests square motif is also omitted pending its exact vector export.
- No mobile/tablet Figma prototype frames exist. Below 1024 px the verified desktop content is stacked in source order with unchanged copy, source imagery, visible cart access, and 44 px controls.

## Homepage source-backed implementation — 2026-08-31

Implemented from `design-reference/exports/home/home-desktop-1440.png` (node `142:4326`, PNG 1440 × 4700, `authoritative`). Section boundaries were re-derived from the export by background-transition scan: hero 0–940, engineered 940–1880, philosophy 1880–2820, tests 2820–3760, newsletter 3760–4195, footer 4195–4700. **940 × 5 = 4700**, confirming the five-frame sequence already recorded in the prototype timeline map. Every value below was measured from that raster; nothing was taken from the inaccessible prototype.

### Approved decisions applied

1. **Corner radius.** The landing composition is not square. Measured by corner-inset profile: `--radius-control: 8px` (hero CTA, both engineered CTAs, newsletter combo, athlete cards, tests squares — all return an identical profile), `--radius-media: 12px` (philosophy photo cards), `--radius-panel: 24px` (hero metrics panel). `--radius-sm/md/lg` stay `0px`: catalog and PDP keep the square system their own exports back.
2. **Scroll model.** Native wheel with the owner-approved pinned deck is retained, matching the passing `tests/timeline.spec.ts` and the 2026-08-31 corrective rebuild. The older "prevents continuous wheel scrolling" note at line 155 is **superseded** and should not be implemented.
3. **Eyebrow contrast — accessibility deviation.** The source eyebrow measures `#d79a12` = **2.22:1** on `#f3f3f3`, failing WCAG AA at every size; the previously shipped `#b17b00` = **3.32:1**, also failing. Both light-surface eyebrows now use `--color-eyebrow: #8a5f00` = **5.09:1** (4.85:1 on the warm glow), which is the existing `--color-focus` value and holds the source hue (41.3° vs 41.4°). `design.md` makes accessibility override the frame. On the dark tests panel the source amber passes at 7.62:1 and is **not** substituted.

### Corrected tokens

`--color-ink` `#101114` → **`#131417`** (measured pure across engineered, tests and footer). `--color-ink-soft` `#4f5053` → **`#555658`**. `--page-gutter` now `clamp(1rem, 4.45vw, 4rem)`, reaching the measured 64px at 1440 instead of 57.6px. Added a measured body type scale (`--text-sm` 16 / `--text-label` 17 / `--text-md` 18 / `--text-body` 20 / `--text-lead` 24 / `--text-metric` 74px, `--leading-body` 1.28), replacing part of the previous 56 raw `font-size` declarations. Added `--space-5` (which `globals.css` already referenced against an undefined token) and `--space-10`.

### Elements newly rendered

- **Hero metrics panel** — 1312 × 194, 24px radius, 1px `#8e8e8f` border, `rgb(0 0 0 / 0.24)` fill, three columns. `.landing-proof` existed in CSS but had no markup and every declared value was wrong.
- **Tests square groups** — two groups of three overlapping squares on a measured 28.7%/30% step, inset 80px from their corners, middle square amber-filled. Replaces the orphaned `.landing-graphic`.
- **Tests corner arcs** — hairline concentric rings, top-right.
- **Footer SUPPORT column and copyright** on the home route; the `compact` prop dropped both. The `compact` machinery is now deleted.
- **Footer DELTA watermark** — measured 128px cap, `#1f2023`. Scoped to the landing footer only.
- **`@keyframes home-intro-mark-arrive`** — referenced at `globals.css:109` but never defined, so the opening-mark settle never ran. Timing is an approximation, not a Figma value.

### Statement gradient — corrected reading

`MOVES WITHOUT RESTRICTION` is a single continuous `#ffffff → #d89c12` horizontal ramp across the whole two-line block. Both lines return identical RGB at identical x, and the treatment is **pixel-identical across all four timesteps of `figma-full-142-4326.mp4`** — it is a static gradient fill, not an animation, and no word is coloured on its own. The previous `<em>`-wrapped flat amber on "without" was a three-tone approximation and has been removed.

### Deviations and remaining source gaps

- **Condensed display typeface — unresolved.** Headline cap heights are measured (h1 65, engineered 69, philosophy 54, tests 60, newsletter 59, statement 59, watermark 128) but cap height cannot be converted to a font-size without the face. All headlines keep the existing `Outfit`-first stack, and **`Outfit` itself is still never loaded** — no `next/font`, no `@font-face`, no font file in the repo. Line *pitch* is pinned to the measured px where it is transferable (hero 110, philosophy 80, statement 101). Consequence visible in the browser: the philosophy headline wraps to four lines where the source uses three.
- **Footer brand lockup.** The export shows a mark-only bolt+triangle at 61 × 64. No such export exists locally and its ratio does not match any subset of `delta-logo.svg`, so the full wordmark is retained rather than fabricating an asset. **Export required.**
- **Wishlist icon not added.** The export's header carries search + heart + bag; only search + bag ship. No wishlist feature exists, so the control would be a dead affordance. Requires a product decision, not a visual one.
- **Hero metrics values** (`4.8`, `98%`, `5 Yr`) are read from the export and are unverified commercial claims, still covered by open decision 4 above.
- **Tests frame gutter** is 80px against 64px everywhere else; applied desktop-only.
- **Philosophy glow and tests arc geometry** are fitted approximations — centres, peak colour and ring spacing are measured, but a raster cannot separate a two-stop radial with Figma easing from a multi-stop ramp.
- **Letter-spacing and font weights** are unchanged: the raster cannot resolve them.
- **Hover, focus, active and transition timings** remain unimplemented — no source export exists. Excluded from this pass.
- **Responsive below 1440 is derived, not source-backed.** No frame exists at any narrower width. Two derived rules are recorded here: the athlete rail becomes a scroll-snap carousel below 48rem (the measured 49:63:80:63:49 ratio yields unreadable 41–67px cards at 320), and the tests decorative squares scale down so the 80px desktop inset stops crowding the copy.

## Homepage fidelity pass 2 — measured overlay against the desktop export — 2026-08-31

Method: Chromium at exactly 1440 × 940, one screenshot per settled frame, composed into a 1440 × 4700 raster and differenced against `design-reference/exports/home/home-desktop-1440.png`. The looping hero video is removed before capture — the export is a still, so leaving it in diffs an arbitrary video frame rather than the poster crop.

Mean absolute per-pixel difference by band (0–1, lower is closer):

| Band | Before | After |
| --- | --- | --- |
| hero | 0.1281 | **0.0502** |
| engineered | 0.1017 | **0.0774** |
| philosophy | 0.0702 | **0.0381** |
| tests | 0.0775 | **0.0568** |
| newsletter + footer | 0.0402 | **0.0278** |

### Typography — the source face is condensed, and Outfit was never delivered

`document.fonts.check('16px Outfit')` returns `true` in Chromium even for a nonexistent family, so it is not a usable signal. Rendering `Outfit` and `__NoSuchFont__` produced identical widths (1183.02px), proving **Outfit was neither installed nor shipped**: the declared stack fell through to a system face measuring ~25% wider per unit cap height than the export.

Both faces are now self-hosted through `next/font` (part of `next`; no new package, no runtime request).

The export uses **two** display faces, measured by advance per unit cap height:

- Section headlines ≈ **0.59** per character — condensed.
- `MOVES WITHOUT RESTRICTION`, body, buttons, nav and metric numbers ≈ **0.83–0.90** — geometric, consistent with Outfit.

Twelve candidates were ranked against five headline strings measured from the export (`ENGINEERED, NOT JUST STITCHED` 955 × 68, `EVERY PRODUCT MUST PASS THREE TESTS` 1214 × 59, `BUILT FOR THOSE WHO` 726 × 65, `FUNCTION FIRST` 416 × 53, `NO FLUFF. JUST DROPS.` 667 × 60):

| Candidate | mean relative width error |
| --- | --- |
| **Oswald 600** | **3.83%** |
| Oswald 700 | 5.63% |
| Barlow Condensed 700 | 7.69% |
| Fjalla One | 9.01% |
| Archivo Narrow 700 | 31.28% |
| Outfit 800 | 50.31% |

**Oswald 600 is the documented substitute for display headlines. This is NOT the source face and the typography is NOT Figma-faithful.** The true face is unidentified — no artifact available names it. Small negative tracking (−0.013em to −0.015em) is applied on the two longest headlines to reconcile Oswald's residual width against the measured block widths; every other headline uses normal tracking.

Correction to the previous pass: an earlier ranking put Outfit first. That comparison measured a 15-character substring against a target derived from all 29 characters of a headline that is **one line, not two**, and is withdrawn.

### Other corrections in this pass

- `text-wrap: balance` (`globals.css:100`, all `h1,h2,h3`) was overriding the source's line breaks — the philosophy headline rendered "FUNCTION" alone instead of "FUNCTION FIRST". Landing headlines now set `text-wrap: wrap`. (`text-wrap: normal` is not a valid value and is silently ignored.)
- Hero copy sat 45px low: the CTA-to-metrics-panel gap measured 118px in the export against 74px live. H1 ink now lands at y277–343 against the export's 277–341.
- Tests frame restored to its measured 80px inline padding — the one gutter outlier — desktop only.
- Header nav `letter-spacing` 0.1em → 0.02em; the export's nav measures as Outfit at ~15.5px with near-zero tracking. All three items now land within 6px.

### Verified exact

Hero background media scores **0.0049** — poster crop, `object-fit: cover` centring and the five-stop scrim gradient all match. The athlete rail is positionally exact (196/252/320/252/196 at x 64/284/560/904/1180 on one centre line). The metrics panel measures 1312 × 195 at x64/y721 against the export's 1312 × 194 at x64/y722. Philosophy media is 458 × 636 at x64. Brand mark is 112 × 28 at x664.

### Remaining source limitations

- The condensed display face is a substitution, not the source face.
- The header **heart/wishlist icon is omitted** — no wishlist feature exists and adding one is out of scope. This is the single largest remaining pixel difference: it removes a 44px control and shifts search and bag ~68px right of their measured centres.
- Athlete-card and philosophy-card photo crops differ inside geometrically exact frames; `object-position` for each source image is not recoverable from a flat raster.
- The philosophy orbit rings and node dots remain omitted per the standing owner decision.
- Letter-spacing, font weights, hover/focus/active states and transition timings remain unresolved from a raster.
- Responsive behaviour below 1440 remains derived; no source frame exists at any narrower width.

## Homepage fidelity pass 3 — measured overlay, recovered photo crops, named motion — 2026-09-01

### Measurement protocol

Dev server on port 3210 (3000 is held by an unrelated process). Five frames captured at exactly 1440 × 940, one per settled frame, with `document.querySelectorAll('video').forEach(v => v.remove())` before each shot so the comparison is against the static poster, not a random video frame. Frames composed to 1440 × 4700 and diffed per band against `design-reference/exports/home/home-desktop-1440.png`. The video is removed only in the capture; it is untouched in source.

Section boundaries re-verified in the live composite: the newsletter/footer split lands on the export's 4195 exactly (light `#f3f3f3` through y4194, `#131417` from y4195), and each frame occupies its 940px band by construction.

### Per-band mean absolute difference (0–1, lower is closer)

| Band | Pass 2 | Pass 3 | Change |
| --- | --- | --- | --- |
| hero (0–940) | 0.0502 | 0.0502 | — (out of this pass's scope) |
| engineered (940–1880) | 0.0774 | **0.0500** | −35% |
| philosophy (1880–2820) | 0.0381 | 0.0381 | — (out of this pass's scope) |
| tests (2820–3760) | 0.0568 | **0.0309** | −46% |
| newsletter + footer (3760–4700) | 0.0278 | **0.0138** | −50% |

Per-region ranking after the pass: hero header/nav 0.1405, hero headline+CTA 0.0908, engineered headline+copy 0.0897, philosophy card stack 0.0797, tests headline+statement 0.0733, engineered athlete rail 0.0725, hero metrics panel 0.0607, philosophy copy 0.0572, newsletter block 0.0266, engineered CTAs 0.0253, footer identity+watermark 0.0190, footer columns 0.0138, tests squares BR 0.0126, tests squares TL 0.0105, hero background media 0.0049.

### The athlete rail is not a `cover` crop — correction to pass 2

Pass 2 recorded the per-card photo crops as "not recoverable from a flat raster". That is withdrawn. They are recoverable, and the reason `object-position` alone could not express them is that **the crops are zoomed past `cover`**: a Figma image fill carries an independent scale, which `object-fit: cover` fixes at the smallest scale that fills the box.

Recovery method: for each card, the export's card rectangle was scanned against the source PNG over (painted width × vertical offset), horizontal placement pinned to centre — a constraint the two unambiguous cards independently confirm (bodybuilder 49.9%, day-runner 50.2% on a free-x search). The minimum mean absolute difference was kept.

Per-card measured result, inside frames that were already positionally exact:

| Card | before | after | painted width vs `cover` | verdict |
| --- | --- | --- | --- | --- |
| bodybuilder | 0.1295 | **0.0176** | 1.20× | recovered, unambiguous |
| day-runner | 0.2334 | **0.0848** | 1.35× | recovered, unambiguous |
| skip-rope | 0.2128 | **0.1407** | 1.28× | recovered |
| gym-man | 0.1518 | **0.1495** | 1.33× | recovered, low confidence — the improvement is real but small (1.5%) |
| night-runner | 0.1996 | 0.1999 | — | **unresolved** |

`night-runner` is left at its `cover`-equivalent numbers. Its search never escaped a dark local minimum (a night photograph gives a flat, near-black region that scores well against anything dark); every candidate that scored better than `cover` rendered as a visibly wrong close-up of the runner's head. No crop is claimed for it.

The mechanism is now explicit in the markup rather than implied: each rail photo sits in its own 13:18 clip box, with `--crop-w` (painted width as a share of the card) and `--crop-y` (the image's top edge as a share of the card height) carrying the recovered numbers.

### Engineered — other measured corrections

- The deck copy wrapped at a 1159px first line against the export's 1037px, starving the second line. A 66rem header-copy box reproduces the export's break exactly: both lines now measure x201–1237 (1037px) and x528–911 (384px), identical to the export.
- The copy's first ink row sat at y1175 against the export's y1185; its top margin now carries the measured 10px, and the rail's own margins absorb the resulting row-height change so the rail stays on its measured centre line (verified: per-card scores unchanged after the shift).
- The headline is already exact (x243–1197 vs x243–1198) and the CTA pair is exact (x443–996, y1756–1807).

### Tests — measured corrections

- **Amber square fill.** The export's diagonal profile through the filled square rises monotonically to a plateau at alpha ≈ 0.20 and is iso-valued along the anti-diagonal — a 135° linear ramp, not the `radial-gradient(circle at 70% 70%, … / 0.55)` previously implemented, whose peak measured alpha ≈ 0.52 against the export's 0.20. Region scores: TL 0.0598 → 0.0105, BR 0.0430 → 0.0126. The square *geometry* was already exact in both (y2938–3064, x80–279).
- **Vertical rhythm.** The block is bottom-anchored and its last line was already within 1px, but the two internal gaps were wrong: headline-bottom to copy-top measured 31px against the export's 68px, and copy-bottom to statement-top 119px against 64px. Both margins now carry the measured values. Result: headline y3162 (export 3171), copy y3293 (3298), statement line 1 y3380 (3383), line 2 bottom y3539 (3542).
- **Statement size.** Ink width measured 719px / 547px against the export's 675px / 511px — a consistent 0.936 ratio at unchanged 101px line advance. Size scaled by that ratio; both lines now measure 675px and 513px against 675px and 511px.
- **Headline tracking** tightened −0.013em → −0.0165em against a 9px measured width excess.

### Newsletter and footer — measured corrections

- Eyebrow ink measured 225px wide against the export's 208px; scaled by that ratio it now measures 207px at x616–822 against the export's x616–823.
- The three ink gaps down the centred newsletter block (eyebrow→headline, headline→copy, copy→form) were each short. With the measured values applied, all four rows land within 1–2px: eyebrow y3848 (export 3847), headline y3904 (3905), copy y3998 (3999), form y4063 (4064).
- The footer blurb wrapped in three lines because a `31ch` box under the body face is narrower than the export's 388px lines. A measured 25rem box reproduces the export's two-line wrap: 387px and 385px against 388px and 388px.

### Still unresolved after this pass

- **`night-runner`'s photo crop.** Recorded above; no crop claimed.
- **The footer lockup is still the wordmark, not the export's 60px mark.** No such asset exists locally. Its box now carries the measured 60px mark height, and the address block carries the export's measured blurb-to-address gap, but the address rows still land ~10px above their measured rows — a residual of the substitute mark's own height, not of the layout.
- **A consistent ~4px left offset on all tests-band text.** The decorative squares are pixel-exact at x80, so this is the display face's left side bearing, not the 80px inline padding. Shifting the padding to hide it would fit a substitute-font artifact into a measured box, so it is left alone.
- **The tests headline still sits ~9px above its measured row.** Roughly half is the substitute face's larger ink height at the same baseline (64px vs the export's 60px cap); the rest is unexplained.
- **Hero (0.0502) and philosophy (0.0381) were out of this pass's scope** and are unchanged. The hero header/nav region (0.1405) remains the single largest region difference, driven by the deliberately omitted wishlist control recorded in pass 2.
- The condensed display face is still **Oswald 600, a documented substitute. The typography is not Figma-faithful** and no measurement in this pass changes that.

### Named motion definitions

The existing motion is now named by intent rather than scattered across ternaries and ad-hoc selectors. **No animation dependency was added**; everything is the existing rAF scrub controller, CSS custom properties and CSS transitions.

- **Frame-level scrub** (`home-scene.tsx`): the per-frame translate magnitudes moved out of inline ternaries into one `FRAME_MOTION` table keyed by frame id, with `exit` and `enter` percentages. Values are unchanged, so the deck behaves identically.
- **Element-level intents** (`home-motion.tsx` + `globals.css`): `heroEntrance`, `sectionReveal`, `athleteRailReveal`, `philosophyCardEnter`, `testsReveal`, `footerReveal`. Each is defined exactly once, under `[data-motion="<intent>"]`, and applied through `homeMotion(intent, index)`.

Contract, verified in a browser:

- Every intent animates **transform and opacity only**.
- Every animated element has a **stable resting state** — `opacity: 1; transform: none` — which is also its server-rendered state.
- The entry state is keyed off the frame's own `data-frame-state`, so under `prefers-reduced-motion`, where every frame is permanently `settled`, the resting state is what renders. Measured at 1440 under reduced motion: `data-home-motion="flow"`, stage `position: static`, no intro element, no `<video>` element, all five frames at `opacity: 1` / `transform: none`, and all fourteen `[data-motion]` elements at `opacity: 1` / `transform: none` / `transition-duration: 0s`.
- Durations, offsets and the 55ms stagger are the project's existing reveal values (`.motion-reveal--editorial` 650ms / 1.5rem, `.motion-reveal--cards` 560ms / 1.25rem / 55ms). **No new timing was invented.**
- `data-home-timeline`, `data-home-stage`, `data-settled-frame`, `data-prototype-frame`, `data-frame-state` and `data-scroll-progress` are unchanged. The named-motion work is visually inert at rest: the per-band scores were identical before and after wiring it in.

### Verification

`typecheck`, `lint`, `test` (5 suites / 20 tests), `db:check` and `build` all exit 0. Playwright: 22/22 on repeated full runs, with one intermittent exception — `tests/timeline.spec.ts` "wheel input remains native…" fails roughly 3/20 runs. It is **not** caused by this pass: with the named-motion entry-state rule disabled the rate was 5/20, statistically the same. The test wheels the page and then waits a fixed 200ms for a value that only updates after hydration attaches the rAF-throttled scroll listener; the sibling tests in the same file already replaced fixed waits with a polled `waitForFunction`, and this one did not. Reported rather than worked around, since `tests/` is outside this pass's ownership.

Accessibility and robustness re-checked in a real browser at 320 / 375 / 768 / 1024 / 1440: `document.documentElement.scrollWidth === window.innerWidth` at every width, zero console errors at every width, and a visible focus outline on each of the first eight tabbables at every width. Hero video with motion allowed: element present, `paused: false`, `muted`, `loop`, playing `hero-run.mp4`.

### Reverse-scroll E2E flake — root cause and fix (2026-09-01)

The flake was not in the reverse test's logic; it was in `openDesktopTimeline`. `waitForInterpolationSettled` compares the rendered `data-scroll-progress` against what the live scroll position implies — and at rest, before any scroll, those already agree at `0`. The server-rendered attribute satisfies the check with no JavaScript attached at all, so the helper returned on an unhydrated page and every millisecond of hydration latency was pushed into the *first* `scrollToProgress` call's 5s budget. On a cold compile or a loaded machine that budget is not enough, and the first scroll — `0.75` in the reverse test — times out.

Reproduced deterministically with `Emulation.setCPUThrottlingRate` at 30×:

```
PROBE open: {"expected":0,"rendered":"0.0000","y":0}
PROBE 0.75 (5911ms): {"expected":0.75,"rendered":"0.0000","frame":"hero"} TimeoutError: Timeout 5000ms exceeded
```

The controller now publishes the state the test actually needs: after the scroll and resize listeners are attached, the effect sets `data-timeline-ready="true"` on `[data-home-timeline]` directly on the node (the attribute renders as `"false"`, flips once, and React never touches it again because its own value for it never changes). `openDesktopTimeline` waits for that attribute before it scrolls.

Same probe, same 30× throttle, after the fix — and the assertions, the tolerance and the 5s settle timeout are all unchanged:

```
PROBE 0.75 (868ms):  {"expected":0.75,"rendered":"0.7500","frame":"tests"}
PROBE 0.48 (380ms):  {"expected":0.48,"rendered":"0.4800","frame":"philosophy"}
PROBE 0.75 (333ms):  {"expected":0.75,"rendered":"0.7500","frame":"tests"}
```

The same hole affected the wheel test, which shares the helper; it is closed there too. Verification after the change: `typecheck`, `lint`, `test` (5 suites / 20 tests), `db:check` and `build` all exit 0; Playwright 22/22 on the full suite and 30/30 on `tests/timeline.spec.ts` at `--repeat-each=6`.

Migration-journal note — corrected. An earlier draft of this section said the non-empty journal meant `drizzle-kit check` "is validating real migrations". That is wrong, and the correction is measured, not argued. `db/migrations/meta/_journal.json` does now carry `0000_initial_foundation` and `0001_rls_tenant_isolation`, but `npm run db:check` never reads the `.sql` files at all: copying the migration folder, deleting `0001_rls_tenant_isolation.sql` from the copy — every RLS policy, the `current_tenant_role` helper and every GRANT — and running `drizzle-kit check --out` against it still prints `Everything's fine`. So does pointing a journal entry at a migration tag that does not exist. `db:check` compares the `meta/*_snapshot.json` graph against itself; nothing more.

Schema drift is a separate question and it is currently clean: running `drizzle-kit generate` against `src/server/db/schema.ts` with the existing snapshots reports `No schema changes, nothing to migrate`, so the drizzle-generatable half of the schema matches its snapshots exactly. The hand-written half — RLS policies, GRANTs, the SECURITY DEFINER helper, the plpgsql triggers, the composite FK, `CREATE EXTENSION pgcrypto` — is in no snapshot and is covered by no check at all.

## Homepage SSR/inert pass — progressive-enhancement deck — 2026-09-01

### The defect

Frame visibility, `aria-hidden` and `inert` were derived from React state that only exists after hydration, so the server-rendered document was wrong on every viewport. Measured with JavaScript disabled at both 375 and 1440: **12 of 14 `[data-motion]` wrappers computed to `opacity: 0`** (7 engineered, 2 philosophy, 1 tests, 2 newsletter-footer) and **4 of 5 frames carried `inert` + `aria-hidden`**. On mobile the two states contradicted each other — CSS painted all five frames at full opacity while four were withheld from assistive technology. Hydrated at 1440, the document offered 22 tabbable elements and Tab reached four before leaving the page; focusing the hero CTA and scrolling blurred it to `<body>`; the header's own `#philosophy` and `#contact` anchors moved the page 0px and 416px respectively without changing the settled frame.

This also caused the last remaining E2E flake: `tests/timeline.spec.ts` "mobile uses normal document flow" failed 2/3 under 20× CPU throttle with `expected "flow", received "scrubbed"`, because the correct value only existed after hydration.

### The fix

The deck is now progressive enhancement rather than the default. `HomeSceneController`'s flow flag initialises to `true`, so the server — and any client that never hydrates — renders `data-home-motion="flow"`, every frame `data-frame-state="settled"`, and the resting presentation. `syncPreferences()` promotes it to the scrub on the first client frame.

`aria-hidden` and `inert` were removed from `HomeScene` entirely. `visibility: hidden` was evaluated as the alternative and rejected: it fixes the mobile contradiction but removes frames from sequential focus order exactly as `inert` did, so Tab still dead-ends after the hero and a Tab-interception state machine would be needed to advance the deck at the boundary. Instead the deck is a purely visual layer — all five frames stay in the accessibility tree and the tab order at all times, and a `focusin` listener on the root scrubs the deck to whatever frame the user focused. Focus moves first and the deck follows, which is what browsers do natively for off-screen focus; a plain scroll never moves focus.

The flow-layout CSS block moved from `@media (max-width: 63.99rem), (prefers-reduced-motion: reduce)` to a `[data-home-motion="flow"]` prefix on the same 22 selectors, declarations and order unchanged. One attribute selector expresses all four flow cases — mobile, reduced motion, pre-hydration and scripting-off — where a media query can only express two. Every gated selector is homepage-scoped; no catalog, PDP or cart rule is affected.

Header fragment links now call `scrollToHomeFragment`, which converts a fragment's owning frame into a page offset, because the frames are absolutely positioned inside a sticky viewport and `scrollIntoView` computes a near-zero delta for anything inside them. It returns `false` when the deck is not driving the page, leaving native anchor behaviour alone in flow and with JS off.

### Measured, before and after

| Measurement | Before | After |
| --- | --- | --- |
| no-JS 375 / 1440: `[data-motion]` wrappers at `opacity: 0` | 12 / 14 | **0 / 14** |
| no-JS 375 / 1440: frames with `inert` or `aria-hidden` | 4 / 5 | **0 / 5** |
| no-JS 375 / 1440: sections rendering real copy | 1 / 5 | **5 / 5** |
| hydrated 1440: tab stops reachable | 4 of 22 | **21 of 22** (the 22nd is the mobile menu button, `display: none` at desktop) |
| focus hero CTA, scrub to 30% | `activeElement` = `BODY` | **focus retained** |
| header `#philosophy` | 0px, settled `hero` | **1800px, settled `philosophy`** |
| header `#contact` | 416px, settled `hero` | **3600px, settled `newsletter-footer`** |
| reduced motion 1440 | 5/5 frames and 14/14 `[data-motion]` at rest | **unchanged** |
| per-band fidelity vs the export | 0.0501 / 0.0499 / 0.0374 / 0.0308 / 0.0137 | **identical, delta 0.0000 on all five** |

### Tests

`tests/home-deck-a11y.spec.ts` adds 10 tests: section visibility and assistive-technology exposure with JavaScript disabled and again pre-hydration (only `/_next/static/chunks/*.js` aborted, CSS kept, gated on `data-timeline-ready="false"` so it cannot silently run against a hydrated page), a tab walk whose expected frame set is derived from the live DOM rather than hardcoded, focus retention across a frame change, and honest timeline state at 320 and 375 under 20× CPU throttling — recorded by a document-start `MutationObserver` so a value that is only correct after hydration cannot hide behind an auto-retrying matcher.

Teeth were verified by reverting the single line that caused the defect: **6 of the 10 fail**, including both throttled tests and every no-JS visibility test.

Making the server render the honest value had a side effect worth recording: four existing assertions became satisfiable by the raw HTML. `tests/timeline.spec.ts` (mobile flow, reduced motion) and `tests/storefront.spec.ts` (mobile flow, reduced motion) now wait for `[data-timeline-ready="true"]` before reading those values, so they prove the controller ran rather than that the markup shipped. No assertion, tolerance or timeout was weakened.

### Verification

`typecheck`, `lint`, `test` (5 suites / 20 tests) and `build` all exit 0. Playwright **32/32**, and **256/256** at `--repeat-each=8`. All five routes clean at 320/375/768/1024/1440 with zero console errors, except a pre-existing ~4px horizontal overflow on the PDP at 320/375 traced to `.variant-fieldset` / `.color-options` — untouched by this pass and unrelated to it.

### Known, accepted, not fixed in this pass

- With the deck active, a focused element can sit at `opacity: 0` if the user mouse-scrolls away from it. Focus is retained; the focus ring is invisible until they scroll or tab again. The alternatives are moving focus on scroll (hijacking) or a `:has(:focus-visible)` override that would break the crossfade.
- On desktop with JavaScript enabled, the page paints in flow for the hydration window and then collapses into the deck. That flip is the cost of an honest pre-hydration state; removing it needs a blocking inline script.
- `storefront-footer.tsx`'s own `/#contact` link still targets a frame it lives inside, so it is a no-op on the home page.
- The context field is still named `reducedMotion` while it now means "not scrubbing" — it reads `true` for a user who has not asked for reduced motion. Renaming touches three consumers and was left out of a pass scoped to one defect.
