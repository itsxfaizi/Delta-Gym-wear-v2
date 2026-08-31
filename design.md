# Design Contract: Brand Storefront + Admin Console

## Purpose

This is the visual and interaction contract for a Figma-first Next.js build. It deliberately does not prescribe a brand, catalog model, payment provider, CMS, or user roles until those are supplied by the user or Figma source.

## Figma-first workflow

1. Confirm the Figma file and target pages/frames with the user.
2. Inspect the component library, variables, modes, typography, grids, assets, variants, prototype flows, and responsive frames through Figma MCP.
3. Create `docs/figma-audit.md` with exact source links/node IDs, token mapping, component inventory, asset checklist, and implementation gaps.
4. Translate Figma variables into semantic design tokens such as `--color-surface`, `--color-text-primary`, `--space-4`, and `--radius-control`; do not code against opaque Figma names or raw values.
5. Implement foundational primitives before feature screens. Compare each completed route with its source frame at mobile and desktop widths; record visual evidence, intentional deviations, and design approval before release.

Confirmed requirements, accessibility, security, and responsive usability override a Figma frame; record the approved deviation in `docs/figma-audit.md`.

### Offline design-reference fallback

If Figma MCP is temporarily unavailable, exact exports supplied by the user are an accepted source for implementation. Create `design-reference/manifest.md` before using them. Each entry must identify the Figma node URL, route/component, desktop or mobile viewport, source asset filename, and any unavailable interaction/motion detail. Never treat an unlabeled screenshot as a complete product specification.

## Product surfaces

### Public brand/storefront

The final information architecture comes from approved requirements and Figma. Plan for these capability areas only when confirmed: discovery, collections, detail pages, editorial content, account, cart/checkout, and search. Every public route needs intentional loading, empty, error, and unavailable states. Do not expose cart or checkout until price, currency, availability, tax/shipping, returns, and applicable legal requirements are confirmed.

### Admin control room

The admin experience should prioritize scanability, safe publishing, and predictable state transitions:

- dashboard: meaningful metrics and recent activity only when data is defined;
- content: drafts, review, scheduled, published, archived; filters represented in the URL;
- editor: autosave status, validation, preview, version-conflict resolution, revision history, and restore/rollback when the domain permits it;
- scheduling: a defined timezone, server-authoritative time, missed-schedule/retry behavior, and role-restricted publish/unpublish;
- media: metadata, alt text, rights/source where applicable, and deletion protection;
- catalog or collections: only if the product scope includes them;
- people/roles and audit log: only if auth and authorization scope includes them.

Destructive confirmation names the exact affected entity and consequence; offer undo/restore where technically possible. Do not create fake analytics, arbitrary charts, or business metrics. Clearly label mocked/seeded data until real integrations exist.

## UX and visual quality

- Build a distinct system from the approved brand—not generic dark-mode cards, oversized rounded containers, purple gradients, or copied competitor patterns.
- Use real or clearly marked representative content early; content length must drive layout.
- Use a constrained spacing scale, semantic color tokens, and a consistent type hierarchy. One `h1` per page; do not skip heading levels.
- Prefer progressive disclosure, inline validation, contextual actions, and reversible destructive flows.
- Use skeletons for content loading; errors explain what failed and provide a recovery action; empty states explain the next useful action.
- Buttons must express intent: primary for the single dominant action, secondary for alternatives, destructive only for irreversible actions.

## Motion

Motion clarifies hierarchy and feedback; it is never decoration.

- Use 120–200 ms for control feedback and 180–280 ms for entry/exit; avoid large layout shifts and continuous ambient motion.
- Animate only `opacity` and `transform` where possible. Disable or substantially reduce nonessential motion under `prefers-reduced-motion`.
- Keep an action's response immediate, even when its visual transition continues. Never hide errors or status behind motion.

## Accessibility acceptance criteria

- WCAG 2.2 AA contrast and target sizes.
- Full keyboard operation with visible focus and logical focus order.
- Dialogs trap focus, restore it on close, and expose an accessible name/description.
- Forms have programmatic labels, concise error summaries, and field-level errors.
- Images have purposeful alt text; decorative images are hidden from assistive technology.
- Announce autosave, publish, and error outcomes without disrupting focus. Tables expose accessible sorting/filtering; drag reordering has a keyboard alternative; status never relies on color alone.
- Responsive QA at 320, 768, 1024, and 1440 px without clipped controls or horizontal overflow.
