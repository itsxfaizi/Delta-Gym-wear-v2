# Delta Gym Wear — Master Delivery Plan

## Current baseline (2026-08-30)

The approved public slice is implemented: catalog → `/products/[handle]` → colour/size selection → persistent cart → accessible cart drawer. Supabase-first foundation, Drizzle schema/checks, Jest, Playwright, semantic tokens, local asset validation, metadata, and Product JSON-LD are present. Authoritative local assets include the dark logo SVG and Catalog Normal/Hover crops; product imagery remains development seed content.

Graphify is available through the host Python launcher as `py -m graphify`. Existing `graphify-out/graph.json` and Obsidian exports are maintained as contextual evidence.

## Phases and gates

| Phase | Owner(s) | Depends on | Status / output | Gate / stop condition |
| --- | --- | --- | --- | --- |
| 0. Repository re-baseline | [Main Orchestrator], [PR reviewer] | — | Complete: routes, scripts, env, DB, tests, docs audited | Baseline checks reproducible; no destructive cleanup |
| 1. Product/source governance | [Product/BA], [Design systems/UI-UX] | 0 | Complete: requirements, audit, route inventory, manifest, ADR | Every implemented route traceable; blocked routes name exact inputs |
| 2. Design system/asset pipeline | [Design systems/UI-UX], [Frontend], [QA/accessibility] | 1 | Complete for current slice: semantic tokens, local assets, validation, focus/reduced motion | Missing local assets fail in development; no invented assets |
| 3. Storefront core quality | [Frontend], [Backend], [QA/accessibility] | 2 | Complete: catalog/PDP/variants/cart/drawer and states | Full journey passes all required checks and breakpoints |
| 4. Visual-fidelity closeout | [Design systems/UI-UX], [Frontend], [QA/accessibility] | 3 | In progress: dark logo and card Normal/Hover integrated; only one product crop family | Resolve or document every mismatch; valid Circles export required for motion |
| 5. Source-backed expansion | [Product/BA], [Design systems/UI-UX], [Frontend], [Backend], [QA/accessibility] | 4 + approved sources | Blocked per route inventory | Do not implement without authoritative desktop/responsive source evidence |
| 6. Admin publishing workflow | All relevant roles | 5 + admin approval | Deferred; no approved admin Figma | Requires admin frames or explicit deviation approval |
| 7. Commerce activation | [Product/BA], [Backend], [Frontend], [QA/accessibility] | Explicit product/provider decisions | Deferred | No code until market, payment, tax, shipping, returns, account, legal decisions exist |
| 8. Release readiness | [QA/accessibility], [PR reviewer], [PR description writer] | 3/4 complete; scope blockers resolved/deferred | Ongoing evidence collection | All blockers resolved or formally deferred with owner/rationale |

## Work-package dependencies

1. Maintain manifest/audit/traceability and source hierarchy.
2. Maintain typed catalog queries and development asset validation.
3. Maintain public UI and accessibility states.
4. Compare at 320/768/1024/1440 and retain screenshots.
5. Review scope, security, image handling, metadata, migration/rollback, and dependency risk.

## Verification command set

`npm run lint`; `npm run typecheck`; `npm test -- --runInBand`; `npm run build`; `npm run db:check`; `npm run test:e2e`.

## Not approved / deferred

Admin UI, checkout, payments, customer accounts, analytics, email, external integrations, new commerce rules, invented policy/category content, unverified motion, and routes without approved source/responsive evidence.

## Stop conditions

Stop visual implementation when a route lacks authoritative Figma/local evidence. Stop integration when a required asset is missing or provenance is unclear. Stop release claims when visual, accessibility, security, or scope blockers lack evidence or formal deferral.
