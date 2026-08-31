# Codex Delivery Harness

## Mission

Build a production-ready, Figma-faithful brand/storefront and operations console in Next.js. The public site must feel editorial and branded; the admin is an efficient control room for publishing and managing content. Do not interpret "like Spotify" as permission to copy Spotify UI, product behavior, assets, or trade dress. Use it only as a benchmark for fast content operations, clear hierarchy, and polished playback-like browsing states where applicable.

## Priority order

1. Distinct, high-quality visual design and Figma fidelity.
2. Deliberate, polished interactions and motion.
3. Clear, fast, accessible user journeys.
4. Reliable, secure, maintainable product behavior.

Priorities do not permit a tradeoff against accessibility, performance, responsive usability, or security. Motion must reinforce hierarchy and feedback, follow the approved Figma source where present, and honor `prefers-reduced-motion`.

## Operating model

The main agent is the orchestrator. It owns scope, sequencing, integration, verification, and the final PR. It does not parallelize ambiguous discovery or overlapping code changes.

Before implementation, the orchestrator must:

1. Read `design.md`, `docs/architecture.md`, and `docs/delivery-playbook.md`.
2. Use Figma MCP to inspect the named source file, pages, variables, components, and target frames. Never invent Figma URLs, node IDs, tokens, or assets.
3. Produce a short decision record for every unresolved product choice. Ask the user when a choice materially affects scope, brand, permissions, commerce, compliance, or data retention.
4. Split execution into independent, non-overlapping work packages. Give each agent a bounded output, acceptance criteria, and file ownership.

If there is no approved Figma frame, a required document is missing, or design conflicts with confirmed requirements, stop visual implementation and record the gap. Accessibility, security, and approved product decisions override a source frame; document each visual deviation in `docs/figma-audit.md`.

### Figma MCP quota fallback

When Figma MCP design-context access is quota-blocked, do not repeatedly retry it or recreate screens from memory. The user may instead provide exact exported Figma artifacts: full-frame PNGs, SVG/vector icons, original image/video files, and motion exports. Store supplied artifacts under `design-reference/` with a `manifest.md` recording the original Figma URL/node ID, export date, intended route/component, viewport, source filename, and whether the artifact is authoritative or a fallback. Use those artifacts faithfully; document every unavoidable deviation in `docs/figma-audit.md` and request approval before implementing an ambiguous state. Resume MCP context inspection when access returns.

### Browser-based Figma workflow

If the signed-in Figma browser is available but Figma MCP is unavailable, use the in-app browser as the export surface. Do not treat browser access as a substitute for unspecified product behavior.

1. Open the current Figma file and confirm it is signed in and accessible; record its file URL/key in `design-reference/manifest.md`.
2. Select an exact top-level frame in the Layers panel, zoom to selection, and visually verify its name, dimensions, and intended route/component.
3. Export the selected frame as PNG. Move the download into `design-reference/exports/` with a descriptive kebab-case filename; record the date, dimensions, and selected layer in the manifest.
4. Export original product images, brand mark, and icons separately into `design-reference/assets/`; retain original filenames or document an explicit mapping. Never redraw a vector asset by hand.
5. Export any authored timeline/video motion and a static resting frame into `design-reference/motion/`; reduced motion must use the static frame.
6. Verify every local artifact exists and matches the manifest before implementation. Missing mobile/tablet frames, interaction states, or asset details remain approval gates.

Browser exports are authoritative only for the exact selected layer and export settings. If browser selection lacks a stable Figma node ID, record the file URL plus the exact layer name and state that the node ID is unavailable because MCP is offline.

## Team roles

Use the prompts in `.codex/agents/` as role contracts. Start only the roles needed for the current milestone.

The role is deliberately the first part of each filename: `01-product-business-analyst.md` through `07-pr-description-writer.md`.

| Role | Owns | Must not own |
| --- | --- | --- |
| Product/BA | requirements, flows, acceptance criteria | UI implementation |
| Design systems/UI-UX | Figma audit, tokens, page specs | API/schema changes |
| Frontend | route UI, components, client interaction | migrations/auth policy |
| Backend | data model, authz, server actions/routes | visual redesign |
| QA/accessibility | test plan and independent verification | feature scope changes |
| PR reviewer | risk review, regression and convention checks | direct unrequested rewrites |
| PR writer | accurate title, summary, test evidence | claiming unverified work |

The orchestrator approves typed domain contracts before frontend/backend work runs in parallel: entities, ownership, states, inputs/outputs, validation failures, and authorization outcomes. Each design handoff must include Figma node links, responsive rules, interaction states, assets, accessibility notes, and approved deviations.

## Engineering non-negotiables

- Use Next.js App Router and TypeScript strict mode. Default to React Server Components; isolate `use client` at the smallest interactive boundary.
- Treat Figma variables and components as the source of visual truth. Extract semantic tokens; never scatter raw colors, arbitrary spacing, or duplicate component definitions.
- Keep public routes and admin routes separate. Every admin mutation requires authentication, authorization, validation, auditability, and a clear success/error state.
- Prefer server actions for same-origin mutations; use route handlers for public APIs, webhooks, integrations, or non-UI clients. Validate all untrusted input at the boundary.
- Build mobile-first and test 320, 768, 1024, and 1440 px. Meet WCAG 2.2 AA: semantic HTML, keyboard operation, visible focus, accessible names, contrast, motion reduction, and usable error states.
- Respect `prefers-reduced-motion`; animate opacity/transform only, keep motion purposeful, and avoid blocking interaction.
- Do not add a dependency unless its value, maintenance posture, bundle cost, and accessibility impact are justified in the PR.
- Never put secrets in source, browser bundles, commits, screenshots, or fixtures. Use environment validation and least-privilege credentials.
- Define the tenant/ownership model before persistence work; enforce it in every protected query and mutation.
- Before real admin release, obtain approval for MFA, expiry/rotation, revocation, CSRF posture, brute-force protection, and bootstrap-admin policy.
- Use append-only audit entries for privileged events, with actor, action, target type/id, timestamp, request/correlation ID, outcome, and safe before/after metadata. Include publish/archive/delete/role changes; define retention and access policy before production.

## Naming and organization

- Folders and files: `kebab-case`; React components and types: `PascalCase`; functions, variables, props: `camelCase`; constants: `SCREAMING_SNAKE_CASE` only for true constants.
- Use domain terms consistently: singular entities (`Post`, `Product`, `Collection`); plural route segments (`/products`); intent-based verbs (`publishPost`, `archiveProduct`). Do not use vague names such as `data`, `utils`, `helpers`, `manager`, or `handleThing`.
- Keep domain logic in `src/features/<domain>/`; reusable UI in `src/components/`; server-only libraries in `src/server/`; shared pure utilities in `src/lib/`.
- One component per file unless tightly coupled. Co-locate tests, schema, hooks, and component-specific types with their feature.

## Definition of done

A work package is done only with its stated acceptance criteria, typecheck/lint/tests passing, responsive and keyboard verification, loading/empty/error states, and documentation updated. Evidence includes Figma comparison or approved deviation, breakpoint screenshots, keyboard walkthrough, and permission-state verification where relevant. First admin publishing flows require server-validation, negative-authorization, audit-event, and end-to-end coverage.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `py -m graphify query "<question>"` when graphify-out/graph.json exists. Use `py -m graphify path "<A>" "<B>"` for relationships and `py -m graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `py -m graphify update .` to keep the graph current (AST-only, no API cost).
