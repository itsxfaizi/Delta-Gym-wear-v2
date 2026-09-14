import {
  ORDER_STATUSES,
  ORDER_STATUS_FLOW,
  canTransitionOrderStatus,
  type OrderStatus,
} from "./types";

// Re-exported so callers only ever need this module; the DB-backed pieces stay
// in types.ts because the drizzle schema imports nothing from here.
export { ORDER_STATUSES, ORDER_STATUS_FLOW, canTransitionOrderStatus };
export type { OrderStatus };

/**
 * The full cash-on-delivery lifecycle. Three of these cannot be stored in the
 * `order_status` pg enum yet (see ORDER_STATUS_META.persistable) and live in
 * the ops adapter instead.
 */
export const COD_STATUSES = [
  "pending",
  "confirmation_required",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "refused",
  "returned_to_sender",
  "cancelled",
] as const;

export type CodStatus = (typeof COD_STATUSES)[number];

export type BadgeTone = "neutral" | "info" | "warn" | "danger" | "success";

export type StatusMeta = {
  label: string;
  description: string;
  tone: BadgeTone;
  /** False when the DB `order_status` enum cannot store it. */
  persistable: boolean;
};

/** Explicit legal transitions. Terminal statuses map to an empty list. */
export const COD_STATUS_FLOW = {
  pending: ["confirmation_required", "confirmed", "cancelled"],
  confirmation_required: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  // The point of the whole COD flow: a shipped parcel has three real endings.
  shipped: ["delivered", "refused", "returned_to_sender"],
  delivered: [],
  refused: [],
  returned_to_sender: [],
  cancelled: [],
} as const satisfies Record<CodStatus, readonly CodStatus[]>;

export const ORDER_STATUS_META = {
  pending: {
    label: "Pending",
    description: "Placed, not yet called.",
    tone: "neutral",
    persistable: true,
  },
  confirmation_required: {
    label: "Confirmation required",
    description: "Call attempted, customer has not confirmed.",
    tone: "warn",
    persistable: false,
  },
  confirmed: {
    label: "Confirmed",
    description: "Customer confirmed the order on the phone.",
    tone: "info",
    persistable: true,
  },
  packed: {
    label: "Packed",
    description: "Picked and packed, waiting for the courier.",
    tone: "info",
    persistable: true,
  },
  shipped: {
    label: "Shipped",
    description: "Handed to the courier and in transit.",
    tone: "info",
    persistable: true,
  },
  delivered: {
    label: "Delivered",
    description: "Delivered and cash collected.",
    tone: "success",
    persistable: true,
  },
  refused: {
    label: "Refused",
    description: "Customer refused the parcel at the door.",
    tone: "danger",
    persistable: false,
  },
  returned_to_sender: {
    label: "Returned to sender",
    description: "Undeliverable; the courier sent it back.",
    tone: "danger",
    persistable: false,
  },
  cancelled: {
    label: "Cancelled",
    description: "Cancelled before dispatch.",
    tone: "neutral",
    persistable: true,
  },
} as const satisfies Record<CodStatus, StatusMeta>;

const UNKNOWN_STATUS_META: StatusMeta = {
  label: "Unknown",
  description: "This status is not part of the current lifecycle.",
  tone: "neutral",
  persistable: false,
};

export function isCodStatus(value: string): value is CodStatus {
  return Object.hasOwn(COD_STATUS_FLOW, value);
}

export function canTransition(from: CodStatus, to: CodStatus): boolean {
  return (COD_STATUS_FLOW[from] as readonly CodStatus[]).includes(to);
}

export function nextStatuses(from: CodStatus): readonly CodStatus[] {
  return COD_STATUS_FLOW[from];
}

export function isTerminal(status: CodStatus): boolean {
  return COD_STATUS_FLOW[status].length === 0;
}

/**
 * Never throws. Legacy and future rows still render with a neutral badge, so a
 * status the UI has never heard of can't take an order page down.
 */
export function describeStatus(value: string): StatusMeta & { status: string; known: boolean } {
  return isCodStatus(value)
    ? { ...ORDER_STATUS_META[value], status: value, known: true }
    : { ...UNKNOWN_STATUS_META, label: value || UNKNOWN_STATUS_META.label, status: value, known: false };
}

/** The status actually written to the DB column for a COD status. */
export function persistableStatus(status: CodStatus): OrderStatus {
  if (ORDER_STATUS_META[status].persistable) return status as OrderStatus;
  return status === "confirmation_required" ? "pending" : "shipped";
}
