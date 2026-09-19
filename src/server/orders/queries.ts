import "server-only";

import { and, desc, eq, gte, ilike, or, sql } from "drizzle-orm";

import { ORDER_STATUSES, type Order, type OrderItem, type OrderStatus, type PaymentStatus } from "@/features/orders/types";
import { createDatabase, type Database } from "@/server/db";
import { getCatalogTenantId } from "@/server/env";
import { orderItems, orders, type OrderItemRow, type OrderRow } from "@/server/db/schema";

export class OrdersDatabaseUnavailableError extends Error {
  public readonly code = "ORDERS_DATABASE_UNAVAILABLE" as const;

  constructor() {
    super("DATABASE_URL is not configured, so orders cannot be read or written.");
    this.name = "OrdersDatabaseUnavailableError";
  }
}

/** Every orders path is DB-backed: fail loudly and typed instead of crashing inside postgres. */
export function requireOrdersDatabase(): { db: Database; tenantId: string } {
  if (!process.env.DATABASE_URL) throw new OrdersDatabaseUnavailableError();
  return { db: createDatabase(), tenantId: getCatalogTenantId() };
}

export type OrderListFilters = {
  status?: OrderStatus;
  search?: string;
  paymentStatus?: PaymentStatus;
  /** Keep only orders placed within the last N days. */
  placedWithinDays?: number;
  limit?: number;
  offset?: number;
};

/** One predicate for the list and its per-status counts, so both filter alike. */
function ordersWhere(tenantId: string, filters: OrderListFilters) {
  const search = filters.search?.trim();
  return and(
    eq(orders.tenantId, tenantId),
    filters.status ? eq(orders.status, filters.status) : undefined,
    filters.paymentStatus ? eq(orders.paymentStatus, filters.paymentStatus) : undefined,
    filters.placedWithinDays
      ? gte(orders.placedAt, new Date(Date.now() - filters.placedWithinDays * 86_400_000))
      : undefined,
    search
      ? or(
          ilike(orders.orderNumber, `%${search}%`),
          ilike(orders.contactEmail, `%${search}%`),
          ilike(orders.contactPhone, `%${search}%`),
        )
      : undefined,
  );
}

export type OrderSummary = Omit<Order, "items">;

function toOrderSummary(row: OrderRow): OrderSummary {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    tenantId: row.tenantId,
    customerId: row.customerId,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    shippingAddress: row.shippingAddress,
    status: row.status,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    subtotalAmount: row.subtotalAmount,
    shippingAmount: row.shippingAmount,
    totalAmount: row.totalAmount,
    currency: row.currency,
    notes: row.notes,
    placedAt: row.placedAt,
  };
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    // The variant may have been deleted since; the snapshot keeps the order readable.
    productVariantId: row.productVariantId ?? "",
    productTitle: row.productTitle,
    variantLabel: row.variantLabel,
    sku: row.sku,
    unitPriceAmount: row.unitPriceAmount,
    quantity: row.quantity,
    lineTotalAmount: row.lineTotalAmount,
  };
}

async function loadOrder(where: ReturnType<typeof eq>): Promise<Order | null> {
  const { db, tenantId } = requireOrdersDatabase();
  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), where))
    .limit(1);
  if (!row) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, row.id)));

  return { ...toOrderSummary(row), items: items.map(toOrderItem) };
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  return loadOrder(eq(orders.id, orderId));
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  return loadOrder(eq(orders.orderNumber, orderNumber.trim().toUpperCase()));
}

/** Admin list: newest first, filtered by status and a free-text order-number/contact search. */
export async function listOrders(filters: OrderListFilters = {}): Promise<{
  orders: OrderSummary[];
  total: number;
}> {
  const { db, tenantId } = requireOrdersDatabase();
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  const where = ordersWhere(tenantId, filters);

  const [rows, [counted]] = await Promise.all([
    db.select().from(orders).where(where).orderBy(desc(orders.placedAt)).limit(limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(orders).where(where),
  ]);

  return { orders: rows.map(toOrderSummary), total: counted?.total ?? 0 };
}

/**
 * Totals per stored status for the list tabs, under the same filters minus the
 * status itself. Counting the whole match set, not the page on screen.
 * ponytail: counts the DB column, like the ?status= filter — the COD overlay
 * statuses (refused, returned, confirmation required) are not separable yet.
 */
export async function countOrdersPerStatus(
  filters: OrderListFilters = {},
): Promise<Record<OrderStatus, number>> {
  const { db, tenantId } = requireOrdersDatabase();
  const rows = await db
    .select({ status: orders.status, total: sql<number>`count(*)::int` })
    .from(orders)
    .where(ordersWhere(tenantId, { ...filters, status: undefined }))
    .groupBy(orders.status);

  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const row of rows) counts[row.status] = row.total;
  return counts;
}

export async function listCustomerOrders(customerId: string): Promise<OrderSummary[]> {
  const { db, tenantId } = requireOrdersDatabase();
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), eq(orders.customerId, customerId)))
    .orderBy(desc(orders.placedAt));

  return rows.map(toOrderSummary);
}
