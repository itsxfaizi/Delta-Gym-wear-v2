import {
  COD_STATUSES,
  ORDER_STATUS_META,
  canTransition,
  describeStatus,
  isCodStatus,
  isTerminal,
  nextStatuses,
  type CodStatus,
} from "@/features/orders/status";

export type BulkOrder = {
  id: string;
  orderNumber: string;
  status: string;
};

export type SkippedOrder = BulkOrder & { reason: string };

export type BulkPlan = {
  target: CodStatus;
  eligible: BulkOrder[];
  skipped: SkippedOrder[];
  /** One honest sentence for the confirmation step. */
  summary: string;
};

/**
 * Moves that are hard to walk back (money collected, parcel gone, order killed)
 * and therefore need an explicit confirmation before they are applied in bulk.
 */
export const CONSEQUENTIAL_TARGETS: readonly CodStatus[] = [
  "shipped",
  "delivered",
  "refused",
  "returned_to_sender",
  "cancelled",
];

export function isConsequential(target: CodStatus): boolean {
  return CONSEQUENTIAL_TARGETS.includes(target);
}

/** Every status at least one selected order can legally move to. */
export function availableTargets(orders: readonly BulkOrder[]): CodStatus[] {
  const targets = new Set<CodStatus>();
  for (const order of orders) {
    if (!isCodStatus(order.status)) continue;
    for (const next of nextStatuses(order.status)) targets.add(next);
  }
  return COD_STATUSES.filter((status) => targets.has(status));
}

function skipReason(order: BulkOrder, target: CodStatus): string | null {
  if (!isCodStatus(order.status)) return `Unknown status "${order.status}".`;
  if (order.status === target) return `Already ${ORDER_STATUS_META[target].label.toLowerCase()}.`;
  if (isTerminal(order.status)) return `${describeStatus(order.status).label} is final; it cannot move.`;
  if (!canTransition(order.status, target)) {
    return `${describeStatus(order.status).label} cannot move straight to ${ORDER_STATUS_META[target].label.toLowerCase()}.`;
  }
  return null;
}

/** Pure eligibility: nothing illegal is ever included, nothing is silently dropped. */
export function planBulkStatusChange(orders: readonly BulkOrder[], target: CodStatus): BulkPlan {
  const eligible: BulkOrder[] = [];
  const skipped: SkippedOrder[] = [];

  for (const order of orders) {
    const reason = skipReason(order, target);
    if (reason) skipped.push({ ...order, reason });
    else eligible.push(order);
  }

  const label = ORDER_STATUS_META[target].label.toLowerCase();
  const summary =
    orders.length === 0
      ? "No orders selected."
      : skipped.length === 0
        ? `All ${orders.length} selected ${orders.length === 1 ? "order" : "orders"} can move to ${label}.`
        : `${eligible.length} of ${orders.length} can move to ${label}; ${skipped.length} will be skipped.`;

  return { target, eligible, skipped, summary };
}

/** Groups skip reasons so the UI lists each cause once with a count. */
export function groupSkipReasons(skipped: readonly SkippedOrder[]): { reason: string; orderNumbers: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const order of skipped) {
    const bucket = groups.get(order.reason);
    if (bucket) bucket.push(order.orderNumber);
    else groups.set(order.reason, [order.orderNumber]);
  }
  return [...groups].map(([reason, orderNumbers]) => ({ reason, orderNumbers }));
}
