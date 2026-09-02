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

## Review findings NOT fixed — carried forward

The COD implementation was reviewed by five agents with adversarial verification. Its core is sound: the client submits only `{productHandle, variantId, quantity}`, every amount is recomputed server-side from the published catalog, the database re-asserts the arithmetic, the order token is 256 bits, the fee fails closed when unconfigured, and mixed-currency carts are rejected. These remain open and are **not** addressed by this merge:

- **No rate limit on `placeCodOrder`.** It is an unauthenticated public POST that writes database rows, and COD has no payment step, so the cost to an attacker is zero. Highest-value follow-up.
- **Duplicate cart lines are never coalesced.** `restoreCartLines` resolves each submitted line independently, so 100 lines × 99 units is legal input; at the seeded price that overflows the `int4` money columns (5.9 billion against a 2.15 billion ceiling).
- **No idempotency.** A retried or replayed submission creates a second order, and therefore a second courier dispatch.
- **The buyer's total is never echoed back for confirmation.** A catalog price change between render and submit silently reprices an order the buyer already committed to — under COD that is the cash a courier demands at the door.
- **React 19 resets the uncontrolled checkout form on every server-side rejection,** wiping name, phone and address. The phone rule `/^03\d{9}$/` has no client-side `pattern`, so anyone typing `+92…` hits it.
- **A database failure escapes the action** and lands the buyer on the store error boundary reading "We couldn't load the collection", with no way to tell whether the order was created.
- **`order_reference` is 32 bits** (`randomBytes(4)`) behind a UNIQUE constraint — birthday collisions become insert failures well within a plausible order volume.
- **`getCodShippingFeeAmount` treats a whitespace-only value as zero** (`Number(" ") === 0`), silently yielding free delivery.
- **`order_items` carries no `tenant_id`**, so any future tenant-scoped policy needs a join back through `orders`.
- **PII retention is undecided.** O-003 is still open, and these tables now accumulate real customer names, phone numbers and addresses with no deletion path.
