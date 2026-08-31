# Delta Gym Wear — Phase 2 Architecture Decisions (Draft)

**Status:** Option A approved on 2026-08-30. Deployment target, production security settings, and external commerce providers remain separate approval gates.

**Scope held constant:** launch is a catalog with cart and no checkout. The public source of truth is the approved Figma storefront; the matching admin workflow manages product/catalog content. Payment, tax, shipping, returns, orders, customer accounts, and checkout are future boundaries.

## Constraints carried forward

- Next.js App Router + strict TypeScript; Server Components by default and small Client Component boundaries for cart, filters, gallery, and motion.
- Public and protected admin route groups stay separate.
- The Figma source has desktop storefront frames but no admin or mobile/tablet frames; responsive/admin decisions remain approval gates.
- Every protected mutation must authenticate, authorize, validate, and append an audit event.
- Published data is public; drafts, unpublished records, media metadata, and audit records are protected.

Next.js App Router supports the required Server/Client Component split and Server Functions for mutations ([official documentation](https://nextjs.org/docs/app/getting-started/server-and-client-components)).

## Option A — Supabase-first, custom Delta admin (recommended)

### Proposed stack

| Boundary | Recommendation (pending approval) |
| --- | --- |
| Web/runtime | Next.js App Router, React, TypeScript, server-rendered storefront; managed Next.js-compatible deployment remains to be selected |
| Authentication | Supabase Auth with SSR session cookies; application-owned role and membership tables; admin MFA required before production |
| Database/migrations | Managed PostgreSQL in Supabase; Drizzle for typed server queries; versioned SQL migrations run in CI through the Supabase CLI |
| Product/content | Delta-owned product, variant, media-reference, and revision tables; custom admin screens in the same Next.js application for exact visual control |
| Media | Supabase Storage private bucket with signed upload/download URLs; immutable object keys and explicit metadata/alt text |
| Audit | Append-only `audit_events` table written in the same transaction as privileged mutations, with a restricted read path |
| Future commerce | Internal `Cart` contract now; later `Order`, `Payment`, `Tax`, `Shipping`, and `CommerceProvider` adapters without coupling storefront components to a provider |

Supabase Auth integrates with Postgres and supports server-side rendering, Row Level Security, and MFA capabilities ([official documentation](https://supabase.com/docs/guides/auth)). RLS is defense in depth; application services must still authorize every operation.

### Text architecture diagram

```text
Browser
  ├─ public storefront (RSC + small client islands)
  ├─ cart/filter/gallery client state
  └─ admin UI (authenticated client islands)
        │ HTTPS, secure session cookie
        ▼
Next.js App Router
  ├─ public queries → published projections only
  ├─ server actions/services → validate → authorize → mutate → audit
  ├─ route handlers only for future webhooks/public non-UI APIs
  └─ media signing service
        │ TLS, least-privilege credentials
        ├──────────────► Supabase Auth
        ├──────────────► PostgreSQL + Drizzle + migrations
        ├──────────────► Supabase Storage (private media)
        └──────────────► audit_events (append-only)
```

### Tradeoffs and estimated complexity

- **Strengths:** lowest number of managed services; TypeScript-friendly; custom admin can share domain components and match any future approved admin frame; Postgres schema remains commerce-ready; auth, database, and storage share one operational boundary.
- **Costs:** product editor, revision UI, publishing controls, media metadata, and admin polish are application work; RLS/service-role boundaries require discipline; some Supabase coupling in auth/storage/migrations.
- **Estimated complexity:** medium (about 4/5). Foundation and first slice are moderate; later content fields remain straightforward because the schema is owned by Delta.

## Option B — Payload-first CMS/admin

### Proposed stack

| Boundary | Recommendation (pending approval) |
| --- | --- |
| Web/runtime | Next.js App Router with Payload embedded in the same application; managed Node-compatible deployment remains to be selected |
| Authentication/RBAC | Payload authentication collection and access-control functions; admin MFA/session policy still requires explicit configuration and approval |
| Database/migrations | Managed PostgreSQL using Payload's Postgres adapter (Drizzle underneath); Payload-generated, versioned migrations run in CI |
| Product/content | Payload collections for products, variants, revisions, and media; custom admin components where the default panel cannot meet the approved workflow |
| Media | S3-compatible private object storage through a Payload storage adapter; signed delivery URLs and metadata/alt-text fields |
| Audit | Dedicated append-only audit collection/table populated by server-side hooks; never rely on admin UI history as the compliance log |
| Future commerce | Keep catalog/content collections separate from future order/payment collections and provider adapters; no checkout in launch |

Payload provides collection/field-level access control and Postgres migration controls ([access control](https://payloadcms.com/docs/access-control/overview), [Postgres adapter](https://payloadcms.com/docs/database/postgres), [migrations](https://payloadcms.com/docs/database/migrations)).

### Text architecture diagram

```text
Browser
  ├─ Next.js storefront (RSC + client islands)
  └─ Payload admin (authenticated)
        │ HTTPS, secure session cookie
        ▼
Next.js + Payload
  ├─ storefront queries → published collection views
  ├─ Payload access controls/hooks → validate → authorize → mutate → audit
  └─ media adapter → signed object URLs
        ├──────────────► PostgreSQL + Payload/Drizzle migrations
        ├──────────────► S3-compatible private media
        └──────────────► append-only audit collection/table
```

### Tradeoffs and estimated complexity

- **Strengths:** fastest path to a working content editor, revisions, and collection-level access rules; fewer custom CRUD screens; PostgreSQL and TypeScript remain portable.
- **Costs:** the default admin is not Figma-authored and may require substantial customisation; Payload conventions become a core dependency; custom publishing/audit semantics must be verified against hooks and access-control boundaries; two conceptual layers (Payload and storefront domain services) increase coupling.
- **Estimated complexity:** medium-high (about 4.5/5) for a Figma-faithful admin, despite a lower CRUD starting cost.

## Proposed ownership and role model (applies to either option)

This is a single-tenant launch model: one `delta` tenant owns every product, variant, media reference, revision, cart, and audit event. Every mutable row carries `tenant_id`, even while only one tenant exists, so future isolation is explicit. Products are tenant-owned, not individually owned by staff; this avoids accidental cross-user visibility rules.

| Role | Allowed actions | Forbidden actions |
| --- | --- | --- |
| `owner` | Manage members/roles; create/edit; publish/unpublish; archive/restore; read audit; manage configuration | None within the Delta tenant |
| `catalog_editor` | Create/edit draft and unpublished product data; upload/edit media metadata; preview | Publish, unpublish, archive/restore, role management, audit export |
| `publisher` | Read drafts; validate and publish; unpublish; preview; read product history | Manage members/roles; archive/restore; alter audit records |
| `auditor` | Read admin projections, revisions, and audit events | All content and role mutations |

Authorization is enforced in server services/actions and, where supported, at the database/CMS access-control layer. UI visibility is not authorization. Bootstrap-owner creation, MFA enforcement, session expiry/revocation, and recovery require explicit security approval before production.

## Content state machine

Launch uses `draft`, `published`, `unpublished`, and `archived`. `review` and `scheduled` are deferred until an approver/timezone/retry policy is approved.

```text
new ───────────────► draft
draft ──publish────► published
published ─unpublish► unpublished
unpublished ─edit──► draft
unpublished ─archive (owner)─► archived
archived ─restore (owner)──► draft
```

- `draft`: editable, never public.
- `published`: exactly one validated revision is public; publish records actor, time, revision, and audit metadata.
- `unpublished`: not public but recoverable/editable; unpublish is explicit and audited.
- `archived`: hidden and read-only; restore returns to `draft`; hard delete is not a launch operation.
- Direct `published → archived` is disallowed; unpublish first so public visibility changes are explicit.
- Every write uses an optimistic `version`/revision check. A stale editor receives a conflict and cannot overwrite a newer revision.

## Security baseline

For either option:

- Use secure, HttpOnly, SameSite cookies; verify request origin for same-origin mutations and use CSRF protection for custom route handlers.
- Enforce MFA for privileged admin roles before production; rate-limit sign-in, invitations, password recovery, and mutation endpoints; support session expiry and revocation.
- Keep service keys server-only; never authorize from client claims alone. Use least-privilege database/storage credentials and separate public published reads from protected admin reads.
- Validate all forms, uploads, webhooks, and query parameters at the boundary. Allowlist image types/sizes, scan uploads for malware, strip unsafe metadata where required, and use signed media URLs.
- Make `audit_events` append-only: actor, action, target type/id, timestamp, correlation/request ID, outcome, and safe before/after metadata. Restrict reads and define retention before production.
- Set security headers, structured redacted logs, backups, restore drills, and dependency vulnerability response. Do not place payment or sensitive customer data in the launch cart.

Option-specific risks: Supabase requires careful separation between user-scoped clients and server/service-role clients; Payload requires review of every collection/field access function and hook, plus hardening of its admin surface and upload adapter.

## Migration and rollback approach

1. Treat production migrations as forward-only, versioned artifacts reviewed in pull requests. Use expand/contract changes: add nullable/new structures, deploy compatible code, backfill, switch reads/writes, then remove old structures in a later release.
2. Run migrations in CI or a controlled release job before the new application build receives traffic. Take/verify a database backup and record a migration checksum before production.
3. Make data backfills idempotent and provide a tested compensating migration. Do not depend on an untested destructive `down` migration for production rollback.
4. If an application release fails, roll back the application build first while preserving the compatible schema. Roll back the schema only through a reviewed compensating migration when data safety is proven.
5. Keep media objects versioned/immutable; database rollback changes references, not already-published source objects. Apply storage lifecycle/deletion rules only after retention approval.
6. Supabase option: store SQL migrations in the repository and apply them with the Supabase CLI. Payload option: commit generated Payload migrations and apply them with the Payload migration command; disable development-only push behavior for shared/production environments.

## Recommendation

Approve **Option A — Supabase-first, custom Delta admin** unless the primary objective becomes minimizing custom editor work. It best balances the Figma-faithful storefront, a future Figma-faithful admin, low operational surface area, TypeScript ownership, and a clean seam for checkout later. Choose Option B when a conventional CMS editor and built-in collection access controls are more valuable than full admin visual control.

The recommendation is now approved as Option A. The binding decision record is [ADR-001-supabase-first-foundation.md](decisions/ADR-001-supabase-first-foundation.md). Provider-specific production settings, final legal/retention policy, and future commerce providers remain separate approval gates.
