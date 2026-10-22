import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { requireOrdersDatabase } from "@/server/orders/queries";
import { promoCodes } from "@/server/db/schema";

export async function listPromotions() {
  const { db, tenantId } = requireOrdersDatabase();
  return db.select().from(promoCodes)
    .where(eq(promoCodes.tenantId, tenantId)).orderBy(asc(promoCodes.code));
}

export async function getPromotionByCode(code: string) {
  const { db, tenantId } = requireOrdersDatabase();
  const [promo] = await db.select().from(promoCodes)
    .where(and(eq(promoCodes.tenantId, tenantId), eq(promoCodes.code, code))).limit(1);
  return promo ?? null;
}
