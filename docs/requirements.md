# Delta Gym Wear — Discovery Requirements (Phases 0–1)

## Status and evidence

**Status:** Draft; not approved for implementation. This document defines discovery requirements only and does not select commerce, authentication, data, brand, or operational policies.

**Evidence:** User brief (2026-08-30); `AGENTS.md`; `design.md`; `docs/architecture.md`; `docs/delivery-playbook.md`; `docs/implementation-plan.md`. The Figma audit is the pending source of route/frame evidence; see `docs/figma-audit.md` when completed.

## MVP scope boundary

The intended product has two surfaces: a Figma-faithful public brand/storefront and a separate operations console for safe publishing and management. Phase 0 defines the MVP boundary; phase 1 maps only approved Figma surfaces, components, tokens, assets, responsive behavior, and authored motion.

The smallest later vertical slice must pair one confirmed public storefront journey with its matching authenticated, authorized admin workflow. It must use approved content/entity states, validated mutation inputs, explicit permission outcomes, auditability for privileged changes, responsive behavior, accessible interaction, and reduced-motion behavior.

### Explicitly out of scope for phases 0–1

- Application scaffolding, UI implementation, schema/API development, integrations, or production configuration.
- Any inferred checkout, cart, payment, tax, shipping, returns, account, search, inventory, localization, analytics, CMS, database, media-storage, authentication, or deployment behavior.
- Invented brand rules, copy, assets, metrics, user roles, permissions, or admin workflow transitions.
- Claims that unapproved Figma frames represent product requirements.

## Goals and success boundary

- Establish an approved release mode and a bounded first vertical slice before implementation.
- Establish exact Figma evidence and the responsive/accessibility/motion expectations for every in-scope route.
- Identify material decisions that block safe commerce, protected administration, persistence, or publishing.
- Make later acceptance tests traceable to an approved requirement or exact Figma source.

Success for this discovery milestone is a user-approved MVP scope, first vertical slice, and resolution/deferral record for all material blockers.

## Actors and roles

| Actor | Intended outcome | Approval status |
| --- | --- | --- |
| Public visitor | Discover and view the approved public content/product journey. | Surface confirmed; specific journey is unapproved. |
| Store/operator user | Manage the content/product that powers the approved matching public journey. | Console confirmed; identity, permissions, and workflow are unapproved. |
| Administrator/publisher/reviewer | Potential publishing responsibilities indicated by architecture/design guidance. | **Unapproved; do not implement as roles.** |

No permission matrix can be approved until actor identities, role names, ownership/tenant model, and protected actions are selected.

## Jobs to be done and candidate flows

### Public visitor

**Job:** When exploring Delta Gym Wear, I want to move through the approved storefront information so that I can evaluate the presented offering.

**Candidate flow — requires approval and Figma evidence:**

1. Enter a confirmed public route.
2. Browse a confirmed discovery/listing/editorial surface.
3. Open a confirmed detail surface.
4. View clearly available, loading, empty, unavailable, or error states as applicable.
5. Complete only the approved next action. Cart, checkout, inquiry, account, and purchase are blocked unless explicitly decided.

### Store/operator user

**Job:** When maintaining the approved public content/product, I want a protected operational flow so that I can make the confirmed change safely and know its outcome.

**Candidate flow — requires approval:**

1. Authenticate through the selected provider and receive a permitted or denied outcome.
2. Locate the matching entity/work item.
3. Create or modify an approved draft/editable state with boundary validation.
4. Request, approve, schedule, publish, unpublish, archive, or restore only where the selected workflow permits it.
5. Receive clear success/error/conflict feedback; privileged changes create an append-only audit entry.

## Content/workflow state constraints

`draft`, `review`, `scheduled`, `published`, and `archived` are candidate states only. They become requirements only if the user confirms the relevant domain and transition policy. Before any publishing implementation, define allowed transitions, responsible roles, concurrency behavior, timezone/server-time behavior, missed-schedule and retry behavior, undo/restore, and audit-event retention/access.

## Cross-cutting acceptance criteria

These apply once a vertical slice is approved; they do not authorize implementation now.

1. Each in-scope route maps to an approved Figma frame/node and documented responsive behavior; deviations require approval and entry in the Figma audit.
2. Public and admin surfaces are separately routed; protected reads and mutations enforce server-side authentication and authorization selected by the user.
3. Every untrusted input is validated at its boundary; success, validation failure, denied permission, conflict, unavailable, loading, empty, and recoverable error behavior are specified where applicable.
4. Privileged publish/archive/delete/role-change events are auditable with actor, action, target, timestamp, correlation/request ID, outcome, and safe before/after metadata, subject to a defined retention/access policy.
5. The approved journey works at 320, 768, 1024, and 1440 px without clipped controls or horizontal overflow, supports keyboard operation and visible focus, and meets WCAG 2.2 AA requirements described in `design.md`.
6. Authored Figma motion is reproduced only after exact inspection; motion is purposeful, uses non-blocking opacity/transform where feasible, and is disabled or substantially reduced under `prefers-reduced-motion`.
7. No cart/checkout is exposed before price, currency, availability, tax, shipping, returns, and applicable legal requirements are confirmed.

## Edge cases to resolve before slice design

- A public route has no approved desktop/mobile Figma source, ambiguous intended action, or missing asset/license/alt-text information.
- Content is unavailable, empty, loading slowly, or fails to load.
- An operator is unauthenticated, unauthorized, uses an expired/revoked session, or has only partial permissions.
- Concurrent edits, a stale preview, a validation failure, an unsuccessful schedule, or a missed publishing time occurs.
- A destructive action targets the wrong entity or must be reversed.
- A user has reduced-motion enabled or uses keyboard/screen-reader interaction.
- The release mode is transactional but a payment, currency, inventory, tax, shipping, returns, legal, and order/support policy is not defined.

## Material open decisions (ranked)

| Rank | Decision required | Why it blocks | Needed from |
| --- | --- | --- | --- |
| 1 | Release mode: editorial storefront, catalog/inquiry, or transactional commerce | Determines the public journey and whether cart/checkout work is allowed. | User |
| 2 | First vertical slice: exact public journey and matching admin-managed entity/workflow | Determines scope, route/frame selection, state model, and acceptance tests. | User, informed by Figma audit |
| 3 | Product/content entities, source of truth, and ownership/tenant model | Required before persistence, protected queries, and mutations can be designed. | User |
| 4 | Actors, roles, permission matrix, bootstrap-admin policy, authentication/session provider and security posture | Required for any admin workflow and authorization testing. | User |
| 5 | Publishing/workflow policy: allowed states/transitions, approvers, scheduling timezone/retry/conflicts, audit retention/access | Required for safe publish operations. | User |
| 6 | If commerce: target market, currency, price/availability authority, payment provider, tax, shipping, returns, legal and customer-account policy | Required before transactional behavior is designed or exposed. | User |
| 7 | Data stack: database/ORM, CMS, media storage/uploads, retention/deletion, backups/recovery | Required before persistent/admin/media behavior is designed. | User |
| 8 | Brand/content governance: approved copy/assets, image rights, alt-text ownership, localization, analytics, email, hosting/observability | Affects route content, compliance, and release operations. | User |

## Traceability

| Requirement ID | Requirement | Evidence/source | Status | Validation evidence |
| --- | --- | --- | --- | --- |
| R-01 | Build separate public and admin surfaces for an eventual Next.js App Router product. | `AGENTS.md`; `docs/architecture.md` | Confirmed direction | Route and authorization review after scope approval |
| R-02 | Treat Figma as visual truth; record exact frames/tokens/assets/responsive and motion evidence before visual implementation. | User brief; `design.md`; plan phase 1 | Pending audit | `docs/figma-audit.md` exact node links |
| R-03 | Do not select unapproved brand, commerce, authentication, database, or API behavior. | User brief; `design.md`; architecture | Confirmed constraint | Decision log/user approvals |
| R-04 | Pause before implementation for material first-slice decisions. | User brief; delivery plan gates | Confirmed gate | Approved MVP/slice record |
| R-05 | Admin mutation safety requires authentication, authorization, validation, auditability, and visible result states. | `AGENTS.md`; architecture | Conditional on admin scope | Negative-authorization, validation, audit tests |
| R-06 | Accessibility, responsive behavior, and reduced motion are release constraints. | `AGENTS.md`; `design.md` | Confirmed constraint | Keyboard, screen-reader, breakpoint, reduced-motion evidence |
| R-07 | Do not expose cart/checkout before commercial prerequisites are defined. | `design.md` | Confirmed constraint | Scope review and journey test |

## Decision record required before scaffolding

Once the Figma audit identifies candidate routes, record each user-approved material choice in `docs/decisions/ADR-<number>-<kebab-case-title>.md` with context, decision, consequences, and rollback path, as required by the architecture contract.
