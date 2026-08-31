# Delta Gym Wear — Project Graphs

## Delivery phase dependency graph

```mermaid
flowchart LR
  P0[Phase 0 baseline] --> P1[Phase 1 governance]
  P1 --> P2[Phase 2 design/assets]
  P2 --> P3[Phase 3 storefront core]
  P3 --> P4[Phase 4 visual closeout]
  P4 --> P5[Phase 5 source-backed expansion]
  P5 --> P6[Phase 6 admin approval/workflow]
  P6 --> P8[Phase 8 release readiness]
  P3 --> P8
  P4 -. explicit commerce decisions .-> P7[Phase 7 commerce activation]
  P7 --> P8
```

## Storefront data flow

```mermaid
flowchart LR
  DB[(Supabase Postgres)] --> Q[Typed catalog queries]
  Seed[Development seed + local assets] --> Q
  Q --> R[Server route]
  R --> UI[Catalog / PDP server composition]
  UI --> C[Client interaction island]
  C --> V[Variant validation]
  V --> Cart[Scoped local cart]
  Cart --> Drawer[Accessible cart drawer]
```

## Product publishing lifecycle

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> published: publisher/owner
  published --> unpublished: publisher/owner
  unpublished --> draft: catalog_editor/owner
  unpublished --> archived: owner
  archived --> draft: owner restore
```

## Route-to-source coverage

```mermaid
flowchart TD
  F10[Figma frame 10 + card crops] --> Catalog[/ catalog]
  F14[Figma frame 14 + image crops] --> PDP[/products handle]
  F13[Figma frame 13 + cart icons] --> Cart[cart drawer]
  Motion[Circles motion: invalid export] -. blocked .-> Landing[landing]
  Missing[No approved responsive/source evidence] -. blocked .-> Expansion[home/collections/search/policies/admin]
```

## Test and release gates

```mermaid
flowchart LR
  Code[Scoped code/assets] --> Lint[lint]
  Lint --> Types[typecheck]
  Types --> Unit[Jest]
  Unit --> Build[production build]
  Build --> DBCheck[Drizzle check]
  DBCheck --> E2E[Playwright]
  E2E --> Visual[responsive screenshots + comparison]
  Visual --> A11y[keyboard/reduced motion]
  A11y --> Review[PR review + truthful release record]
```
