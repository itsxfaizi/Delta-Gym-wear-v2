import "server-only";

import { eq } from "drizzle-orm";

import { createDatabase } from "@/server/db";
import { orderOps } from "@/server/db/schema";
import { getCatalogTenantId } from "@/server/env";

import type { CallAttempt, InternalNote, OrderOps, OrderOpsRepository } from "./types";
import type { CodStatus } from "@/features/orders/status";
import type { StoredCallAttempt, StoredInternalNote } from "@/server/db/schema";

/**
 * Cash-on-delivery working state, in the `order_ops` table.
 *
 * This used to be a module-level Map, which meant every call attempt, tracking
 * number and COD status was lost on restart and invisible to any other server
 * instance. Nothing in the app noticed, because the ops status is an overlay
 * read back through resolveCodStatus — it simply reverted to the database
 * status silently.
 */

function blank(orderId: string): OrderOps {
  return {
    orderId,
    callAttempts: [],
    lastAttemptAt: null,
    nextFollowUpAt: null,
    internalNotes: [],
  };
}

/** JSONB gives back ISO strings; the domain type wants Dates. */
function reviveAttempt(stored: StoredCallAttempt): CallAttempt {
  return {
    id: stored.id,
    outcome: stored.outcome as CallAttempt["outcome"],
    notedAt: new Date(stored.notedAt),
    ...(stored.note ? { note: stored.note } : {}),
  };
}

function reviveNote(stored: StoredInternalNote): InternalNote {
  return {
    id: stored.id,
    body: stored.body,
    authorUserId: stored.authorUserId,
    notedAt: new Date(stored.notedAt),
  };
}

function storeAttempt(attempt: CallAttempt): StoredCallAttempt {
  return {
    id: attempt.id,
    outcome: attempt.outcome,
    notedAt: attempt.notedAt.toISOString(),
    ...(attempt.note ? { note: attempt.note } : {}),
  };
}

function storeNote(note: InternalNote): StoredInternalNote {
  return {
    id: note.id,
    body: note.body,
    authorUserId: note.authorUserId,
    notedAt: note.notedAt.toISOString(),
  };
}

function toDomain(row: typeof orderOps.$inferSelect): OrderOps {
  return {
    orderId: row.orderId,
    callAttempts: (row.callAttempts ?? []).map(reviveAttempt),
    lastAttemptAt: row.lastAttemptAt,
    nextFollowUpAt: row.nextFollowUpAt,
    internalNotes: (row.internalNotes ?? []).map(reviveNote),
    ...(row.courier ? { courier: row.courier } : {}),
    ...(row.trackingNumber ? { trackingNumber: row.trackingNumber } : {}),
    ...(row.trackingUrl ? { trackingUrl: row.trackingUrl } : {}),
    ...(row.dispatchedAt ? { dispatchedAt: row.dispatchedAt } : {}),
    ...(row.opsStatus ? { opsStatus: row.opsStatus as CodStatus } : {}),
  };
}

export const databaseOrderOpsRepository: OrderOpsRepository = {
  async get(orderId) {
    const [row] = await createDatabase().select().from(orderOps).where(eq(orderOps.orderId, orderId)).limit(1);
    return row ? toDomain(row) : blank(orderId);
  },

  async upsert(orderId, patch) {
    // Read-modify-write, so the row is locked for the duration: two operators
    // logging a call on the same order must not drop one another's attempt.
    return createDatabase().transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(orderOps)
        .where(eq(orderOps.orderId, orderId))
        .limit(1)
        .for("update");

      const next = patch(existing ? toDomain(existing) : blank(orderId));
      const values = {
        orderId,
        tenantId: getCatalogTenantId(),
        callAttempts: next.callAttempts.map(storeAttempt),
        lastAttemptAt: next.lastAttemptAt,
        nextFollowUpAt: next.nextFollowUpAt,
        internalNotes: next.internalNotes.map(storeNote),
        courier: next.courier ?? null,
        trackingNumber: next.trackingNumber ?? null,
        trackingUrl: next.trackingUrl ?? null,
        dispatchedAt: next.dispatchedAt ?? null,
        opsStatus: next.opsStatus ?? null,
        updatedAt: new Date(),
      };

      await tx
        .insert(orderOps)
        .values(values)
        .onConflictDoUpdate({ target: orderOps.orderId, set: values });

      return next;
    });
  },
};
