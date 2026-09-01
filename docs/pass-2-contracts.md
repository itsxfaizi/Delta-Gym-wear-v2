# Pass 2 contracts — backend and Supabase foundation

Authored by the orchestrator before any agent edited code. Three agents implement against this; where an agent believes a contract is wrong, it reports rather than diverging.

## Scope boundary

Approved by `docs/decision-log.md` and `docs/admin-route-spec.md`:

- **In scope:** authenticated admin route protection, server-side validation, typed mutation results, tenant-scoped queries, the product status-transition mutation and its audit trail, real 404s, a root error boundary, migration validation, RLS policies and tests.
- **Out of scope, do not build:** checkout, payments, orders, wishlist, admin UI screens (O-002 blocks these on Figma approval), MFA, bootstrap-admin, retention or production deletion policy, homepage visuals, motion.

Admin **UI** is not approved. The mutation layer ships guarded and unit-tested with **no UI caller**, which is deliberate and must be stated in the code comment, not hidden.

## Ownership — no file is owned by two agents

| Path | Owner |
| --- | --- |
| `src/server/**` except `src/server/db/schema.ts` | Backend |
| `src/features/**` (including its `*.test.ts`) | Backend |
| `src/app/**` | Backend |
| `src/server/db/schema.ts` | **Database** (Backend reads it, never writes it) |
| `db/**`, `drizzle.config.ts` | Database |
| `package.json` (the `db:check` script only) | Database |
| `tests/**` | QA |
| `src/components/**`, `src/styles/**` | **Nobody — frozen this pass** |

Pass 1 shipped a progressive-enhancement homepage. Do not change `src/components/storefront/**` or `src/styles/globals.css`, and do not alter these contracts: `data-home-timeline`, `data-home-motion`, `data-home-stage`, `data-settled-frame`, `data-prototype-frame`, `data-frame-state`, `data-scroll-progress`, `data-timeline-ready`.

## A. Principal

```ts
type TenantRole = "owner" | "catalog_editor" | "publisher" | "auditor";

type TenantPrincipal = {
  userId: string;    // Supabase auth user id
  tenantId: string;
  role: TenantRole;
  status: "active";  // a principal is only ever resolved for an active membership
};

// server-only. Returns null for: no session, no membership, membership not active.
resolveTenantPrincipal(): Promise<TenantPrincipal | null>
```

Resolution is **fail-closed**: any error resolving the session or the membership yields `null`, never a partial principal. Role is read from the database, never from a cookie, header, or JWT claim the client can shape.

## B. Result type — mutations never throw across the boundary

```ts
type Ok<T> = { ok: true; data: T };
type Err = {
  ok: false;
  code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "SERVER";
  message: string;                          // user-safe, non-disclosing
  fieldErrors?: Record<string, string[]>;   // VALIDATION only
};
type Result<T> = Ok<T> | Err;
```

Rules:

- `FORBIDDEN` and `NOT_FOUND` must be **non-disclosing**: an authenticated non-member asking for a product in another tenant gets the same response as one asking for a product that does not exist. No message may reveal whether a record exists, who owns it, or which role would have sufficed.
- `SERVER` never carries an exception message, stack, SQL fragment, or column name.
- Input is validated with Zod at the boundary, before any authorization work and before any database call.

## C. The one privileged mutation

From the approved state table in `docs/admin-route-spec.md`:

| Transition | Allowed roles |
| --- | --- |
| `draft → published` | `owner`, `publisher` |
| `published → unpublished` | `owner`, `publisher` |
| `unpublished → draft` | `owner`, `catalog_editor` |
| `unpublished → archived` | `owner` |
| `archived → draft` | `owner` |

`published → archived` is disallowed. The database trigger `enforce_product_status_transition` is the backstop; the application must not rely on it for authorization, only for integrity.

```ts
transitionProductStatus(input: {
  productId: string;          // uuid
  to: ProductStatus;
  expectedRevisionId: string; // optimistic concurrency; uuid
}): Promise<Result<{ productId: string; status: ProductStatus; revisionId: string }>>
```

Ordering, non-negotiable: **validate → resolve principal → authorize → open transaction → re-read the row under the transaction → check expected revision → update → insert audit row → commit.** The status update and the audit insert share one transaction; if the audit insert fails, the transition rolls back.

Every query in a protected path filters on the principal's `tenantId`. A tenant id is never accepted from client input.

## D. Audit events

One row per privileged mutation attempt, inserted in the mutation's transaction:

```
tenant_id      principal.tenantId
actor_user_id  principal.userId
action         "product.status_transition"
target_type    "product"
target_id      productId
request_id     from src/server/observability/request-id
correlation_id request id, or a caller-supplied id when one exists
outcome        "success" | "denied" | "conflict"
before         { status } — no other columns
after          { status } — no other columns
```

- Audit **denials only for authenticated principals.** An unauthenticated caller writes no row: we cannot attribute it, and an anonymous endpoint that writes a database row per request is a denial-of-service amplifier.
- `before`/`after` carry the status only. No PII, no secrets, no full row snapshots. Retention policy is **not** in scope and must not be invented (see decision-log O-003).

## E. HTTP and rendering contracts

- Unknown product or collection handle returns a **real HTTP 404**, not 200 with 404 content. Verified on the wire with `curl -D -`, not by reading the rendered body.
- A root error boundary catches server-render failures. Today `src/app/(store)/layout.tsx` calls `listPublishedProducts()`, and a segment's own `error.tsx` does not catch a throw from that segment's layout.
- The admin route group gate lives where a future page inherits it and fails closed. No admin page ships this pass, so `/admin` continues to 404 — the gate must be proven by test, not by a UI.
- The error boundary must not leak an exception message, stack, or query text to the browser.

## F. Database contracts

- `db:check` **opens and validates every migration SQL file.** It must fail on: a journal entry with no matching `.sql`, a `.sql` with no journal entry, a file whose content changed after journaling, and a snapshot/schema drift. Today it passes with `0001_rls_tenant_isolation.sql` deleted — that is the bar to clear.
- Fix the DELETE contradiction: `product_revisions_tenant_product_fk` is `ON DELETE CASCADE` into a table whose `BEFORE UPDATE OR DELETE ... FOR EACH ROW` trigger rejects unconditionally, so `DELETE FROM products` is impossible for any product that has a revision, and `products_owner_delete` plus its GRANT are dead capability. Decide with `docs/phase-3-foundation-plan.md` ("hard delete is not a launch operation") and make policy, grant, trigger and documentation agree.
- Add `BEFORE TRUNCATE ... FOR EACH STATEMENT` protection to `audit_events` and `product_revisions`; row triggers do not fire on `TRUNCATE`, and `GRANT ALL` to `service_role` includes it.
- Restrict `publisher` to the status column on `products` (column-level `GRANT UPDATE (status)` or a split policy). Today `products_editor_update` lets a publisher rewrite title, handle and description.
- Constrain `media_references.status` with an enum or CHECK. RLS compares it to `'active'`; a row written `'Active'` silently vanishes from the storefront.
- Confirm every exposed table has RLS enabled, and that every GRANT has a matching policy and vice versa.
- `FORCE ROW LEVEL SECURITY` and the owner-connection question are **reported, not changed** — changing the app's database role is a deployment decision.

## G. Local RLS test harness

There is no Supabase instance. A PostgreSQL 17.11 server is running on `localhost:5432`; the current user is superuser with `createdb`, and `pgcrypto` is available. Tests provision a throwaway database, apply the migrations in journal order, and drop it afterwards.

Supabase supplies two things the migrations depend on and a local server does not have:

1. the roles `anon`, `authenticated`, `service_role`;
2. `auth.uid()`, which the `current_tenant_role()` helper calls.

The harness creates both — the roles as `NOLOGIN`, and an `auth` schema whose `uid()` reads `current_setting('request.jwt.claims', true)::json->>'sub'`, which is exactly how Supabase implements it. Persona switching is `SET LOCAL ROLE` plus `SET LOCAL request.jwt.claims`. **This shim is test scaffolding and must be labelled as such** — it emulates the production runtime and is not proof that production is configured identically.

Minimum RLS assertions, each positive **and** negative:

- anon reads published products; anon cannot read draft, unpublished, or archived products.
- anon cannot read variants or media belonging to an unpublished product.
- anon gets zero rows from `tenants`, `memberships`, `product_revisions`, `audit_events`.
- an authenticated non-member gets zero rows from every table of a tenant they do not belong to.
- a `catalog_editor` of tenant A cannot INSERT, UPDATE or DELETE in tenant B.
- a non-owner cannot INSERT a membership (the self-granting-owner escalation).
- UPDATE and DELETE on `product_revisions` and `audit_events` are refused, including via `TRUNCATE`.
- `current_tenant_role()` returns NULL for a membership whose status is not `active`.
- a `publisher` cannot change a product's title.

## H. House rules

- No new runtime dependency without stating why a few lines will not do.
- Nothing that reaches the browser may import `src/server/**`; every server module keeps `import "server-only"`.
- No secret, connection string, or service-role key in source, tests, fixtures, or documentation.
- Do not run `npm run build` or `npx playwright test` — the orchestrator runs those and a concurrent run clobbers shared state. `npm run typecheck`, `npm run lint`, `npm test` are fine.
- A dev server is already running on **http://localhost:3001**. Port 3000 is an unrelated broken app; ignore it.

---

# Pass 2 result — delivered and independently verified — 2026-09-01

Three agents implemented against the contracts above in non-overlapping lanes; the orchestrator integrated, re-measured every claim, and fixed what integration exposed. Agent self-reports were treated as claims, not results.

## Verification, orchestrator-run

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | **66 passed**, 8 suites (was 20 / 5) |
| `npm run db:check` | `db:check ok: 3 migrations, 7 files` |
| `npm run db:test:rls` | **44 passed, 0 failed** |
| `npm run build` | exit 0, compiled successfully |
| `npx playwright test` | **61 passed** (was 32) |
| orchestrator's independent RLS verifier | **32 passed, 0 failed** |
| Pass 1 acceptance harness | unchanged; fidelity delta **0.0000** on all five bands |

The independent RLS verifier was written from section G *before* any agent started, and was not modified afterwards. Its pre-pass baseline was 28/32, with the four failures being exactly the four database defects this pass was chartered to close.

## HTTP contracts, measured on the wire

```
/products/does-not-exist      200 -> 404      /collections/does-not-exist   200 -> 404
/collections/ALL              title "Collection not found" -> "All Products | Delta Gym Wear"
/products/ease-fit-trouser    200   /collections/all 200   /shop 200   / 200
/admin 404   /admin/products 404   /api/health 200
```

## Two integration defects the orchestrator found and fixed

1. **The 404 fix silently broke the approved not-found experience.** Moving the existence check into `[handle]/layout.tsx` is what makes the status line honest — a segment's layout renders outside its own `loading.tsx` Suspense boundary, so the check lands before the first flush. But Next resolves a layout's `notFound()` from an **ancestor** segment, so `[handle]/not-found.tsx` could never catch it and users got Next's default 404 instead of the approved copy. The pre-existing test `storefront.spec.ts:"unknown collections and products use the not-found experience"` caught it; the agent had verified only the status line, because that is what it was asked to verify. Fixed by moving both boundaries up one segment to `(store)/products/not-found.tsx` and `(store)/collections/not-found.tsx`, with the reason recorded in each file. Both properties now hold at once.

2. **`db:check` crashed instead of reporting on a corrupt journal.** `JSON.parse` on `meta/_journal.json` was unguarded, so a malformed journal produced a `SyntaxError` stack naming `db/check.mjs` — a reader would debug the checker, not the file that is broken. It did exit non-zero, so the contract's letter was met and its purpose was not. Added a `readJson` helper and an `abort()` that prints queued failures before exiting, since `fail()` only queues. Now reports `db:check FAIL: db/migrations/meta/_journal.json is not valid JSON: …`, plus a guard for a journal with no `entries` array.

## Contract divergences, recorded rather than silently absorbed

- **Denial audits for pre-read refusals are written outside the transaction.** Atomically equivalent — nothing else is in flight — but contract D says "inserted in the mutation's transaction", and this is not that. Recorded so the next reader does not infer it was an accident.
- **`before: null` for refusals that precede the row read.** Contract D specifies `{ status }` and makes no provision for null. Either the contract gains "or null when the row was never read", or the row is not written before the read.
- **`resolveTenantPrincipal()` takes the tenant from `DELTA_TENANT_ID`,** then looks up a membership in it, rather than deriving the tenant from the user's memberships. Correct and fail-closed for the approved single-tenant launch (decision-log line 101); contract A reads as though the tenant comes from the membership. An active member of a *different* tenant resolves to `null`.
- **A null principal cannot distinguish "no session" from "signed in, no membership",** so both return `UNAUTHENTICATED`. Non-disclosing and fail-closed, but a signed-in non-member is told to sign in. Changing it requires a second return channel in contract A.
- **`expectedRevisionId` does not advance on a status transition,** because a transition creates no revision. Two identical concurrent transitions therefore both succeed. The check means "the product has not been *edited* since you loaded it", which is coherent — but `products.version` is now dead weight on this path and wants a decision.

## Deliberate scope refusals

No checkout, payments, orders, or wishlist. No admin UI — decision O-002 blocks it on Figma approval, so the mutation ships guarded, unit-tested, and with no caller, stated in a code comment rather than left to be discovered. No retention policy (O-003). No MFA, bootstrap-admin, or production deletion policy. `FORCE ROW LEVEL SECURITY` and the owner-connection question were reported, not changed, because which role the application connects as is a deployment decision and not a migration.
