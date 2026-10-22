# Deployment runbook — Vercel + Supabase

This covers deploying the current app (COD storefront + admin console, no payment
gateway) to Vercel against the existing Supabase project. It assumes the Supabase
project and database already exist and the `db/migrations/**` SQL has already been
applied — this runbook does not run migrations or touch the schema.

## Feedback expansion release order

Apply migrations in order: `0003_feedback_expansion.sql`, `0004_product_image_storage.sql`, `0005_admin_database_hardening.sql`, `0006_product_image_retention.sql`, then `0007_audit_retention.sql`. Verify the intended project and its migration history first. The build does not apply migrations. Existing prices remain in integer paisa; admin forms accept and display rupees and convert at the server boundary. Product audience and garment type are separate nullable classifications.

Migration 0004 creates the public-read `product-images` bucket for JPG, PNG, and WebP up to 5 MB. Staff upload authorization runs on the server, which issues a signed upload URL. Image bytes live in Storage; the database stores URL, object path, ordering, and metadata. Existing external image URLs continue to work. Only unreferenced managed uploads become eligible for deletion after 30 days under migration 0006; referenced product photos remain protected.

Migration 0005 closes direct public database access and hardens staff authorization. Run the RLS check script against the same intended database and confirm denied anonymous/customer writes before release. Migration 0007 retains audit events for one year. Owner-only audit access requires active membership and AAL2; other roles cannot read the audit page. General audit UPDATE/DELETE remains forbidden. Its bounded service-role-only purge procedure deletes at most 5,000 expired events per invocation and supports dry runs; product revisions stay immutable.

### Isolated browser release gate

Use an ignored `.env.e2e.local` containing isolated `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DELTA_TENANT_ID`, `E2E_ISOLATED_SUPABASE_PROJECT_REF`, `E2E_ALLOW_DESTRUCTIVE=isolated-project-only`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, and `E2E_ADMIN_TOTP_SECRET`. Keep test secrets local. The owner email must use `@e2e.deltagymwear.test`; the password must be at least 12 characters. The global setup verifies database/API keys and tenant before creating or reusing a confirmed test owner, owner membership, and deterministic catalog fixtures. Configure the owner's TOTP in the isolated project; owner setup tests capture no traces. Never substitute production credentials: target guards reject the known production ref, and cleanup only targets test markers. Run the suite through `npm run test:e2e:isolated`, which loads that explicit file. Existing dev servers are never reused. Login, MFA, invite acceptance, product save/edit, rupee prices, category filters, promo redemption, image upload and negative authorization must pass before promotion.

### Daily retention jobs

Configure a random server-only `CRON_SECRET` of at least 16 characters in the intended Vercel environment after migrations 0006 and 0007. `vercel.json` schedules `/api/cron/product-image-retention` at 04:00 UTC and `/api/cron/audit-retention` at 04:15 UTC daily. Both endpoints require `Authorization: Bearer <CRON_SECRET>`. Use `?dryRun=1` to inspect eligibility without deletion; never put the bearer value in URLs or logs. Run authorized dry-run checks after deployment, then verify scheduled jobs in Vercel logs. Keep scheduled deletion disabled if schema, auth, or object reference checks fail. Rollback app code without dropping tables or rewriting immutable audit history.

## 1. Environment variables to set in Vercel

Set these under Project Settings → Environment Variables for the Production
environment (use isolated database credentials for Preview). See
`.env.example` for the authoritative, line-commented list; this table says where
each value comes from.

| Variable | Required | Where it comes from |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase dashboard → Project Settings → API → `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for admin/server mutations | Supabase dashboard → Project Settings → API → `service_role` key. Server-only — mark it "sensitive" in Vercel, never add `NEXT_PUBLIC_` to it. |
| `DELTA_INVITE_EMAIL_READY` | Optional email delivery | Enable only after actual invite email delivery to intended staff recipients is verified. Leave unset for owner-shared invitation links. |
| `DELTA_INVITE_REDIRECT_READY` | Yes for staff invitation links/default template | Set to `true` only after isolated `/auth/invite` acceptance verification and redirect allow-list setup. Server-only. |
| `DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY` | Optional legacy mode | Enable only for a separately verified custom token-hash template. Takes priority over default redirect mode. Keep unset for the default template. Server-only. |
| `CRON_SECRET` | Yes for retention jobs | Random server-only value of at least 16 characters; configure after migrations 0006 and 0007. |
| `DATABASE_URL` | Yes | Supabase dashboard → Project Settings → Database → Connection string (use the pooled/transaction-mode connection string for serverless; append `?sslmode=require` if not already present) |
| `DELTA_TENANT_ID` | Yes | The `id` of the single row in the `tenants` table for this deployment (`select id from tenants;`) |
| `APP_URL` | Yes | The production URL Vercel assigns/you configure, e.g. `https://delta-gym-wear.example` |
| `NEXT_PUBLIC_SITE_URL` | Yes in practice | Same as `APP_URL`. Defaults to `http://localhost:3000` in code (`src/app/layout.tsx`, `src/lib/structured-data.ts`) if unset — that default is wrong in production (breaks `metadataBase`, canonical URLs, and JSON-LD), so always set it explicitly. |
| `LOG_LEVEL` | No | Pick `info` or `warn` for production; defaults to `info` if unset |
| `NEXT_PUBLIC_APP_NAME` | No | Defaults to "Delta Gym Wear" |
| `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM`, `MAIL_API_URL` | No | Only needed to actually send order-confirmation email. Without them the app runs the console mail transport (`src/server/mail/console-mailer.ts`), which logs the email and sends nothing — fine for a soft launch, not fine if customers are expected to receive confirmation email. `MAIL_API_KEY`/`MAIL_FROM` come from your mail provider (e.g. Resend); `MAIL_PROVIDER=http` turns the real transport on. |
| `DELTA_DEV_ADMIN` | **Do not set** | The bypass has been removed. Remove any stale value from every deployment environment — see §4. |

## 2. Supabase dashboard settings that must match

Open **Authentication → URL Configuration** in the Supabase dashboard and set:

- **Site URL**: the same value as `APP_URL`/`NEXT_PUBLIC_SITE_URL` (e.g.
  `https://delta-gym-wear.example`).
- **Redirect URLs**: add `https://delta-gym-wear.example/auth/callback` (and the
  equivalent for any preview domains you want auth to work on, e.g. a wildcard
  `https://*.vercel.app/auth/callback` for preview deployments).

Why this matters: signup confirmation and password-reset emails link to `/auth/callback`
(`src/app/auth/callback/route.ts`), which exchanges the one-time `code` query param for
a session cookie via `supabase.auth.exchangeCodeForSession`. If the Site URL or redirect
allow-list doesn't match where the app is actually deployed, Supabase either rejects the
redirect or sends users back to a domain that isn't live, and both signup confirmation
and password reset silently dead-end.

### Staff invitations

The default Supabase **Authentication / Email Templates / Invite user** template (`{{ .ConfirmationURL }}`) is supported. Allow-list the exact `APP_URL` plus `/auth/invite`. The app supplies that redirect to `inviteUserByEmail`; Supabase verifies the one-time link and returns the session in a browser URL fragment. The dedicated landing immediately removes the fragment and untrusted query string, persists the session with `@supabase/ssr` cookies, and calls a server action. The action verifies Auth `getUser()` and the exact `invited` membership for that user and configured tenant. Only then does it return `/reset-password?next=%2Fadmin`. Choosing a password activates membership with an audit event; MFA remains required for admin access. Browser email, user metadata, role, tenant, and next-path values never authorize access.

Owners with AAL2 can cancel pending invitations in Team. Cancellation saves a permanent `cancelled` status and a `team.invite_cancelled` audit event; the old link cannot authorize password onboarding or reactivate membership. Cancelled invitations cannot be reactivated through status changes; contact support before issuing replacement access for that existing Auth identity.

Owners with AAL2 can create a one-time invitation link in Team and privately deliver it to the intended staff member. `generateLink(type: invite)` creates an unconfirmed Auth identity without sending email. The server refuses existing Auth emails, persists the invited membership and safe audit event, and returns only a project-local `/auth/v1/verify` link with the fixed `/auth/invite` redirect. The link is a credential: copy it once; do not put it in logs, audit metadata or screenshots. If persistence fails no link is returned and no identity is deleted, because Auth/database operations cannot be atomic; an operator must inspect the unbound account before retrying. The unbound identity has no admin access.

Before enabling `DELTA_INVITE_REDIRECT_READY=true`, verify isolated invitation acceptance through the actual Supabase one-time verification link, password setup, membership activation, MFA enrollment, and denial for suspended/unrelated users. Built-in Supabase email delivery has recipient and rate restrictions. Production SMTP is required for unrestricted staff recipient delivery even though the default template does not need editing. Email is optional: leave `DELTA_INVITE_EMAIL_READY` unset until actual delivery is verified for the intended recipients. Owner-shared links work without SMTP.

The optional custom token-hash mode remains supported:

```html
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=invite">Accept the Delta team invitation</a>
```

Set `DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY=true` only after separately verifying that custom template. It takes priority and supplies `.RedirectTo` as `/auth/callback?next=%2Freset-password%3Fnext%3D%252Fadmin`; allow-list `/auth/callback` for this mode. The callback verifies the invite and leaves membership `invited` until successful password setup. Keep both readiness flags unset until a complete mode passes isolated verification.

### Production Auth verification (2026-10-22)

Dashboard checks confirmed 3,600-second access-token expiry, TOTP enabled, and the 15-minute AAL1 session cutoff enabled. Supabase Auth limits are 30 sign-in/sign-up requests per IP per five minutes, 30 token verifications per IP per five minutes, and 150 refreshes per IP per five minutes. The 12-hour inactivity and seven-day maximum-session controls are unavailable on the current Free plan (Pro+). Leaked-password protection and CAPTCHA remain disabled. The production invite template uses the default `{{ .ConfirmationURL }}`; do not enable the legacy token-hash flag for it. Validate the dedicated default redirect and delivery restrictions before enabling its readiness flag.

## 3. Run `scripts/enable-rls-and-realtime.mjs` before going public

```
DB_URL="<the same connection string as DATABASE_URL>" node scripts/enable-rls-and-realtime.mjs
```

**Why this is not optional:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` ships in the browser
bundle by design — anyone can read it out of the page source. That key talks to
Supabase's PostgREST and Realtime APIs directly, independent of this Next.js app's own
server-side authorization. If Row Level Security is disabled (or has no policy) on a
`public` schema table, that same publishable key can query the table straight over
Supabase's REST API — bypassing every check this app's server actions and route
handlers perform. Concretely, without RLS, anyone with the anon key (i.e. anyone who
opens the site) could read every row in `orders`, `order_items`, `addresses`, and
`customers` — full order history, shipping addresses, and phone numbers — directly
from the browser, with no server code involved.

This script:
- enables RLS on all thirteen v2 tables (`tenants`, `memberships`, `products`,
  `product_variants`, `media_references`, `product_revisions`, `audit_events`,
  `customers`, `addresses`, `carts`, `cart_items`, `orders`, `order_items`), which is
  deny-by-default for PostgREST/Realtime the instant it's enabled;
- creates a `delta_private.is_active_tenant_member()` SQL helper and staff-only SELECT policies on
  `orders`, `order_items`, `customers`, `products`, and `product_variants`, scoped to
  signed-in users with an active membership in the tenant;
- sets `REPLICA IDENTITY FULL` and adds `orders`, `order_items`, `products`,
  `product_variants`, and `customers` to the `supabase_realtime` publication, so the
  admin dashboard's live updates work;
- never touches the v1 (PascalCase, Prisma) tables in the same database — they carry
  their own RLS already.

It is idempotent (`DROP POLICY IF EXISTS` / existence checks before each `ALTER
PUBLICATION`), so re-running it is safe. This app's own drizzle connection
(`DATABASE_URL`) authenticates as the table owner and is unaffected by RLS either way —
RLS only changes what the *anon/publishable* key can see through Supabase's own APIs.

Run this once against the production database before the first public deploy, and
again any time a new v2 table is added to the schema.

## 4. Verify the bootstrap owner

The development bypass has been removed. Remove any stale `DELTA_DEV_ADMIN` value
from deployment environments. The initial owner must have an independently verified
email and an active owner membership for this tenant. Confirm unauthenticated and
AAL1 sessions cannot enter admin. Enrollment and recovery follow ADR-003; no
browser request or editable user metadata may bootstrap an owner.

## 5. Post-deploy smoke checklist

Run through this against the production URL after each deploy:

1. `GET /api/health` returns `{"status":"ok"}`.
2. Storefront loads: home page, a collection page, and a product detail page render
   with real catalog data (confirms `DATABASE_URL` and `DELTA_TENANT_ID` are correct).
3. Add an item to the cart, refresh the page, confirm the cart persists (confirms the
   `delta-cart-token` cookie and `carts`/`cart_items` tables are wired correctly).
4. Open checkout and verify real catalog totals, rupee amounts, and optional promo
   input. Run purchase submission and order transitions only in the isolated suite;
   the production smoke check must not create a fulfilment order.
5. Confirm production Auth Site URL is `https://deltagymwear.com` with exact
   `/auth/invite` and `/auth/callback` redirects allow-listed. Keep email readiness
   unset until intended-recipient delivery is separately verified.
6. With a staff account and its authenticator, confirm admin reads, product forms,
   PKR inputs, the separate classifications, and direct image-upload controls. Verify
   owners see Team and Audit, and unauthorized sessions are denied.
7. With `CRON_SECRET`, call each cleanup endpoint with `?dryRun=1`; expect HTTP 200
   and a report indicating dry-run mode. Without authorization expect HTTP 401. Do
   not manually invoke production deletion as a smoke test.
8. Open the deployed site's page source or a private/incognito window and try
   querying `https://<project>.supabase.co/rest/v1/orders` with only the anon key
   (no auth header) — it should return zero rows or a permission error, not order
   data. If it returns rows, RLS is not correctly applied; stop and re-run
   `scripts/enable-rls-and-realtime.mjs`.
9. Confirm `MAIL_PROVIDER` is intentionally set or intentionally unset — check
   whether order-confirmation emails are actually expected to arrive in this
   environment, or whether the console-only transport is acceptable for now.
