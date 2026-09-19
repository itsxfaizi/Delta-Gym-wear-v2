import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/server/db";
import { customers } from "@/server/db/schema";
import { getCatalogTenantId } from "@/server/env";

/**
 * Nothing used to write to `customers`. The table stayed empty, so
 * getCustomerByAuthUserId always returned null, every order was stored with
 * customer_id = NULL, and /account/orders and /account/addresses were empty for
 * every signed-in shopper — permanently, with no error anywhere.
 *
 * A customer record is created at the moment it first means something: when a
 * signed-in shopper places an order.
 */
export type CustomerDetails = {
  email: string;
  fullName?: string | null;
  phone?: string | null;
};

/**
 * Returns the customer id for a signed-in shopper, creating or claiming the
 * record as needed.
 *
 * Three cases, in order:
 *  1. A record already carries this auth user id — use it.
 *  2. A record carries this email but no auth user id. That is the same person:
 *     the email is confirmed by Supabase before a session exists, so claiming it
 *     attaches their earlier checkouts rather than creating a duplicate the
 *     (tenant, email) unique index would reject anyway.
 *  3. Nothing matches — insert a new record.
 *
 * Existing orders are deliberately NOT back-filled here. A guest order carries
 * no proof of who placed it beyond the address, and silently moving old orders
 * into a new account's history is an ownership decision for the store to make,
 * not a side effect of one checkout.
 */
export async function ensureCustomerId(authUserId: string, details: CustomerDetails): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;

  const db = createDatabase();
  const tenantId = getCatalogTenantId();
  const email = details.email.trim().toLowerCase();
  if (!email) return null;

  const [byAuthUser] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.authUserId, authUserId)))
    .limit(1);
  if (byAuthUser) return byAuthUser.id;

  const [claimed] = await db
    .update(customers)
    .set({ authUserId, updatedAt: new Date() })
    .where(
      and(
        eq(customers.tenantId, tenantId),
        eq(customers.email, email),
        isNull(customers.authUserId),
      ),
    )
    .returning({ id: customers.id });
  if (claimed) return claimed.id;

  const [created] = await db
    .insert(customers)
    .values({
      tenantId,
      authUserId,
      email,
      fullName: details.fullName ?? null,
      phone: details.phone ?? null,
    })
    // Two checkouts racing on a first order must not fail the second one.
    .onConflictDoUpdate({
      target: [customers.tenantId, customers.email],
      set: { authUserId, updatedAt: new Date() },
    })
    .returning({ id: customers.id });

  return created?.id ?? null;
}
