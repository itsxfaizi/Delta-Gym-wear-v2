import { createHash } from "node:crypto";
import postgres from "postgres";

/**
 * Direct database access for the e2e suite: to assert that something really
 * persisted (not just that a page rendered it), and to remove what the suite
 * created. Nothing in the app imports this. E2E credentials must be provided
 * explicitly; reading .env.local could silently target production.
 */
const KNOWN_PRODUCTION_PROJECT_REFS = new Set(["imyqylzsqsupanehdnhu"]);
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SafeE2eTarget = {
  projectRef: string;
  supabaseUrl: string;
  databaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  tenantId: string;
  ownerEmail: string;
};

function requiredEnv(key: string, env: NodeJS.ProcessEnv): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`E2E safety gate: ${key} must be set explicitly in the test process.`);
  return value;
}

/**
 * A synchronous, network-free guard for Playwright config loading. It runs
 * before webServer can start. The same values are injected into that server,
 * and a second read-only connectivity check runs before any test action.
 */
export function assertSafeE2eTarget(env: NodeJS.ProcessEnv = process.env): SafeE2eTarget {
  if (env.E2E_ALLOW_DESTRUCTIVE !== "isolated-project-only") {
    throw new Error("E2E safety gate: set E2E_ALLOW_DESTRUCTIVE=isolated-project-only for an isolated project.");
  }

  const projectRef = requiredEnv("E2E_ISOLATED_SUPABASE_PROJECT_REF", env);
  if (!PROJECT_REF_PATTERN.test(projectRef) || KNOWN_PRODUCTION_PROJECT_REFS.has(projectRef)) {
    throw new Error("E2E safety gate: the declared project ref is invalid or is a known production project.");
  }

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL", env);
  let api: URL;
  try { api = new URL(supabaseUrl); }
  catch { throw new Error("E2E safety gate: NEXT_PUBLIC_SUPABASE_URL is invalid."); }
  if (api.protocol !== "https:" || api.hostname !== `${projectRef}.supabase.co` ||
      api.port || api.username || api.password || api.pathname !== "/" || api.search || api.hash) {
    throw new Error("E2E safety gate: the Supabase API URL does not match the declared isolated project.");
  }

  const databaseUrl = requiredEnv("DATABASE_URL", env);
  let database: URL;
  try { database = new URL(databaseUrl); }
  catch { throw new Error("E2E safety gate: DATABASE_URL is invalid."); }
  const direct = database.hostname === `db.${projectRef}.supabase.co` && database.username === "postgres";
  const pooled = /^.+\.pooler\.supabase\.com$/.test(database.hostname) &&
    database.username === `postgres.${projectRef}`;
  if (!(["postgres:", "postgresql:"].includes(database.protocol) && (direct || pooled))) {
    throw new Error("E2E safety gate: DATABASE_URL does not identify the same isolated Supabase project.");
  }

  const tenantId = requiredEnv("DELTA_TENANT_ID", env);
  if (!UUID_PATTERN.test(tenantId)) throw new Error("E2E safety gate: DELTA_TENANT_ID must be a UUID.");
  const ownerEmail = requiredEnv("E2E_ADMIN_EMAIL", env).toLowerCase();
  if (!/^[^@\s]+@e2e\.deltagymwear\.test$/.test(ownerEmail)) {
    throw new Error("E2E safety gate: E2E_ADMIN_EMAIL must use the @e2e.deltagymwear.test test-only domain.");
  }
  return {
    projectRef,
    supabaseUrl: api.origin,
    databaseUrl,
    anonKey: requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", env),
    serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY", env),
    tenantId,
    ownerEmail,
  };
}

/** Existing specs use this accessor; it never reads a different env file. */
export function envValue(key: string): string {
  assertSafeE2eTarget();
  return requiredEnv(key, process.env);
}

/**
 * Creates a confirmed auth user directly, bypassing the signup form.
 *
 * Signup sends a confirmation email, and the project's mail quota is small
 * enough that a test suite exhausts it (Supabase answers
 * over_email_send_rate_limit). The account experience is what these specs are
 * for, so the account is provisioned here and the real login form is used.
 */
export async function createConfirmedUser(email: string, password: string): Promise<string> {
  const { supabaseUrl: url, serviceRoleKey: key } = assertSafeE2eTarget();
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!response.ok) throw new Error(`could not create ${email}: ${await response.text()}`);
  return (await response.json()).id as string;
}

/** Removes the auth users the suite created; they are not immutable records. */
export async function deleteE2eUsers(): Promise<number> {
  const { supabaseUrl: url, serviceRoleKey: key } = assertSafeE2eTarget();
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const listed = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers });
  const users: { id: string; email?: string }[] = (await listed.json()).users ?? [];
  const ownerEmail = e2eOwnerEmail();
  const ours = users.filter((user) => user.email?.toLowerCase().endsWith(`@${E2E_EMAIL_DOMAIN}`) && user.email.toLowerCase() !== ownerEmail);

  for (const user of ours) {
    await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers });
  }
  return ours.length;
}

export function connect() {
  return postgres(assertSafeE2eTarget().databaseUrl, { max: 1, prepare: false });
}

/** Everything the suite creates is marked so cleanup can find it without guessing. */
export const E2E_EMAIL_DOMAIN = "e2e.deltagymwear.test";
export const E2E_PRODUCT_HANDLE_PREFIX = "e2e-";

/** Stable per tenant so fixtures are repeatable without cross-tenant UUID collisions. */
export function e2eFixtureUuid(tenantId: string, label: string): string {
  const bytes = createHash("sha256").update(`${tenantId}:${label}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Return the explicitly configured test owner; teardown must retain this account. */
export function e2eOwnerEmail(): string {
  return assertSafeE2eTarget().ownerEmail;
}

/**
 * One connection per test process, not one per assertion. Opening a fresh
 * pooled connection for every check made Supabase's pooler trip its circuit
 * breaker ("too many authentication failures") partway through a run.
 */
let shared: ReturnType<typeof connect> | null = null;

export async function withDb<T>(run: (sql: ReturnType<typeof connect>) => Promise<T>): Promise<T> {
  shared ??= connect();
  return run(shared);
}

export async function closeDb(): Promise<void> {
  if (!shared) return;
  await shared.end({ timeout: 5 });
  shared = null;
}

/**
 * Clears the suite's footprint.
 *
 * Orders are NOT deleted. `order_items` carries an immutability trigger from
 * migration 0001 — an order line can never be updated or deleted — and that
 * guard is worth more than tidy test data. Instead the suite's orders are
 * cancelled, which the status trigger permits from pending, confirmed and
 * packed, and which every admin figure already excludes. The rows remain, the
 * dashboard stays truthful.
 *
 * Products keep immutable revision history, so test products are archived after
 * their media references are detached and Storage retention starts.
 */
export async function cleanupE2eData(): Promise<{
  ordersCancelled: number;
  ordersLeft: number;
  customers: number;
    memberships: number;
  productsArchived: number;
}> {
  return withDb(async (sql) => {
    const cancellable = await sql`
      update orders
         set status = 'cancelled', updated_at = now()
       where contact_email like ${"%@" + E2E_EMAIL_DOMAIN}
         and tenant_id = ${assertSafeE2eTarget().tenantId}
         and status in ('pending', 'confirmed', 'packed')
      returning id
    `;

    // Cancelling does not put the stock back, so the suite would quietly eat the
    // catalogue's inventory — and it did: buying the first available size on
    // every run took one variant to zero, which changed the default colour on
    // the product page and broke specs that had nothing to do with these.
    // Only the orders cancelled just above are restocked, so a second run
    // cannot credit the same line twice.
    if (cancellable.length) {
      const ids = cancellable.map((row) => row.id as string);
      await sql`
        update product_variants v
           set stock_quantity = v.stock_quantity + used.quantity, updated_at = now()
          from (
            select product_variant_id, sum(quantity)::int as quantity
              from order_items
             where order_id in ${sql(ids)} and product_variant_id is not null
             group by product_variant_id
          ) as used
         where v.id = used.product_variant_id
      `;
    }

    // Anything already shipped or delivered cannot legally move to cancelled.
    const stuck = await sql`
      select id from orders
       where contact_email like ${"%@" + E2E_EMAIL_DOMAIN}
         and tenant_id = ${assertSafeE2eTarget().tenantId}
         and status not in ('cancelled')
    `;

    // Orders retain their customer relation. Composite ON DELETE SET NULL
    // would also null the non-null tenant ID; detach Auth instead of deleting.
    const customers = await sql`
      update customers set auth_user_id = null, updated_at = now()
       where tenant_id = ${assertSafeE2eTarget().tenantId}
         and email like ${"%@" + E2E_EMAIL_DOMAIN} and auth_user_id is not null
      returning id
    `;

    const membershipsRemoved = await sql`
      delete from memberships m using auth.users u
       where m.auth_user_id = u.id and u.email like ${"%@" + E2E_EMAIL_DOMAIN}
         and m.tenant_id = ${assertSafeE2eTarget().tenantId}
         and lower(u.email) <> ${e2eOwnerEmail()}
      returning m.auth_user_id
    `;

    // Products cannot be deleted once saved: product_revisions is immutable in
    // the same way order_items is. They are walked to archived instead, through
    // the transitions products_status_transition allows, which takes them off
    // the storefront just as effectively.
    await sql`
      with removed_refs as (
        delete from media_references m using products p
         where m.tenant_id = p.tenant_id and m.product_id = p.id
           and p.tenant_id = ${assertSafeE2eTarget().tenantId}
           and p.handle like ${E2E_PRODUCT_HANDLE_PREFIX + "%"}
        returning m.tenant_id, m.object_key
      )
      update product_image_objects objects
         set unreferenced_at = coalesce(objects.unreferenced_at, now())
        from removed_refs removed
       where objects.tenant_id = removed.tenant_id and objects.public_url = removed.object_key
         and objects.deleted_at is null
         and not exists (
           select 1 from media_references refs
            where refs.tenant_id = objects.tenant_id and refs.object_key = objects.public_url
         )
    `;
    await sql`
      update products set status = 'unpublished', updated_at = now()
       where tenant_id = ${assertSafeE2eTarget().tenantId}
         and handle like ${E2E_PRODUCT_HANDLE_PREFIX + "%"} and status = 'published'
    `;
    const archived = await sql`
      update products set status = 'archived', updated_at = now()
       where tenant_id = ${assertSafeE2eTarget().tenantId}
         and handle like ${E2E_PRODUCT_HANDLE_PREFIX + "%"} and status = 'unpublished'
      returning id
    `;

    return {
      ordersCancelled: cancellable.length,
      ordersLeft: stuck.length,
      customers: customers.length,
      memberships: membershipsRemoved.length,
      productsArchived: archived.length,
    };
  });
}
