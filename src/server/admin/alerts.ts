import "server-only";

import { and, count, desc, eq } from "drizzle-orm";

import type { OrderAlertSnapshot } from "@/features/admin/order-alerts";
import { requireAdminPrincipal } from "@/server/admin/guard";
import { ADMIN_ROLES } from "@/features/admin/schemas";
import { createDatabase } from "@/server/db";
import { orders } from "@/server/db/schema";
import { getCatalogTenantId } from "@/server/env";

const EMPTY: OrderAlertSnapshot = { latestPlacedAt: null, pendingConfirmation: 0, total: 0 };

/**
 * Deliberately tiny: two aggregates, no rows. The operator's browser calls this
 * every 30s, so it must stay cheap enough to run all day.
 */
export async function readOrderAlertSnapshot(): Promise<OrderAlertSnapshot> {
  await requireAdminPrincipal(ADMIN_ROLES);
  if (!process.env.DATABASE_URL) return EMPTY;

  const tenantId = getCatalogTenantId();
  const db = createDatabase();

  const [[latest], [totals], [pending]] = await Promise.all([
    db
      .select({ placedAt: orders.placedAt })
      .from(orders)
      .where(eq(orders.tenantId, tenantId))
      .orderBy(desc(orders.placedAt))
      .limit(1),
    db.select({ value: count() }).from(orders).where(eq(orders.tenantId, tenantId)),
    db
      .select({ value: count() })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.status, "pending"))),
  ]);

  return {
    latestPlacedAt: latest?.placedAt ? latest.placedAt.toISOString() : null,
    total: totals?.value ?? 0,
    pendingConfirmation: pending?.value ?? 0,
  };
}
