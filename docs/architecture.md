# Architecture Contract

## Status

Greenfield. The following is a decision framework, not a claim that a database, CMS, payment system, or authentication provider has been selected.

## Baseline

- Next.js App Router + TypeScript strict mode.
- Server Components for data access and composition; Client Components only for browser-only or interactive behavior.
- Route groups separate public and protected admin shells: `src/app/(store)/...` and `src/app/(admin)/admin/...`.
- `src/app/api/` is limited to webhooks, integrations, public endpoints, and non-UI clients. Same-origin form mutations use server actions after validation.

## Proposed layout

```text
src/
  app/
    (store)/
    (admin)/admin/
    api/
  components/
    ui/                 # token-based primitives
    shared/             # cross-domain compositions
  features/
    <domain>/
      components/
      actions.ts
      queries.ts
      schema.ts
      types.ts
      <domain>.service.ts
  server/
    auth/
    db/
    jobs/
    observability/
    authorization/
  lib/
  styles/
  emails/
  test/
    fixtures/
    e2e/
db/
  migrations/
  seeds/
```

## Boundary rules

- `features/<domain>/schema.ts` owns runtime input validation. Validate action, route, webhook, and form data before use.
- `server/` modules are server-only and may handle secrets, sessions, persistence, and authorization. They must never be imported by Client Components.
- Services enforce domain rules; pages and components do not perform authorization or persistence directly.
- Queries use explicit projections and pagination. Mutations return typed, user-safe results and revalidate affected paths/tags.
- Permissions are enforced on the server for every read/write containing protected information. Hiding a button is not authorization.
- A publishing workflow, when in scope, defines permitted transitions, responsible roles, concurrency policy, schedule failure/retry behavior, and an auditable transition record before implementation.

## Naming rules

| Concept | Convention | Example |
| --- | --- | --- |
| route | plural kebab-case domain noun | `/admin/posts` |
| UI component | PascalCase noun | `PublishingScheduleDialog.tsx` |
| server action | verb + singular domain noun | `publishPost` |
| query | `get`/`list` + domain | `listPublishedPosts` |
| service | domain + `.service` | `post.service.ts` |
| schema | domain + intent | `publishPostSchema` |
| database table | plural snake_case | `content_posts` |
| database column | snake_case | `published_at` |
| API JSON | camelCase | `publishedAt` |

## Data and operational decisions that require approval

Do not select or implement these without an explicit decision: brand identity, product/content types, release mode (editorial storefront, catalog/inquiry, or transactional commerce), tenant/ownership model, user roles and permissions, authentication provider, database/ORM, CMS, media storage, payments/tax/shipping, analytics, localization, email, legal requirements, retention policy, and deployment target.

Record approved choices in `docs/decisions/ADR-<number>-<kebab-case-title>.md` with context, decision, consequences, and rollback path.

## Security and reliability baseline

- Validate environment variables at startup; keep secrets server-only.
- Authenticate and authorize every protected action. Add audit events for privileged admin changes.
- Verify webhook signatures, use idempotency keys where providers support them, and rate-limit exposed mutation endpoints.
- Define upload type/size limits, malware-scanning policy, safe remote-media fetching, security-header policy, and dependency-vulnerability response before accepting production media.
- Use structured logs with request/correlation IDs; never log credentials, raw payment data, or sensitive personal data.
- Define backup, recovery, retention, and deletion behavior before handling real customer content.
