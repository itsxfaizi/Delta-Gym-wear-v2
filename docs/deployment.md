# Deployment runbook — Vercel + Supabase

This covers deploying the current app (COD storefront + admin console, no payment
gateway) to Vercel against the existing Supabase project. It assumes the Supabase
project and database already exist and the `db/migrations/**` SQL has already been
applied — this runbook does not run migrations or touch the schema.

## 1. Environment variables to set in Vercel

Set these under Project Settings → Environment Variables for the Production
environment (and Preview, if preview deploys should also hit the database). See
`.env.example` for the authoritative, line-commented list; this table says where
each value comes from.

| Variable | Required | Where it comes from |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase dashboard → Project Settings → API → `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for admin/server mutations | Supabase dashboard → Project Settings → API → `service_role` key. Server-only — mark it "sensitive" in Vercel, never add `NEXT_PUBLIC_` to it. |
| `DATABASE_URL` | Yes | Supabase dashboard → Project Settings → Database → Connection string (use the pooled/transaction-mode connection string for serverless; append `?sslmode=require` if not already present) |
| `DELTA_TENANT_ID` | Yes | The `id` of the single row in the `tenants` table for this deployment (`select id from tenants;`) |
| `APP_URL` | Yes | The production URL Vercel assigns/you configure, e.g. `https://delta-gym-wear.example` |
| `NEXT_PUBLIC_SITE_URL` | Yes in practice | Same as `APP_URL`. Defaults to `http://localhost:3000` in code (`src/app/layout.tsx`, `src/lib/structured-data.ts`) if unset — that default is wrong in production (breaks `metadataBase`, canonical URLs, and JSON-LD), so always set it explicitly. |
| `LOG_LEVEL` | No | Pick `info` or `warn` for production; defaults to `info` if unset |
| `NEXT_PUBLIC_APP_NAME` | No | Defaults to "Delta Gym Wear" |
| `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM`, `MAIL_API_URL` | No | Only needed to actually send order-confirmation email. Without them the app runs the console mail transport (`src/server/mail/console-mailer.ts`), which logs the email and sends nothing — fine for a soft launch, not fine if customers are expected to receive confirmation email. `MAIL_API_KEY`/`MAIL_FROM` come from your mail provider (e.g. Resend); `MAIL_PROVIDER=http` turns the real transport on. |
| `DELTA_DEV_ADMIN` | **Do not set** | Development-only admin bypass (`src/server/admin/guard.ts`). It is hard-gated on `NODE_ENV !== "production"` in code, so it cannot activate in a production build regardless of this value, but do not set it in any Vercel environment — see §4. |

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
- creates a `is_active_tenant_member()` SQL helper and staff-only SELECT policies on
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

## 4. Remove the `DELTA_DEV_ADMIN` bypass once real owners exist

`src/server/admin/guard.ts` grants a fake `owner` session (`userId: "dev-admin"`) when
`DELTA_DEV_ADMIN=1` and `NODE_ENV !== "production"`. It cannot fire in a production
`next build`/`next start` regardless of the env var, because of the `NODE_ENV` check —
but:

- Never set `DELTA_DEV_ADMIN` in any Vercel environment (Production or Preview). A
  misconfigured `NODE_ENV` anywhere in the deploy pipeline is the only thing standing
  between this flag and a wide-open admin console.
- Once a real row exists in `memberships` with `role = 'owner'` and `status = 'active'`
  for a real Supabase-authenticated user, delete the `DELTA_DEV_ADMIN` branch from
  `resolveAdminAccess()` entirely rather than just leaving it unset — dead code that
  grants admin access is a standing risk even when gated.

## 5. Post-deploy smoke checklist

Run through this against the production URL after each deploy:

1. `GET /api/health` returns `{"status":"ok"}`.
2. Storefront loads: home page, a collection page, and a product detail page render
   with real catalog data (confirms `DATABASE_URL` and `DELTA_TENANT_ID` are correct).
3. Add an item to the cart, refresh the page, confirm the cart persists (confirms the
   `delta-cart-token` cookie and `carts`/`cart_items` tables are wired correctly).
4. Complete a guest COD checkout end-to-end and confirm the order appears in
   `/admin/orders` with `payment_method = cod`, `payment_status = unpaid`.
5. Sign up a test account, confirm the verification email link lands on
   `/auth/callback` and logs the account in (validates the Supabase Site
   URL/redirect config from §2). Repeat for "forgot password".
6. Log in to `/admin` as a real user with an `owner`/admin membership (not
   `DELTA_DEV_ADMIN`) and confirm the dashboard KPIs and charts render.
7. Change an order's status in `/admin/orders` (e.g. `pending → confirmed`) and
   confirm it reflects immediately — this exercises the Realtime subscription set up
   by `scripts/enable-rls-and-realtime.mjs`.
8. Open the deployed site's page source or a private/incognito window and try
   querying `https://<project>.supabase.co/rest/v1/orders` with only the anon key
   (no auth header) — it should return zero rows or a permission error, not order
   data. If it returns rows, RLS is not correctly applied; stop and re-run
   `scripts/enable-rls-and-realtime.mjs`.
9. Confirm `MAIL_PROVIDER` is intentionally set or intentionally unset — check
   whether order-confirmation emails are actually expected to arrive in this
   environment, or whether the console-only transport is acceptable for now.
