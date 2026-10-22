# ADR-002: Catalog, promotions, staff, and media feedback

Date: 2026-10-21. Status: owner-approved scope; implemented locally, release pending migrations and admin security gates.

## Decisions

- Products have two independent classifications: audience (`male`, `female`, `unisex`) and garment type (`tops`, `bottoms`). Existing products stay unclassified until an editor assigns them; the public `All` view still shows them. A category filter matches the corresponding assigned value.
- Admin staff creation means an owner invites a staff member by email and assigns one of the existing tenant roles. No administrator chooses or sees another person's password. Membership controls access; an invited Auth user without an active membership has no admin access. Existing last-owner protection remains.
- One promo code may apply to an order's merchandise subtotal before shipping. An owner configures a percentage or fixed PKR amount, an expiry, a usage limit, and an active switch. The discount cannot exceed the subtotal. The server rechecks eligibility and consumes one use in the order transaction. Codes do not stack. Expiry is stored in UTC and displayed in the operator's local time.
- The admin editor accepts PKR rupees, including at most two decimal places. The database and order calculations keep integer paisa. Existing prices are displayed as rupees; there is no data conversion migration.
- Admin product images upload to a public-read, tenant-path-scoped Supabase Storage bucket, as the owner confirmed for storefront photography. Uploads require an authenticated `owner` or `catalog_editor`, accepted image MIME type and size limits, and alt text before publish. Public product delivery uses the resulting URL. Existing external image URLs continue to render. This is a product-photo-specific exception to the earlier private-media proposal in `docs/architecture-decisions.md`.
- The owner approved deleting an uploaded product photo 30 days after it becomes unreferenced. A lifecycle row starts the clock when an upload token is issued, clears it while a product references the image, and restarts it when the last reference is removed. A secret-protected daily job deletes only tracked paths in the tenant's `product-images` bucket after rechecking references, with an audit outcome and a dry-run mode. External image URLs are outside this cleanup. The scheduled job processes at most 25 objects per run; deletion can occur later than day 30 if the schedule or Storage service is delayed.
- The owner approved extending the existing Delta admin visual system for these controls because Figma has no admin frames. Record this deviation in `docs/figma-audit.md`.

## Contract and permission outcomes

| Domain | Inputs and states | Authorized writer | Failures |
| --- | --- | --- | --- |
| Product | `audience`, `garmentType`, variant prices in rupees at the form boundary; existing product lifecycle | `owner`/`catalog_editor` edit content; `owner`/`publisher` publish or archive | Invalid fields, duplicate handle/SKU, invalid status transition, stale or missing product, database unavailable |
| Promo code | Code, kind, value, expiry, limit, active; applied once during COD order placement | `owner` manages codes; shopper may submit a code | Unknown, inactive, expired, exhausted, invalid amount, conflicting concurrent redemption |
| Staff | Email, tenant role; invited, active, suspended | `owner` invites and changes roles/status | Invalid email, duplicate member, invite delivery error, last owner mutation denied |
| Media | Image bytes, declared MIME, alt text, ordered reference | `owner`/`catalog_editor` upload and edit references | Unsupported/oversize file, storage failure, unauthorized upload, missing alt text for published image |

All persisted records are scoped by `tenant_id`. Privileged changes append `audit_events` with actor, action, target, timestamp, outcome, and safe before/after details. Public pricing and promo validity are server authoritative. For operational reversibility, promo codes can be disabled rather than deleted, staff membership can be suspended, and product media reference removal does not immediately delete an underlying object.

## Consequences and rollback

New nullable product classifications preserve existing catalog rows. Reverting the UI leaves old data readable. Promo redemption and order discount snapshots must remain for order history; disable codes rather than dropping records. A Storage bucket adds retained assets; rollback means disable new uploads while existing public URLs continue to serve. The approved 30-day unreferenced-image retention requires migration `0006_product_image_retention.sql` and `CRON_SECRET` before the scheduled cleanup is enabled. Production release still requires the admin security policy approvals listed in `AGENTS.md` (MFA, session rotation/revocation, CSRF, brute force, bootstrap and audit retention).
