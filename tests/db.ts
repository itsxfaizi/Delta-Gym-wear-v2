import { readFileSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";

/**
 * Direct database access for the e2e suite: to assert that something really
 * persisted (not just that a page rendered it), and to remove what the suite
 * created. Nothing in the app imports this.
 *
 * Playwright does not load .env.local the way Next does, so it is parsed here.
 */
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPath = path.join(__dirname, "..", ".env.local");
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((entry) => entry.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not set and was not found in .env.local");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

/** Reads a key from .env.local the way databaseUrl() does. */
export function envValue(key: string): string {
  if (process.env[key]) return process.env[key] as string;

  const envPath = path.join(__dirname, "..", ".env.local");
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((entry) => entry.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} is not set and was not found in .env.local`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
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
  const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
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
  const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const listed = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers });
  const users: { id: string; email?: string }[] = (await listed.json()).users ?? [];
  const ours = users.filter((user) => user.email?.endsWith(`@${E2E_EMAIL_DOMAIN}`));

  for (const user of ours) {
    await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers });
  }
  return ours.length;
}

export function connect() {
  return postgres(databaseUrl(), { max: 1, prepare: false });
}

/** Everything the suite creates is marked so cleanup can find it without guessing. */
export const E2E_EMAIL_DOMAIN = "e2e.deltagymwear.test";
export const E2E_PRODUCT_HANDLE_PREFIX = "e2e-";

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
 * Products have no such guard and are removed outright.
 */
export async function cleanupE2eData(): Promise<{
  ordersCancelled: number;
  ordersLeft: number;
  customers: number;
  productsArchived: number;
}> {
  return withDb(async (sql) => {
    const cancellable = await sql`
      update orders
         set status = 'cancelled', updated_at = now()
       where contact_email like ${"%@" + E2E_EMAIL_DOMAIN}
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
         and status not in ('cancelled')
    `;

    const customers = await sql`
      delete from customers where email like ${"%@" + E2E_EMAIL_DOMAIN} returning id
    `;

    // Products cannot be deleted once saved: product_revisions is immutable in
    // the same way order_items is. They are walked to archived instead, through
    // the transitions products_status_transition allows, which takes them off
    // the storefront just as effectively.
    await sql`
      update products set status = 'unpublished', updated_at = now()
       where handle like ${E2E_PRODUCT_HANDLE_PREFIX + "%"} and status = 'published'
    `;
    const archived = await sql`
      update products set status = 'archived', updated_at = now()
       where handle like ${E2E_PRODUCT_HANDLE_PREFIX + "%"} and status = 'unpublished'
      returning id
    `;

    return {
      ordersCancelled: cancellable.length,
      ordersLeft: stuck.length,
      customers: customers.length,
      productsArchived: archived.length,
    };
  });
}
