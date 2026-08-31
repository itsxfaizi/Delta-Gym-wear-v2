# Phase 3 Foundation Plan

**Status:** Approved to implement foundation only. Launch remains catalog + cart; no checkout or external commerce integration.

## Scaffold plan

1. Establish a Next.js App Router project with strict TypeScript, ESLint, test commands, and a reproducible lockfile. Use Server Components by default.
2. Create route-group boundaries: `src/app/(store)` for future public routes and `src/app/(admin)/admin` for protected routes. Do not add product, catalog, cart, or admin screens in this foundation pass.
3. Add a neutral root foundation page, global semantic CSS tokens, reduced-motion defaults, metadata, and a health endpoint; these are smoke-test surfaces, not product UI.
4. Add server-only environment validation, Supabase SSR client factories, and a placeholder authorization boundary that fails closed when used without configured credentials.
5. Add Drizzle schema modules and the initial SQL migration for tenant, membership/role, product, variant, media reference, revision, and audit-event foundations. Do not seed invented products or commercial data.
6. Add security headers, request correlation plumbing, and test scaffolding. Do not add auth screens, payment SDKs, CMS integrations, analytics, email, or upload processing yet.

## Package list and justification

Runtime dependencies:

| Package | Planned version | Justification |
| --- | ---: | --- |
| `next` | `16.3.3` | App Router, Server Components, Server Functions, route handlers |
| `react`, `react-dom` | `19.2.8` | Next.js rendering runtime |
| `zod` | `4.5.4` | Runtime validation for environment and future action boundaries |
| `@supabase/ssr` | `0.12.5` | Supabase SSR cookie client for Next.js |
| `@supabase/supabase-js` | `2.112.4` | Typed Supabase Auth/Storage client |
| `drizzle-orm` | `0.45.2` | Typed PostgreSQL queries and schema |
| `postgres` | `3.4.9` | Server-only PostgreSQL driver |

Development dependencies:

| Package | Planned version | Justification |
| --- | ---: | --- |
| `typescript` | `6.0.3` | Strict type checking; pinned to the version supported by the selected Next.js ESLint parser |
| `eslint`, `eslint-config-next` | `9.39.5`, `16.3.3` | Framework-aware linting |
| `drizzle-kit` | `0.31.10` | Schema inspection and migration generation |
| `jest`, `jest-environment-jsdom` | `30.5.0`, `30.5.0` | Well-established unit and DOM test runner for Next.js/Testing Library |
| `@types/jest` | `30.0.0` | Jest globals and matcher typings |
| `@testing-library/react`, `@testing-library/jest-dom` | `16.3.3`, `7.0.1` | Accessible component tests when UI slices begin |
| `@playwright/test` | `1.62.1` | Browser/e2e and breakpoint verification when routes exist |
| `@types/node`, `@types/react`, `@types/react-dom` | `26.4.0`, `19.2.18`, `19.2.5` | TypeScript platform/React declarations |

No styling, icon, state-management, CMS, payment, analytics, or email dependency is added in foundation. CSS tokens and small local primitives keep the bundle and design system under project control.

## Environment-variable contract

`.env.example` documents names only; secrets never enter source control.

| Variable | Required | Exposure | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Runtime | Browser-safe | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Runtime | Browser-safe | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin server runtime only | Server-only | Privileged jobs/services; never shipped to browser |
| `DATABASE_URL` | Migration/server runtime | Server-only | Pooled PostgreSQL connection for Drizzle |
| `DELTA_TENANT_ID` | Server runtime | Server-only | UUID of the approved single Delta tenant; required whenever `DATABASE_URL` is configured |
| `APP_URL` | Runtime | Server-only | Canonical origin for redirects and origin checks |
| `LOG_LEVEL` | Optional | Server-only | Structured log verbosity; default `info` |
| `NEXT_PUBLIC_APP_NAME` | Optional | Browser-safe | Non-secret display/metadata name; default `Delta Gym Wear` |

Startup/runtime validation must reject malformed URLs, missing required values for the active operation, and accidental service-key exposure. Checkout, payment, webhook, storage-upload, and provider variables are deliberately absent.

## Database schema and migration plan

Initial foundations (names are proposed contracts, not seeded data):

- `tenants`: `id`, `slug`, `name`, timestamps; one `delta` row when persistence is approved.
- `memberships`: `tenant_id`, `auth_user_id`, `role`, status, timestamps; unique tenant/user.
- `products`: tenant-owned handle, title, description, status, current revision, timestamps, optimistic version.
- `product_variants`: product, SKU, size/color attributes, price display fields, availability flag; no payment/order semantics.
- `media_references`: tenant/product linkage, private object key, alt text, rights/source metadata, dimensions, status.
- `product_revisions`: immutable draft/published snapshots, author, revision number, created timestamp.
- `audit_events`: append-only actor, action, target type/id, request/correlation ID, outcome, safe before/after JSON, timestamp.

Rules: all mutable domain rows carry `tenant_id`; public queries can see only the published revision; privileged writes require a version match and audit event in one transaction; hard delete is not a launch operation.

Migration sequence:

1. Create migration metadata and enum/check constraints.
2. Add tenant/membership and product/revision tables with indexes and foreign keys.
3. Add media references and audit events.
4. Add least-privilege database policies/roles after the auth contract is configured.
5. Backfill only approved content; no invented seed catalog.

Use expand/contract migrations, CI-applied checksums, verified backups, idempotent backfills, and compensating migrations. Restore the app build before schema rollback; never rely on an untested destructive production `down` migration.

## File ownership split by role

| Role | Foundation ownership | Must not own |
| --- | --- | --- |
| Orchestrator | ADRs, plan, integration, package lock, final verification, scope gates | Unapproved product decisions |
| Role 03 — Frontend | `src/app`, `src/components/ui`, `src/styles`, metadata, neutral smoke route | Auth policy, migrations, provider credentials |
| Role 04 — Backend | `src/server`, `src/features/*/{schema,types,queries,services}`, `db/migrations`, `drizzle.config.ts`, env contract | Visual redesign or invented screens |
| Role 05 — QA/accessibility | `tests`, Jest/Playwright config, responsive/keyboard/reduced-motion checks, verification notes | Feature scope changes |
| Role 06 — Reviewer | Read-only risk/regression review and findings | Direct unrequested rewrites |
| Role 07 — PR writer | Later verified change summary/evidence | Claiming unverified tests |

Foundation acceptance: clean install; lint/typecheck/test commands run; build succeeds without secrets; `/api/health` is deterministic; route groups compile; env validation fails clearly; no checkout, payment, CMS, analytics, email, or invented admin UI exists.
