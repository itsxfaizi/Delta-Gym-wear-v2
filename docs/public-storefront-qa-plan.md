# Public storefront QA and accessibility plan

**Release boundary:** public catalog, browser-local cart, and approved guest COD checkout only. No payment gateway, accounts, admin, analytics, email/notification integration, or unapproved policy claims.

| Area | Acceptance evidence |
| --- | --- |
| Home | `/` has one `h1`, authoritative imagery/logo, working `/shop` CTA, mobile menu, and honest metadata. |
| Catalog | `/shop` and `/collections/all` render published server data; `q`, repeated `size`/`color`, and `sort` are bounded, URL-restorable, and produce explicit no-results recovery. Unknown collections return the app-owned not-found state. |
| PDP | `/products/[handle]` has dynamic metadata, safe Product JSON-LD without unverified ratings, gallery controls, supported colour/size choices, unavailable state, accessible error, and add-to-cart outcome. Unknown handles return the app-owned not-found state. |
| Cart | Drawer has a labelled modal, initial close focus, Tab/Shift+Tab trap, Escape/close restoration, 44 px quantity controls, variant details, live announcements, storage failure messaging, and COD checkout access. `/cart` shares the same persistent state. |
| Checkout | `/checkout` blocks empty carts, validates full name, Pakistani mobile, address and city, displays product and configured delivery totals, offers COD only, and never shows a gateway or tax line. |
| Order confirmation | `/orders/[orderToken]` resolves only opaque tokens, displays a `DGW-...` reference, pending-confirmation status, COD payment method, delivery address, item snapshot, and manual phone/WhatsApp confirmation copy. |
| States | Loading, empty, no-results, error, unavailable variant, corrupt/denied storage, add failure, and not-found states remain actionable and do not invent commerce outcomes. |
| Responsive | Capture 320, 768, 1024, and 1440 px evidence; verify no horizontal page overflow, header/control collisions, clipped drawer actions, or touch targets below 44 px. |
| Motion | With `prefers-reduced-motion: reduce`, transitions are effectively removed and no deferred Circles substitute appears. |
| Visual | Compare 1440 catalog, PDP, and open drawer against `design-reference/exports/`; document missing product density, omitted unverified content, and inferred responsive/footer/home layouts. |
| Prohibited scope | Search the rendered app and source for payment-gateway/account/admin/promotion/review/policy claims or false affordances. |

Automated browser coverage lives in `tests/storefront.spec.ts`; responsive screenshot evidence is captured by `tests/responsive-visual.spec.ts` under `output/playwright/responsive/`. Unit coverage for query parsing/filtering/sorting/collections lives beside the catalog domain.

Remaining manual checks before a real commerce launch: configure the approved fixed COD shipping fee, validate production media rights/alt text, font delivery/licensing, live price/currency/availability sources, final domain/canonical URL, real-device touch/virtual-keyboard behavior, visible shipping/exchange/return/privacy/support policies, and deterministic remote database failure recovery.
