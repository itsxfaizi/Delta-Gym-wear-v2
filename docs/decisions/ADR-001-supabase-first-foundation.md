# ADR-001: Supabase-first foundation

- **Status:** Approved
- **Date:** 2026-08-30
- **Scope:** Delta Gym Wear launch foundation

## Context

Delta needs a high-fidelity Next.js storefront, an internal custom admin, low operational complexity, strong TypeScript support, safe publishing, and a path to add checkout later. The approved launch boundary is a catalog with cart and no checkout. The Figma source supplies desktop storefront frames but no approved admin or mobile/tablet screens.

## Decision

Use **Option A: Supabase-first with a custom Delta admin**:

- Next.js App Router + strict TypeScript, Server Components by default, and small Client Component islands for interactive behavior.
- Supabase Auth for administrator sessions, with application-owned tenant membership and role records.
- Supabase managed PostgreSQL with Drizzle for typed server queries and versioned SQL migrations.
- Delta-owned product/content, variant, media-reference, and revision models; the admin UI is implemented in Next.js so approved Figma direction can be followed precisely.
- Supabase Storage private media with signed access and explicit rights/alt-text metadata.
- Append-only database audit events written transactionally with privileged changes.
- Provider-neutral `Cart`, `Order`, `Payment`, `Tax`, and `Shipping` boundaries; no checkout or external commerce integration at launch.

## Ownership and authorization baseline

Launch is single-tenant (`delta`), with `tenant_id` on mutable domain records. The initial role contract is:

- `owner`: all tenant content, member/role, publishing, archive/restore, configuration, and audit access.
- `catalog_editor`: create/edit draft and unpublished content and media metadata; no publishing, archive, restore, or role management.
- `publisher`: validate, publish, unpublish, preview, and read history; no member management or archive/restore.
- `auditor`: read-only admin projections, revisions, and audit events.

Authorization is server-enforced in services/actions and database policies where applicable; client visibility is never the security boundary.

## State and release boundary

Products use `draft → published → unpublished`, with `unpublished → draft` for edits, `unpublished → archived` for owner-only archival, and `archived → draft` for owner-only restore. Direct `published → archived` is prohibited. Review and scheduling are deferred. Checkout, payment, tax, shipping, orders, accounts, and external integrations are out of launch scope.

## Consequences

- The operational surface is compact because authentication, database, and storage share Supabase.
- The product editor and Figma-faithful admin are application-owned work; this is intentional for visual control.
- Supabase Auth/Storage and migration workflows create vendor coupling; domain services and commerce interfaces must keep the storefront portable.
- Production still requires explicit decisions for deployment, MFA enforcement, session lifecycle, rate limits, retention, backups, asset scanning, and legal policy.

## Migration and rollback

Use repository-owned, forward-only SQL migrations with expand/contract sequencing. Run a reviewed migration job before the compatible application build, verify a backup and checksum, make backfills idempotent, and use compensating migrations for proven rollback. Roll back the application build before changing a compatible schema; media objects remain immutable and database references are changed instead.

## Alternatives rejected for this decision

Payload-first remains viable when minimizing custom editor CRUD is more important than full admin visual control, but it is not selected for this launch foundation.
