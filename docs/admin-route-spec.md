# Proposed admin route spec — Delta Gym Wear

**Status:** Proposal only; no admin UI is implemented. Approval and Figma source frames are required before any route screen is built.

## Boundary

The admin manages the same tenant-owned product/catalog records used by the public catalog and product detail routes. It is protected by the approved Supabase-first authentication and server-side role checks. This document defines route intent and state contracts, not visual layout.

## Proposed routes

| Route | Purpose | Allowed roles | Required outcomes |
| --- | --- | --- | --- |
| `/admin/products` | List tenant products with status filter and safe entry points | `owner`, `catalog_editor`, `publisher`, `auditor` | loading, empty, error, denied |
| `/admin/products/new` | Create a new product in `draft` | `owner`, `catalog_editor` | field validation, save success/failure |
| `/admin/products/[id]/edit` | Edit a draft or unpublished product with optimistic version check | `owner`, `catalog_editor`; `publisher` read/preview | validation, stale-version conflict, save success/failure |
| `/admin/products/[id]/preview` | Preview the selected revision without making it public | authenticated tenant members | unavailable, denied, revision-not-found |
| `/admin/products/[id]/history` | Read immutable revisions and audit events for one product | `owner`, `publisher`, `auditor` | empty, denied, recoverable load error |

No dashboard, media library, member management, scheduler, or checkout/admin order route is proposed for this slice.

## State actions

| Transition | Roles | Guard |
| --- | --- | --- |
| `draft → published` | `owner`, `publisher` | validated revision, expected version, transactional audit event |
| `published → unpublished` | `owner`, `publisher` | explicit confirmation, transactional audit event |
| `unpublished → draft` | `owner`, `catalog_editor` | expected version, transactional audit event |
| `unpublished → archived` | `owner` | explicit named-entity confirmation, transactional audit event |
| `archived → draft` | `owner` | restore confirmation, transactional audit event |

Direct `published → archived` is disallowed. Review and scheduling are deferred.

## Authorization and failure contract

- Unauthenticated requests return the selected login/401 behavior once the auth UX is approved.
- Authenticated users without the required tenant role receive a non-disclosing 403 state.
- Every mutation validates input at the server boundary and returns typed, user-safe errors.
- Public storefront queries can resolve only the current `published` revision; admin preview/history never leaks to public routes.

## Figma dependency

The source file has no approved admin frames. Before implementation, provide or approve Figma frames for the admin list, editor, preview, history, and responsive states, then map each route to exact node IDs and record any accessibility/responsive deviations in `docs/figma-audit.md`.
