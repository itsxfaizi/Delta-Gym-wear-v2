# Delivery Playbook

## Token-efficient orchestration

The orchestrator keeps one source of truth: accepted requirements, Figma audit, decisions, and acceptance criteria. It delegates only bounded, independent tasks; each agent receives relevant links/paths and returns a concise evidence-based report. Do not make agents rediscover the entire repository or debate the same decision.

Use `docs/implementation-plan.md` as the execution order and do not begin a milestone until its preceding gate is satisfied.

If Figma MCP is quota-blocked, switch once to the documented `design-reference/` export workflow in `AGENTS.md`; do not spend further quota on retries. Treat the manifest and exact user-provided exports as the temporary visual source of truth.

When browser access is available, use the browser-based Figma workflow in `AGENTS.md` to create the local reference pack. Only proceed to storefront UI after the relevant screen, assets, and motion entries are verified in `design-reference/manifest.md`.

## Milestones

1. **Discovery** — Product/BA turns the brief into questions, roles, flows, non-goals, acceptance criteria, and a requirement traceability table. Block implementation on unresolved material choices.
2. **Figma audit** — Design agent maps frames, tokens, assets, responsive behavior, variants, and gaps. The user approves any interpretation that changes the design.
3. **Foundation** — Architecture is approved; scaffold Next.js, lint/type/test tooling, tokens, primitives, auth boundary (when selected), and CI. Document supported Node/package-manager versions, exact CI commands, test tiers, preview-environment policy, and blocking thresholds before relying on CI.
4. **Vertical slice** — Deliver one public journey plus its corresponding admin workflow end to end, with real state transitions and tests.
5. **Expansion** — Add confirmed domains in independently reviewable slices.
6. **Release readiness** — QA, accessibility, performance, security, content, and operational runbook checks complete; PR reviewer signs off on evidence.

## Agent handoff format

Every agent response contains: objective, files/frames examined, decisions made or blocked, acceptance evidence, risks, and exact next handoff. Agents do not modify files outside their assigned ownership.

## Pull-request gate

Before opening a PR, the orchestrator verifies: scope traceability, Figma comparison evidence, lint, typecheck, unit/integration/e2e tests appropriate to the change, accessibility checks, responsive screenshots, `prefers-reduced-motion` behavior, performance/bundle and image-optimization impact, migration and rollback plan if applicable, no secret leakage, and dependency justification.

The PR description must include problem, approach, user-visible changes, design references, test evidence, risks, rollout/rollback, and follow-ups. It must distinguish verified facts from planned work.

## Orchestrator progress log — 2026-08-30

- [Main Orchestrator] Re-read the delivery contracts, local manifest/audit, and installed Next.js App Router guidance before changes.
- [Design systems/UI-UX] Attempted Phase 4B browser-only export closeout; in-app browser was unavailable, so no unverified asset substitutions were made. Blockers recorded in the manifest and Figma audit.
- [Frontend] Replaced storefront raster `<img>` usage with Next.js image handling for local logo, product, cart, and icon assets; preserved approved cart/PDP behavior and development-seed boundary.
- [QA/accessibility] Re-ran lint, typecheck, Jest, production build, Drizzle check, and Playwright smoke tests. All pass; visual fidelity blockers remain due to unavailable dark logo/additional product crops.
- [Design systems/UI-UX] Owner supplied a dark logo raster; it is stored as a clearly labeled temporary user-provided asset, with vector/export limitations recorded in the manifest and audit.
