import { KARACHI_OFFSET_MS, startOfKarachiDay } from "@/lib/datetime";

import { COD_STATUSES, type CodStatus } from "@/features/orders/status";
import { ORDER_STATUSES, type OrderStatus } from "@/features/orders/types";
import type { StockPolicy } from "@/features/catalog/types";

export const LOW_STOCK_THRESHOLD = 5;

/** Every dashboard number covers this trailing window, compared against the window before it. */
export const DASHBOARD_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

/** COD outcomes that consumed a delivery attempt without producing revenue. */
export const FAILED_DELIVERY_STATUSES = ["refused", "returned_to_sender"] as const;

export type OrderStatusCounts = Record<OrderStatus, number>;
export type CodStatusCounts = Record<CodStatus, number>;

/** The order shape the dashboard derives from: effective COD status, money, and when it landed. */
export type DashboardOrder = {
  status: CodStatus;
  totalAmount: number;
  placedAt: Date;
};

export type DayBucket = {
  /** UTC calendar day, `YYYY-MM-DD`, so the series is stable regardless of server timezone. */
  date: string;
  label: string;
  revenue: number;
  orders: number;
  delivered: number;
  failed: number;
};

export type TopProduct = {
  productId: string | null;
  productTitle: string;
  quantity: number;
  revenue: number;
};

export function countOrdersByStatus(orders: readonly { status: OrderStatus }[]): OrderStatusCounts {
  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as OrderStatusCounts;
  for (const order of orders) counts[order.status] += 1;
  return counts;
}

export function countCodStatuses(orders: readonly { status: CodStatus }[]): CodStatusCounts {
  const counts = Object.fromEntries(COD_STATUSES.map((status) => [status, 0])) as CodStatusCounts;
  for (const order of orders) counts[order.status] += 1;
  return counts;
}

/**
 * Cancelled orders never became revenue, so they are excluded from the total.
 * Refused and returned parcels are excluded for the same reason: COD collects on delivery.
 */
export function sumOrderRevenue(orders: readonly { status: string; totalAmount: number }[]): number {
  return orders.reduce((total, order) => (isRevenue(order.status) ? total + order.totalAmount : total), 0);
}

/** One definition of revenue: shared with top-products so the same screen agrees with itself. */
export function isRevenue(status: string): boolean {
  return status !== "cancelled" && !(FAILED_DELIVERY_STATUSES as readonly string[]).includes(status);
}

/** Mean value of the orders that can still collect cash. Rounded to whole minor units. */
export function averageOrderValue(orders: readonly { status: string; totalAmount: number }[]): number {
  const billable = orders.filter((order) => isRevenue(order.status));
  if (billable.length === 0) return 0;
  return Math.round(sumOrderRevenue(billable) / billable.length);
}

export type DeliveryOutcomes = {
  delivered: number;
  failed: number;
  settled: number;
  /** Fractions in 0..1, or null when nothing has been attempted yet — never fake a rate. */
  deliveryRate: number | null;
  refusalRate: number | null;
};

export function deliveryOutcomes(orders: readonly { status: CodStatus }[]): DeliveryOutcomes {
  let delivered = 0;
  let failed = 0;
  for (const order of orders) {
    if (order.status === "delivered") delivered += 1;
    else if ((FAILED_DELIVERY_STATUSES as readonly string[]).includes(order.status)) failed += 1;
  }
  const settled = delivered + failed;
  return {
    delivered,
    failed,
    settled,
    deliveryRate: settled === 0 ? null : delivered / settled,
    refusalRate: settled === 0 ? null : failed / settled,
  };
}

/** Orders still waiting on a confirmation call before anything can be packed. */
export function countAwaitingConfirmation(orders: readonly { status: CodStatus }[]): number {
  return orders.filter((order) => order.status === "pending" || order.status === "confirmation_required").length;
}

/** Relative change, or null when there is no prior period to compare against. */
export function percentChange(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return (current - prior) / prior;
}


/** Splits a trailing window into the current period and the equally long one before it. */
export function splitByPeriod<T extends { placedAt: Date }>(
  orders: readonly T[],
  days: number = DASHBOARD_WINDOW_DAYS,
  now: Date = new Date(),
): { current: T[]; prior: T[] } {
  const currentStart = startOfKarachiDay(now.getTime()) - (days - 1) * DAY_MS;
  const priorStart = currentStart - days * DAY_MS;
  const current: T[] = [];
  const prior: T[] = [];
  for (const order of orders) {
    const at = order.placedAt.getTime();
    if (at >= currentStart) current.push(order);
    else if (at >= priorStart) prior.push(order);
  }
  return { current, prior };
}

/** Stable per-day key. Built from the Karachi day start so it matches the buckets. */
function bucketKey(dayStart: number): string {
  return new Date(dayStart + KARACHI_OFFSET_MS).toISOString().slice(0, 10);
}

const DAY_LABEL = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", timeZone: "Asia/Karachi" });

/** One bucket per day of the window, zero-filled, oldest first — charts need the gaps. */
export function bucketOrdersByDay(
  orders: readonly DashboardOrder[],
  days: number = DASHBOARD_WINDOW_DAYS,
  now: Date = new Date(),
): DayBucket[] {
  const firstDay = startOfKarachiDay(now.getTime()) - (days - 1) * DAY_MS;
  const buckets = new Map<string, DayBucket>();
  for (let index = 0; index < days; index += 1) {
    const day = new Date(firstDay + index * DAY_MS);
    const date = bucketKey(firstDay + index * DAY_MS);
    buckets.set(date, { date, label: DAY_LABEL.format(day), revenue: 0, orders: 0, delivered: 0, failed: 0 });
  }

  for (const order of orders) {
    const bucket = buckets.get(bucketKey(startOfKarachiDay(order.placedAt.getTime())));
    if (!bucket) continue;
    bucket.orders += 1;
    if (isRevenue(order.status)) bucket.revenue += order.totalAmount;
    if (order.status === "delivered") bucket.delivered += 1;
    if ((FAILED_DELIVERY_STATUSES as readonly string[]).includes(order.status)) bucket.failed += 1;
  }

  return [...buckets.values()];
}

/** Groups sold line items by product title, best sellers by units first. */
export function topSellingProducts(
  items: readonly { productId: string | null; productTitle: string; quantity: number; lineTotalAmount: number }[],
  limit = 5,
): TopProduct[] {
  const totals = new Map<string, TopProduct>();
  for (const item of items) {
    const existing = totals.get(item.productTitle);
    if (existing) {
      existing.quantity += item.quantity;
      existing.revenue += item.lineTotalAmount;
      existing.productId ??= item.productId;
    } else {
      totals.set(item.productTitle, {
        productId: item.productId,
        productTitle: item.productTitle,
        quantity: item.quantity,
        revenue: item.lineTotalAmount,
      });
    }
  }
  return [...totals.values()]
    .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
    .slice(0, limit);
}

/** A 'continue' variant backorders, so it is never low on stock. */
export function isLowStock(
  variant: { stockQuantity: number; stockPolicy: StockPolicy },
  threshold: number = LOW_STOCK_THRESHOLD,
): boolean {
  return variant.stockPolicy !== "continue" && variant.stockQuantity <= threshold;
}
