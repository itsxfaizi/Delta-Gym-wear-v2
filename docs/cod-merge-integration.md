# COD checkout merge — integration record — 2026-09-02

`origin/codex/latest-main-run` (17c3309, "Add COD checkout flow") merged into `feat/delta-storefront-foundation` (aa04293). Both descend from `origin/main` (d183c7c), so this was an ordinary three-way merge, not a graft.

## What was NOT merged, and why that matters

A fourth line existed: a local orphan root commit (046b1cb) with no ancestor in common with anything on the remote. Diffing it against the COD branch reported "44 files deleted", which was an artifact of comparing unrelated histories — it is not what a merge does. That commit was a local `git init` artifact, content-identical to `origin/feat/delta-storefront-foundation` apart from two stale files. It is preserved as the tag `local-orphan-046b1cb` and is otherwise abandoned.

Measured before merging, with `git merge-tree` (read-only): the merged tree keeps `db/check.mjs`, `db/migrations.lock`, `db/tests/rls.test.mjs`, both RLS migrations, `src/middleware.ts`, the CSP builder, `principal.ts`, both root boundaries, every spec file and the 2.4 MB Figma export — **alongside** the COD feature. Nothing was traded away.

## The four textual conflicts

| File | Resolution |
| --- | --- |
| `src/app/layout.tsx` | Ours. The font `variable` classes drive `--font-display`, which the whole type scale depends on. Their `suppressHydrationWarning` was dropped: several specs assert zero console errors, and suppressing hydration warnings would blind exactly that signal. |
| `src/components/storefront/home-scene.tsx` | Ours for `reducedMotion: useState(true)` — that single line *is* the pass-1 progressive-enhancement fix — and ours for `data-timeline-ready`, which is the hydration gate many specs wait on. Their intro mechanism was then integrated separately, see below. |
| `src/styles/globals.css` | Ours for both hunks. These are the values measured against `design-reference/exports/home/home-desktop-1440.png`, including the contrast-corrected `--color-eyebrow`. Theirs would have moved the per-band fidelity scores. Their footer changes are a genuine improvement worth revisiting on their own (44px touch targets, lighter link colour) — recorded here rather than taken silently. |
| `docs/figma-audit.md` | Ours (468 lines of measured history, which every fidelity number in the repo refers to), with their `## COD checkout approval — 2026-09-02` section grafted on verbatim. |

## Three semantic conflicts git could not see

Textual auto-merges that were wrong, each caught by a test rather than by reading:

1. **Duplicate `@keyframes home-intro-mark-arrive`.** Both branches defined it, in different places, so both survived. The later definition wins in CSS, and the later one was the pass-1 placeholder — documented in the audit itself as "an approximation, not a Figma value" — which silently overrode the COD line's measured translate/scale. The mark rendered 275.77px wide against a measured 293.38px. The placeholder was removed; the measured keyframe stands.
2. **The intro overlay would have covered the page with scripting off.** The COD design server-renders `.home-intro` with `display: grid` and hides it with `html[data-home-intro-state="skip"]`, set by a pre-paint inline script. With JavaScript off that script never runs, the rule never matches, and a `position: fixed; inset: 0` black overlay covers all five sections — destroying the pass-1 guarantee. The default was inverted: `.home-intro` is `display: none`, and `html[data-home-intro-state="play"]` opts it *in*. No-JS now gets no overlay, which is both safer and simpler than either branch shipped.
3. **The inline bootstrap had no nonce**, so the pass-3 CSP (`script-src 'nonce-…' 'strict-dynamic'`) would have blocked it in production. It now renders from `src/app/(store)/page.tsx`, a server component, carrying the request nonce.

The result keeps both designs' intent: the intro is in the server-rendered HTML and paints **before** first contentful paint (measured: 168.9ms against an FCP of 172ms), and the mount effect unmounts it for a repeat visit, a flow viewport, or reduced motion — so the specs that assert its absence still get absence.

## A fourth conflict consequence, found later — 2026-09-02

Resolving `src/app/layout.tsx` in favour of the font variables also dropped the COD line's `suppressHydrationWarning`, on the reasoning that suppressing hydration warnings would blind the console-error checks several specs depend on. That reasoning was wrong for this specific case, and the pre-paint intro bootstrap is exactly why.

The bootstrap sets `data-home-intro-state` on `<html>` before React hydrates, so the server HTML and the client DOM legitimately differ on that one attribute and every homepage load logged `A tree hydrated but some attributes of the server rendered HTML didn't match`. `suppressHydrationWarning` is React's documented escape hatch for precisely this pattern and is scoped to that element's own attributes — it suppresses nothing below `<html>`. It is restored, on `<html>` only, not on `<body>`.

The test that should have caught this, `storefront.spec.ts:"home intro bootstrap does not trigger a hydration warning"`, passed throughout. It asserted after the overlay became visible — but the overlay is server-rendered and is visible *before* React hydrates, so the assertion ran while the warning was still in flight. It now waits for `[data-timeline-ready="true"]`, the controller's own hydration signal, before asserting. Verified by reverting the fix: the hardened test fails, and passes again once restored.

## Migration renumbering and RLS

`0001_cod_orders.sql` collided with `0001_rls_tenant_isolation.sql`. `npm run db:check` caught it immediately and by name — `0001_cod_orders.sql has no journal entry` — which is the guard doing its job on the first real collision it has ever seen.

Rather than renaming the hand-written file, the tables were modelled properly: the CHECK constraints the COD line expressed only in SQL (`payment_method = 'cod'`, `country = 'PK'`, `total = subtotal + shipping`, `line_total = unit_price × quantity`) were added to `src/server/db/schema.ts`, where this repo already models 11 other checks, along with `.enableRLS()`. `drizzle-kit generate` then produced `0003_cod_orders.sql` and its snapshot, and the hand-written privilege section was appended in the same arrangement as `0001` and `0002`.

**RLS was added, and it was not optional.** The COD line enabled row-level security on nothing at all, while introducing tables holding a customer's name, Pakistani mobile number and home address. Supabase publishes every `public` table over PostgREST with the anon key. `db/tests/rls.test.mjs` asserts that no public table has RLS disabled, so the merge could not pass until this was fixed. The shape chosen:

```sql
REVOKE ALL ON orders, order_items FROM anon;
REVOKE ALL ON orders, order_items FROM authenticated;
GRANT ALL ON orders, order_items TO service_role;
```

No policy is defined for `anon` or `authenticated`, deliberately: the application reaches these tables only through the Drizzle connection, which is the table owner and bypasses RLS, and order status is read by opaque token through the server rather than by a database role. A role with no grant needs no policy, and a policy without a grant would imply access that does not exist.

## Two tests corrected, and why neither is a weakening

- `tests/mutation-surface.spec.ts` asserted that **no** `"use server"` module is reachable from the route graph. That was true when the only server action had no UI caller. D-007 approves a guest checkout, so `placeCodOrder` is reachable **on purpose**. The assertion now names the privileged catalog mutation as the one that must stay unreachable, and additionally asserts the checkout action *is* reachable — so an unwired form fails the test instead of passing it for the wrong reason.
- `tests/credential-exposure.spec.ts` walked the import graph from every `"use client"` module and flagged `checkout-view → orders/actions → src/server/db` as a leak. Next compiles a client's import of a server action into a reference id; the module and its imports never enter a client bundle. Independently verified: nothing matching `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `postgres://` or `drizzle-orm/postgres-js` appears anywhere under `.next/static`. The walk now stops at the `"use server"` boundary, which the on-disk bundle scan in the same file continues to police.

## The two stale nested `not-found.tsx` files

Removed, after confirming the boundary holds. `src/app/(store)/products/[handle]/not-found.tsx` and the collections equivalent were dead: the existence check lives in the segment `layout.tsx`, and a layout's `notFound()` resolves from an *ancestor*, so these could never catch it. Verified before and after removal: `/products/does-not-exist` and `/collections/does-not-exist` both return **HTTP 404 with the approved copy**, valid handles still return 200, and the 27 storefront and HTTP-contract specs pass.

## Verification

`typecheck`, `lint`, `db:check` (4 migrations, 9 files), `build` — all exit 0. Jest **68 passed** across 9 suites. RLS **44/44** in-database plus **32/32** on the orchestrator's independent verifier. Playwright **87/87**. Pass-1 acceptance unchanged: no-JS at 375 and 1440 shows 0/5 frames inert, 0 dimmed motion wrappers and 5/5 sections with real copy; 21 of 22 tab stops reachable; **per-band fidelity delta 0.0000 on all five bands**.

## Review findings — status after the hardening pass — 2026-09-02

The COD core was sound from the start: the client submits only `{productHandle, variantId, quantity}`, every amount is recomputed server-side from the published catalog, the database re-asserts the arithmetic, the order token is 256 bits, and the fee fails closed when unconfigured. Ten findings were carried forward from the merge review. Six are now closed.

### Closed

- **Rate limiting.** `placeCodOrder` now runs a sliding window in an in-process `Map`, keyed on the first `x-forwarded-for` entry, then `x-real-ip`: 10 attempts per 60 seconds, checked before parsing and before any database work. Proven: ten pass, the eleventh is refused, a second caller gets a fresh budget and is not locked out by another's burst. Its ceiling is marked with a `ponytail:` comment — the window is per instance, not shared, so a second instance doubles the budget and a restart clears it.
- **Duplicate cart lines.** Coalesced on `(productHandle, variantId)` in `src/features/orders/schema.ts` and re-piped through `cartLineInputSchema`. A cart that sums past the per-line cap is **refused, not clamped** — clamping would silently turn 9,900 units into 99 on an order a courier collects in cash.
- **The escaping database failure.** The whole action body is wrapped; a failure returns a typed `SERVER` result and is logged server-side with a request id. No exception message, stack, SQL fragment or column name reaches the browser.
- **The React 19 form reset.** Submitted values are captured inside the form action and fed back as `defaultValue`, so React's post-action reset restores each field to what the buyer typed instead of blanking it. A controlled `value` would have been the wrong fix: `recursivelyResetForms` calls the DOM `form.reset()` after props commit, clearing the node without changing React state.
- **The missing phone `pattern`.** `pattern="03[0-9]{9}"` with a `title`, so `+923001234567` is refused in the field rather than after a round trip.
- **`getCodShippingFeeAmount` and whitespace.** The value is trimmed before the emptiness check, so unset, empty and whitespace-only all fail closed alike. `"0"` remains a legitimate configured zero.

### Still open

- **No idempotency.** A retried or replayed submission still creates a second order, and therefore a second courier dispatch. The rate limiter bounds the volume; it does not deduplicate. Highest-value remaining follow-up.
- **The buyer's total is never echoed back for confirmation.** A catalog price change between render and submit silently reprices an order the buyer already committed to — under COD that is the cash demanded at the door.
- **`order_reference` is 32 bits** (`randomBytes(4)`) behind a UNIQUE constraint; birthday collisions become insert failures well within a plausible order volume.
- **`order_items` carries no `tenant_id`**, so a future tenant-scoped policy needs a join back through `orders`. The composite currency FK added in 0004 shows the same edge can carry it.
- **`restoreCartLines` in `src/features/catalog/cart.ts` still does not coalesce.** The order path is protected by the schema transform above, but the cart drawer renders duplicate lines with the same React key and `update(key, quantity)` mutates both rows. That file was outside every lane this pass; the root fix belongs there, after which the transform can go.
- **PII retention.** See the production decision below.

### Contract note

`placeCodOrder` no longer returns the ad-hoc `{ ok, message, fieldErrors, orderToken }` shape described earlier in this document. It returns the repository's `Result<T>` from `src/features/result.ts` — `Ok<{ orderToken }> | Err` with `code` drawn from the standard union, `fieldErrors` only on `VALIDATION`, `CONFLICT` for cart-state refusals and `SERVER` for an unconfigured fee or a database failure.

## Migration 0004 — overflow guard and currency integrity — 2026-09-02

Three things the COD tables could not enforce for themselves, closed at the database layer.

**The money columns are now `bigint`, not `int4`.** `cartLineInputSchema` already permits 100 lines × 99 units, and at the seeded price of 599900 minor units that is 5,939,010,000 — past `int4`'s 2,147,483,647 ceiling by construction, not by abuse. Bounding an `int4` would have meant refusing orders the system already promises to accept, so the type changed rather than the promise. Widening alone would have been useless: `int8` does not wrap either, it raises `22003` further out. Two new bounded CHECKs (`orders_amounts_bounded`, `order_items_line_bounded`) close the arithmetic — with `unit_price ≤ 1e12` and `quantity ≤ 99` a line total cannot exceed 9.9e13, and with `subtotal ≤ 1e15` and `shipping ≤ 1e12` a total cannot exceed ~1.0e15, against `int8`'s 9.2e18. Those are headroom, not a business ceiling; `quantity ≤ 99` is `cartLineInputSchema`'s own limit pinned in the database the way 0003 pinned `payment_method` and `country`.

**`orders_amounts_nonnegative` and `order_items_amounts_nonnegative` were rebuilt over `::numeric`.** PostgreSQL promises no evaluation order between CHECK constraints on a row, so in `int8` the arithmetic check could raise `22003` from inside the constraint before the named bound refused the row — a refusal indistinguishable from a driver bug. Measured: an insert of `unit_price_amount = 1e17` returned `22003` before the rebuild and `23514` after.

**Mixed currency is now a database fact.** A CHECK cannot see another table, but a composite FOREIGN KEY can: `order_items(order_id, currency) → orders(id, currency)`, `ON DELETE CASCADE`, backed by a redundant `orders_id_currency_unique` that exists only because a composite FK needs a unique target. Until 0004 this rule lived only in `src/features/orders/actions.ts`. It also refuses changing an order's currency out from under its lines.

Privileges were deliberately untouched — `ALTER COLUMN` does not reset table privileges, RLS stays enabled, and no policy was added for `anon` or `authenticated`. No audit trigger was added to either table: contract D does not audit anonymous callers because a row-per-request write on an unauthenticated endpoint is a denial-of-service amplifier.

`db/tests/rls.test.mjs` grew from 44 to 103 assertions, including the full `anon`/`authenticated`/`service_role` × SELECT/INSERT/UPDATE/DELETE × `orders`/`order_items` matrix, and the harness's `service_role` now carries `BYPASSRLS` as Supabase's does — without it a "service_role can read orders" assertion passes for the wrong reason, because RLS default-deny returns zero rows to a grant-holding role just as it does to one with no grant.

## Production decision — O-003, PII retention — still open, deliberately not implemented

`orders` and `order_items` accumulate a customer's full name, Pakistani mobile number, delivery address and purchase history, indefinitely, with no deletion path. No retention or deletion policy is implemented, and none should be invented in code: `docs/pass-2-contracts.md` section D says so explicitly, and O-003 in the decision log is still open.

What has to be decided before launch, by a person and not by a migration:

1. **How long a fulfilled order's PII is kept.** Fulfilment needs the address for days; tax and dispute records may need the order for years. These are different retention periods on the same row, which usually means the address is erased on a shorter clock than the order.
2. **Whether erasure is deletion or redaction.** `orders.tenant_id` is `ON DELETE RESTRICT` and `order_items` cascades from `orders`, so a hard delete of an order takes its line items with it and loses the sales record. Overwriting the five PII columns keeps the arithmetic and destroys the identity, which is usually what is actually wanted.
3. **Who may execute it.** Today no database role can reach these tables except the owning application connection and `service_role`. A retention job needs one of those, not a new grant to `anon` or `authenticated`.
4. **Whether erasure is audited.** It is a privileged mutation, so contract D would have it write an `audit_events` row — but `before`/`after` there carry the status only, and an audit row naming what was erased would re-create the PII it erased.

Until that decision exists, the correct state is the current one: the data is unreachable by every role that a browser can hold, and nothing deletes it silently.
