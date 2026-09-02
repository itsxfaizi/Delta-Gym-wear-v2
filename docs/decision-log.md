# Delta Gym Wear — Decision Log

| ID | Decision / status | Owner | Evidence / link | Consequence |
| --- | --- | --- | --- | --- |
| D-001 | Supabase-first custom Delta admin approved | [Main Orchestrator] | [ADR-001](decisions/ADR-001-supabase-first-foundation.md) | Use Supabase Auth/Postgres/Storage boundaries with Drizzle; keep commerce provider-neutral |
| D-002 | Superseded: launch was catalog with cart and no checkout | User / [Product/BA] | `docs/requirements.md`, earlier brief | Replaced by D-007 for COD-only transactional scope |
| D-003 | Public slice is catalog → PDP → variants → cart drawer | User / [Main Orchestrator] | `docs/figma-audit.md` | Only these routes are implemented |
| D-004 | Dark logo SVG and Catalog Normal/Hover crops are authoritative local exports | [Design systems/UI-UX] | `design-reference/manifest.md` | Use exact local mappings; retain supplied raster only as fallback |
| D-005 | Mobile/tablet layouts derive from desktop exports | User approval | `docs/figma-audit.md` | Deviations documented at 320/768/1024 |
| D-006 | Circles motion and landing route deferred | User approval | `design-reference/manifest.md` | No motion recreation or landing implementation |
| O-001 | Additional distinct product identities/crops | User / [Design systems/UI-UX] | Manifest missing-assets section | Supply original Figma exports or authoritative local files |
| O-002 | Admin Figma frames and responsive behavior | User / [Product/BA] | `docs/admin-route-spec.md` | Approve frames or documented deviations before admin UI |
| O-003 | Commerce policies/providers | User / [Product/BA] | ADR-001, requirements | Explicit market, payment, tax, shipping, returns, account, legal decisions required |
| O-004 | Graphify executable availability | Environment owner | Resolved: invoke Graphify as `py -m graphify` on this Windows host; generated graph retained | Reassess only if the Python launcher or Graphify package is removed |
| D-007 | Minimal COD-only checkout approved for Pakistan | User / [Staff-engineering recommendation], 2026-09-02 | Add guest COD checkout with Pakistani mobile number, PK-only address, nationwide courier-serviceability caveat, opaque order token, human order reference, no gateway, no tax line, no stock reserve/decrement before ops confirmation, no notification integration |
| O-005 | Approved fixed COD shipping fee amount | User / business owner | `DELTA_COD_SHIPPING_FEE_AMOUNT` must be configured before orders can be placed | Checkout must not invent or hide the delivery fee |
