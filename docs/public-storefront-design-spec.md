# Public storefront design handoff

**Status:** implementation handoff for the owner-approved public storefront expansion on 2026-08-30. It is constrained by the local reference pack; it does not claim missing Figma frames, assets, interactions, or commerce policy are authored.

## Evidence and source hierarchy

1. **Authoritative exact desktop composition:** `catalog-desktop-1440.png`, `product-detail-desktop-1440.png`, and `catalog-cart-drawer-desktop-1440.png` (all 1440 px wide) in `design-reference/exports/`.
2. **Authoritative reusable assets:** the vector marks, icon SVGs, and component-crop exports listed in `design-reference/manifest.md`. Use them as files; do not redraw them.
3. **Approved inferred layout:** home, collections, search presentation, footer, and 320/768/1024 behavior. These have no local source frame and must remain visually subordinate to the exact desktop evidence.

No implementation should treat sample names, PKR prices, reviews, discounts, returns, delivery timing, or checkout language visible in the exports as approved policy or final content.

## Evidenced semantic foundation

Only the following tokens have exact values in the audit. Retain their semantic aliases rather than scattering literals; all other colour, spacing, radius, grid, and breakpoint values need an implementation decision because no corresponding Figma variables/styles were captured.

| Semantic token | Exact local/Figma evidence | Use |
| --- | --- | --- |
| `--color-surface` | `Neutral/50` = `#FFFFFF` | Main page and drawer surface |
| `--color-surface-subtle` | `Charcoal/50` = `#F3F3F3` | Quiet surface candidate only |
| `--color-ink` | `Charcoal/500` = `#131416` | Primary text, marks, icon strokes |
| `--color-ink-strong` | `Charcoal/900` = `#060607` | High-emphasis/inverse candidate |
| `--color-neutral-strong` | `Neutral/900` = `#353535` | Secondary text/border candidate |
| `--color-accent` | `Gold/500` = `#FDB515` | Primary commerce CTA and brand accent; verify contrast for each text pairing |

The evidenced family names are `Charcoal/50…900`, `Gold/50…900`, and `Neutral/50…900`; no unrecorded shade values may be inferred. Use `Outfit` only once web-font delivery/licensing is confirmed. The export/audit evidences Regular, Medium, SemiBold, and Bold at 12, 14, 16, 18, 20, 24, and 28 px, but no text-style roles, line heights, or letter-spacing values. Preserve a compact, left-aligned editorial hierarchy rather than inventing a display face or decorative treatments.

## Shared composition

- **Header:** white desktop `Nav / Light` treatment: left text links (`SHOP`, `ABOUT`, `CONTACT US`), centered Delta mark, right icon controls. Use `delta-logo-dark.svg` (112 × 28) for catalog/header fidelity; use `delta-logo.svg` (294 × 73 viewBox) only where a larger public brand mark is needed. Search, favourite, and bag use their matching authoritative SVGs. The bag’s filled glyph is the populated state.
- **Footer (approved inference):** a restrained inverse-charcoal footer with the authoritative mark on white, real route links only, and no invented policy, contact, social, payment, or delivery claims. It is not evidenced as a complete frame.
- **Cards:** `product-card-normal.png` and `product-card-hover.png` remain authoritative comparison crops, but their baked discount/product text is not an approved commercial fact. Production UI therefore uses the source-exported `product-large-normal.png` crop with typed seed title/price; it does not redraw or alter either export.
- **Controls:** preserve visibly square/low-radius outlined size and quantity controls, simple fine dividers, rounded colour swatches, and the solid gold CTA from the desktop PDP. `cta` has evidenced large 138 × 52 and small 129 × 34 variants; states beyond normal/selected/open are accessibility additions.

## Route handoff

| Route | Composition and intent | Source status |
| --- | --- | --- |
| `/` | **One editorial hero signature only:** full-bleed/edge-led portrait product image from `product-large-normal.png`, with an adjacent or overlaid concise brand statement and one primary path to `/shop`. Keep the treatment quiet and product-led: no synthetic gradient, duplicate card grid, new campaign claims, or Circles substitute. Follow with a small editorial collection/navigation section using the same real local crops, then the inferred footer. | Approved inference; landing `Circles` motion/rest frame remains blocked. Product image file is authoritative component crop, not original camera source. |
| `/shop` | Exact desktop catalog structure: shared header; left filter rail; compact `All Products` context; Featured control; three-column product grid. Category tabs without typed data are omitted. Search is integrated into the rail and shares the URL with supported size/colour/sort fields. Use the exact dark header logo and only source crops without unverified baked promotions. | Desktop exact at 1440; search/filter semantics and omissions of unsupported categories are approved data/accessibility deviations. |
| `/collections/[handle]` | A collection-labelled variant of the shop composition: collection heading/context replaces the generic all-products context while retaining product grid, filter entry point, sort, and card treatment. Do not create collection-specific imagery, campaign copy, or unique navigation without assets/content. | Approved inference; category tabs in catalog are the only visual evidence. |
| `/products/[handle]` | At desktop, retain the evidenced two-column PDP and source gallery proportions. Render only typed facts: title, price/currency seed, available colour/size choices, CTA, and description/details when present. Omit unverified rating, discount, size guide, quantity, return/shipping claims, and recommendations. | Exact desktop at 1440; omissions are required by the no-invented-commerce rule. |
| `/cart` | Cart is a right-side overlay drawer over the active page: dimmed backdrop, close icon, `Cart` heading, scrollable cart items, persistent subtotal/action footer. The source drawer is 578 px wide in a 1440 px frame (from x=862 to 1440). Checkout remains visually represented only if the product/business contract allows it; no checkout flow is specified. | Exact desktop open state at 1440; route/persistence/checkout behavior inferred or deliberately deferred. |

## Responsive rules (approved inferred behaviour)

| Width | Shell and discovery | PDP | Cart |
| --- | --- | --- | --- |
| **320** | Compact header with visible brand and labelled menu/search/cart controls. One product column. Search, filters, and sort stack inline above the grid as the approved source-gap deviation; controls remain fully visible and at least 44 px tall. Hero becomes a single vertical image-led unit, copy following the image. | One column; image/gallery first, information second; swatches and size choices wrap without horizontal overflow; full-width add-to-cart control. | Full-viewport modal drawer with a persistent footer; item details wrap and controls remain at least 44 × 44 px. |
| **768** | Two-column product grid; header shows only links that fit without collision. Search, filters, and sort remain inline above the grid rather than introducing an unauthoritative sheet interaction. Hero becomes a balanced two-column editorial unit. | Gallery and product details stack, but thumbnail rail may remain horizontal under the primary image. | Width up to 560 px, anchored right; use full width if remaining page is too narrow. |
| **1024** | Three columns only when each card remains readable; otherwise use two. A persistent filter rail is permitted when its content does not compress the grid below its authoritative card proportions; otherwise retain sheet behaviour. Hero is two-column. | Restore the desktop-like two-column PDP, with gallery at roughly half available width and controls beside it. | Right drawer, up to the evidenced 578 px width; background remains visible and inert. |
| **1440** | Follow the authoritative catalog/PDP/cart screenshots: full desktop nav, left filter rail, three-column catalog, 638 × 720 PDP gallery, and 578 px cart drawer. | Exact two-column composition. | Exact right-side drawer and dimmed backdrop. |

Use intrinsic image sizing and `object-fit: cover` only to preserve the supplied component crop; do not attempt to fabricate unknown alternate angles. The hero must not use the invalid 1 × 1 Circles exports.

## Interaction, accessibility, and motion

- Make header links, card links, search, favourite, bag, zoom, plus/minus, close, colour, size, filter, sort, and accordion controls semantic and keyboard operable. Give every icon-only control an accessible name. Heart/favourites remain presentation-only unless their persistence contract is approved.
- Product colour and size are mutually exclusive choices (radio-group semantics); multi-filters use checkboxes. Preserve visible selected state beyond colour alone. Disable/unavailable variants with explanatory text instead of a silent blocked CTA.
- Filter and cart sheets/drawers are labelled dialogs: trap focus, return it to the opener, close on Escape, prevent background interaction, and announce cart/add-to-cart outcomes without moving focus unexpectedly. Provide loading, empty, unavailable, and error states with a recovery action.
- Pointer hover may reveal `product-card-hover.png`/the hover gallery crop, but `:focus-visible` must provide equivalent discoverability. Do not rely on hover on touch devices.
- Use a visible high-contrast focus indicator and 44 × 44 px minimum touch targets where an icon/control would otherwise be smaller. Images need final purposeful alt text; decorative brand/imagery duplicates must be hidden from assistive technology.
- No new decorative motion. For control feedback/entries, use opacity/transform only (120–200 ms controls; 180–280 ms entries). Under `prefers-reduced-motion`, remove nonessential transitions and keep all content static. The authored Circles rotation (2 s, −180° → 0°, ease-out loop) is excluded until its valid asset and resting state are supplied.

## Asset authority map and remaining gaps

| Need | Required local asset / authority | Constraint |
| --- | --- | --- |
| Header mark | `assets/delta-logo-dark.svg` | Exact catalog header mark; authoritative. |
| Larger/public brand mark | `assets/delta-logo.svg` | Source-exported vector mark; clear-space/mobile rules inferred. |
| Legacy raster | `assets/delta-logo-dark-user.png` | User-provided fallback/reference only; do not use when SVG is available. |
| Catalog cards | `assets/product-card-normal.png`, `assets/product-card-hover.png` | Exact complete Catalog crops; only one product identity/crop family exists. |
| PDP/gallery/cart imagery | `assets/product-large-normal.png`, `product-large-hover.png`, `product-small-normal.png`, `product-small-selected.png` | Exact Figma component exports, not original-format product images. |
| UI glyphs | `assets/icons/*.svg` | Exact 24 × 24 exports; provide semantics/states in code. |

Open evidence gaps: distinct product identities; original product files/rights; final alt text; font licence/delivery; mobile/tablet source frames; footer frame/content; collection/search/favourite contracts; filter/sort URL semantics; gallery zoom; cart persistence; checkout, tax, shipping, returns, pricing and review policy; and a valid Circles motion plus reduced-motion resting frame. These must not be silently filled with new visual product behaviour.
