# Public storefront route inventory

Status reflects the owner-approved public storefront sprint on 2026-08-30. Desktop catalog, PDP, and cart-drawer frames remain the exact visual sources; home, collections, search, footer, and responsive layouts are documented approved deviations.

| Surface | Route | Source / deviation status | Implementation status | Remaining source gap |
| --- | --- | --- | --- | --- |
| Home | `/` | Approved inferred composition using authoritative local logo and PDP imagery | Implemented | No final landing frame; Circles motion deferred |
| Catalog | `/shop` | Exact 1440 catalog structure from Figma layer 10; URL search/filter/sort are approved behavior additions | Implemented | Only one authoritative product/image family exists |
| Collection | `/collections/[handle]` | Approved inferred catalog variant | Implemented for derived `all` collection only | No authored collection campaigns or additional collection data |
| Product detail | `/products/[handle]` | Exact 1440 PDP structure from Figma layer 14; unverified reviews/promotions/policies omitted | Implemented | Original source images, authored zoom, size guide, and verified commerce facts unavailable |
| Cart drawer | Shared modal state | Exact 1440 open state from Figma layer 13; accessible focus behavior added | Implemented | Checkout intentionally omitted |
| Cart page | `/cart` | Approved inferred review surface reusing the cart contract | Implemented | No checkout, shipping, tax, or payment summary is approved |
| Navigation/footer | Shared shell | Desktop header source-backed; mobile menu/footer are approved deviations | Implemented | No complete authored footer or mobile navigation frame |
| Route states | Route-local loading/error/empty/no-results/not-found | Approved accessibility/resilience deviations | Implemented where applicable | Deterministic database failure injection remains a future test seam |
| Circles motion | Deferred brand surface | Invalid 1×1 diagnostics only | Not implemented | Valid authored motion and resting frame required |
| Checkout/accounts/admin/policies | Out of scope | No approved product/design contract | Not implemented | Explicit future approval and source material required |

Development seed content remains clearly non-production. The application must not imply that sample price, currency, variant availability, or imagery establishes live commercial inventory or policy.
