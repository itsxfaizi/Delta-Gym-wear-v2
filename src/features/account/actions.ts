"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { createDatabase, type Database } from "@/server/db";
import { addresses, customers } from "@/server/db/schema";
import { getCatalogTenantId } from "@/server/env";

import { addressSchema, type ActionResult } from "./schemas";

const NO_DATABASE = "The address book is unavailable right now. Try again later.";

/**
 * Resolves the tenant customer for the signed-in identity, creating it on first
 * use so an account that pre-dates the customers table can still save addresses.
 */
async function requireCustomerId(db: Database, tenantId: string): Promise<string> {
  const user = await requireAuthenticatedUser();

  const existing = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.authUserId, user.id)))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const inserted = await db
    .insert(customers)
    .values({
      tenantId,
      authUserId: user.id,
      email: user.email ?? `${user.id}@unknown.invalid`,
      fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
    })
    .onConflictDoUpdate({
      target: [customers.tenantId, customers.email],
      set: { authUserId: user.id, updatedAt: new Date() },
    })
    .returning({ id: customers.id });

  return inserted[0].id;
}

/** A customer has at most one default address; promoting one demotes the rest. */
async function demoteOtherDefaults(db: Database, tenantId: string, customerId: string, keepId: string) {
  await db
    .update(addresses)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(
      and(
        eq(addresses.tenantId, tenantId),
        eq(addresses.customerId, customerId),
        ne(addresses.id, keepId),
      ),
    );
}

export async function saveAddress(rawInput: unknown): Promise<ActionResult> {
  const parsed = addressSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields and try again." };
  if (!process.env.DATABASE_URL) return { ok: false, message: NO_DATABASE };

  const { id, ...values } = parsed.data;
  const db = createDatabase();
  const tenantId = getCatalogTenantId();

  try {
    const customerId = await requireCustomerId(db, tenantId);

    const saved = id
      ? await db
          .update(addresses)
          .set({ ...values, updatedAt: new Date() })
          .where(
            and(
              eq(addresses.id, id),
              eq(addresses.tenantId, tenantId),
              eq(addresses.customerId, customerId),
            ),
          )
          .returning({ id: addresses.id })
      : await db
          .insert(addresses)
          .values({ ...values, tenantId, customerId })
          .returning({ id: addresses.id });

    if (!saved[0]) return { ok: false, message: "That address could not be found." };
    if (values.isDefault) await demoteOtherDefaults(db, tenantId, customerId, saved[0].id);
  } catch {
    return { ok: false, message: "The address could not be saved." };
  }

  revalidatePath("/account/addresses");
  return { ok: true };
}

export async function deleteAddress(addressId: string): Promise<ActionResult> {
  if (!process.env.DATABASE_URL) return { ok: false, message: NO_DATABASE };

  const db = createDatabase();
  const tenantId = getCatalogTenantId();

  try {
    const customerId = await requireCustomerId(db, tenantId);
    const deleted = await db
      .delete(addresses)
      .where(
        and(
          eq(addresses.id, addressId),
          eq(addresses.tenantId, tenantId),
          eq(addresses.customerId, customerId),
        ),
      )
      .returning({ id: addresses.id });

    if (!deleted[0]) return { ok: false, message: "That address could not be found." };
  } catch {
    return { ok: false, message: "The address could not be removed." };
  }

  revalidatePath("/account/addresses");
  return { ok: true };
}

export async function setDefaultAddress(addressId: string): Promise<ActionResult> {
  if (!process.env.DATABASE_URL) return { ok: false, message: NO_DATABASE };

  const db = createDatabase();
  const tenantId = getCatalogTenantId();

  try {
    const customerId = await requireCustomerId(db, tenantId);
    const promoted = await db
      .update(addresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(addresses.id, addressId),
          eq(addresses.tenantId, tenantId),
          eq(addresses.customerId, customerId),
        ),
      )
      .returning({ id: addresses.id });

    if (!promoted[0]) return { ok: false, message: "That address could not be found." };
    await demoteOtherDefaults(db, tenantId, customerId, addressId);
  } catch {
    return { ok: false, message: "The default address could not be changed." };
  }

  revalidatePath("/account/addresses");
  return { ok: true };
}
