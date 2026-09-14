import type { CodStatus } from "@/features/orders/status";

export const CALL_OUTCOMES = [
  "confirmed",
  "no_answer",
  "invalid_number",
  "customer_cancelled",
  "callback_requested",
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export type CallAttempt = {
  id: string;
  outcome: CallOutcome;
  notedAt: Date;
  note?: string;
};

export type InternalNote = {
  id: string;
  body: string;
  authorUserId: string;
  notedAt: Date;
};

/**
 * Everything the COD workflow needs that the `orders` table cannot hold yet.
 * Field-for-field what a future `order_ops` table would store.
 */
export type OrderOps = {
  orderId: string;
  callAttempts: readonly CallAttempt[];
  lastAttemptAt: Date | null;
  nextFollowUpAt: Date | null;
  internalNotes: readonly InternalNote[];
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  dispatchedAt?: Date;
  opsStatus?: CodStatus;
};

/** Implement this against drizzle to retire the in-memory store; callers don't change. */
export type OrderOpsRepository = {
  get(orderId: string): Promise<OrderOps>;
  upsert(orderId: string, patch: (current: OrderOps) => OrderOps): Promise<OrderOps>;
};

export class InvalidOpsTransitionError extends Error {
  public readonly code = "INVALID_OPS_TRANSITION" as const;

  constructor(
    public readonly from: CodStatus,
    public readonly to: CodStatus,
  ) {
    super(`An order cannot move from ${from} to ${to}.`);
    this.name = "InvalidOpsTransitionError";
  }
}
