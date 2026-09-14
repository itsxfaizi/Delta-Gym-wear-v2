import { describeStatus } from "@/features/orders/status";

/** The order fields a customer metric is derived from; a superset of OrderSummary. */
export type CustomerOrderInput = {
  id: string;
  orderNumber: string;
  customerId: string | null;
  contactEmail: string;
  contactPhone: string;
  shippingAddress: { fullName: string; city: string; province: string; line1: string; line2: string | null };
  status: string;
  totalAmount: number;
  currency: string;
  placedAt: Date;
};

export type RiskLevel = "unknown" | "ok" | "watch" | "high";

export type RiskSignal = {
  level: RiskLevel;
  /** failed / settled, 0 when there is nothing settled yet. */
  ratio: number;
  /** Settled orders the ratio was computed from. */
  sample: number;
  reason: string;
};

export type CustomerRecord = {
  /** Stable url-safe identity: a real customer id, or the normalised phone for guests. */
  key: string;
  isGuest: boolean;
  name: string;
  email: string;
  phone: string;
  city: string;
  orderCount: number;
  totalOrderedAmount: number;
  deliveredCount: number;
  deliveredAmount: number;
  refusedCount: number;
  returnedCount: number;
  cancelledCount: number;
  /** refused + returned_to_sender + cancelled. */
  failedCount: number;
  currency: string;
  lastOrderAt: Date | null;
  risk: RiskSignal;
  orders: CustomerOrderInput[];
};

/** Below this many settled orders the ratio says nothing, so no signal is shown. */
export const RISK_MIN_SAMPLE = 3;
export const RISK_WATCH_RATIO = 0.25;
export const RISK_HIGH_RATIO = 0.5;

export const RISK_RULE_TEXT =
  `Inferred from this customer's own order history: failed cash-on-delivery outcomes ` +
  `(refused, returned to sender, cancelled) as a share of settled orders, once at least ` +
  `${RISK_MIN_SAMPLE} orders have settled. ${Math.round(RISK_HIGH_RATIO * 100)}% or more is "high", ` +
  `${Math.round(RISK_WATCH_RATIO * 100)}% or more is "watch". It is a delivery-history signal, not a fraud finding.`;

/** Digits only, without the PK country code or trunk zero, so 03001234567 == +923001234567. */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("92")) return digits.slice(2);
  if (digits.startsWith("0")) return digits.replace(/^0+/, "");
  return digits;
}

/** Guest orders (customerId null) group under their contact phone. */
export function customerKeyFor(order: CustomerOrderInput): string {
  if (order.customerId) return `c_${order.customerId}`;
  const phone = normalisePhone(order.contactPhone);
  return `g_${phone || order.contactEmail.toLowerCase() || order.id}`;
}

export function riskSignal(counts: { deliveredCount: number; failedCount: number }): RiskSignal {
  const sample = counts.deliveredCount + counts.failedCount;
  if (sample < RISK_MIN_SAMPLE) {
    return {
      level: "unknown",
      ratio: 0,
      sample,
      reason: `Only ${sample} settled ${sample === 1 ? "order" : "orders"} so far — too little history to read.`,
    };
  }
  const ratio = counts.failedCount / sample;
  const percent = Math.round(ratio * 100);
  const reason = `${counts.failedCount} of ${sample} settled orders failed on delivery (${percent}%).`;
  if (ratio >= RISK_HIGH_RATIO) return { level: "high", ratio, sample, reason };
  if (ratio >= RISK_WATCH_RATIO) return { level: "watch", ratio, sample, reason };
  return { level: "ok", ratio, sample, reason };
}

/** Groups orders into customers and derives every metric shown in the UI. */
export function deriveCustomers(orders: readonly CustomerOrderInput[]): CustomerRecord[] {
  const byKey = new Map<string, CustomerOrderInput[]>();
  for (const order of orders) {
    const key = customerKeyFor(order);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(order);
    else byKey.set(key, [order]);
  }

  const records = [...byKey].map(([key, group]) => {
    const sorted = [...group].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());
    const latest = sorted[0];
    const counts = { delivered: 0, refused: 0, returned: 0, cancelled: 0 };
    let deliveredAmount = 0;
    for (const order of sorted) {
      switch (order.status) {
        case "delivered":
          counts.delivered += 1;
          deliveredAmount += order.totalAmount;
          break;
        case "refused":
          counts.refused += 1;
          break;
        case "returned_to_sender":
          counts.returned += 1;
          break;
        case "cancelled":
          counts.cancelled += 1;
          break;
        default:
          break;
      }
    }
    const failedCount = counts.refused + counts.returned + counts.cancelled;

    return {
      key,
      isGuest: !latest.customerId,
      name: latest.shippingAddress.fullName,
      email: latest.contactEmail,
      phone: latest.contactPhone,
      city: latest.shippingAddress.city,
      orderCount: sorted.length,
      totalOrderedAmount: sorted.reduce((total, order) => total + order.totalAmount, 0),
      deliveredCount: counts.delivered,
      deliveredAmount,
      refusedCount: counts.refused,
      returnedCount: counts.returned,
      cancelledCount: counts.cancelled,
      failedCount,
      currency: latest.currency,
      lastOrderAt: latest.placedAt,
      risk: riskSignal({ deliveredCount: counts.delivered, failedCount }),
      orders: sorted,
    } satisfies CustomerRecord;
  });

  return records.sort((a, b) => (b.lastOrderAt?.getTime() ?? 0) - (a.lastOrderAt?.getTime() ?? 0));
}

/** Name, email, phone (digits-insensitive) or any of the customer's order numbers. */
export function matchesCustomerSearch(record: CustomerRecord, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, "");
  if (digits.length >= 4 && normalisePhone(record.phone).includes(normalisePhone(digits))) return true;
  return (
    record.name.toLowerCase().includes(needle) ||
    record.email.toLowerCase().includes(needle) ||
    record.phone.toLowerCase().includes(needle) ||
    record.orders.some((order) => order.orderNumber.toLowerCase().includes(needle))
  );
}

export function searchCustomers(records: readonly CustomerRecord[], query: string): CustomerRecord[] {
  return records.filter((record) => matchesCustomerSearch(record, query));
}

/** Shared with the detail page so the status wording never diverges. */
export function statusLabel(status: string): string {
  return describeStatus(status).label;
}
