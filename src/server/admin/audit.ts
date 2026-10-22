import "server-only";

import { desc, eq } from "drizzle-orm";

import { createDatabase } from "@/server/db";
import { auditEvents } from "@/server/db/schema";
import { getCatalogTenantId } from "@/server/env";
import { requireAdminPrincipal } from "./guard";

export const AUDIT_EVENT_LIMIT = 100;

/** Deliberately omits before/after JSON: audit metadata can contain operational details. */
export type AdminAuditEvent = {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  requestId: string | null;
  correlationId: string | null;
  outcome: string;
  createdAt: Date;
};

/** Owner-only, tenant-scoped, newest-first audit feed. The authorization gate
 *  also enforces AAL2; it runs before database access. */
export async function listOwnerAuditEvents(): Promise<AdminAuditEvent[]> {
  await requireAdminPrincipal(["owner"]);
  if (!process.env.DATABASE_URL) return [];

  const tenantId = getCatalogTenantId();
  return createDatabase()
    .select({
      id: auditEvents.id,
      actorUserId: auditEvents.actorUserId,
      action: auditEvents.action,
      targetType: auditEvents.targetType,
      targetId: auditEvents.targetId,
      requestId: auditEvents.requestId,
      correlationId: auditEvents.correlationId,
      outcome: auditEvents.outcome,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .where(eq(auditEvents.tenantId, tenantId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(AUDIT_EVENT_LIMIT);
}
