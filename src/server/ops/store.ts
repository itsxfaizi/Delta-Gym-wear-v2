import "server-only";

import type { OrderOps, OrderOpsRepository } from "./types";

/**
 * TEMPORARY. The ONLY stateful thing in this feature.
 *
 * The drizzle schema has no home for call attempts, courier/tracking or ops
 * status, and the schema is out of scope, so this module-level Map stands in
 * for the `order_ops` table. Consequences, accepted deliberately:
 *   - it is per-process, so nothing is shared between server instances;
 *   - it is in memory, so every dev-server restart or deploy wipes it.
 * Replace with a drizzle-backed OrderOpsRepository; no caller changes.
 *
 * ponytail: module Map, swap for an `order_ops` table when ops data must survive.
 */
const store = new Map<string, OrderOps>();

function blank(orderId: string): OrderOps {
  return {
    orderId,
    callAttempts: [],
    lastAttemptAt: null,
    nextFollowUpAt: null,
    internalNotes: [],
  };
}

export const memoryOrderOpsRepository: OrderOpsRepository = {
  async get(orderId) {
    return store.get(orderId) ?? blank(orderId);
  },
  async upsert(orderId, patch) {
    const next = patch(store.get(orderId) ?? blank(orderId));
    store.set(orderId, next);
    return next;
  },
};

/** Test-only escape hatch; production code must never call this. */
export function __resetOrderOpsStore(): void {
  store.clear();
}
