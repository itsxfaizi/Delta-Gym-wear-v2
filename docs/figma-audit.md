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
