import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import type { Order, OrderItem } from "@/features/orders/types";
import { createDatabase } from "@/server/db";
import { addresses, customers, orderItems, orders, type Address, type Customer } from "@/server/db/schema";
import { getCatalogTenantId } from "@/server/env";

/** Mirrors the catalog reads: without a database the account surfaces stay empty rather than crash. */
function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function getCustomerByAuthUserId(authUserId: string): Promise<Customer | null> {
  if (!hasDatabase()) return null;

  const db = createDatabase();
  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, getCatalogTenantId()), eq(customers.authUserId, authUserId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function listCustomerAddresses(customerId: string): Promise<readonly Address[]> {
  if (!hasDatabase()) return [];

  const db = createDatabase();
  return db
    .select()
    .from(addresses)
    .where(and(eq(addresses.tenantId, getCatalogTenantId()), eq(addresses.customerId, customerId)))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
}

/**
 * ponytail: local order-history read until the orders domain ships its own
 * `listCustomerOrders`; swap the import when that lands and delete this.
 */
export async function listCustomerOrders(customerId: string): Promise<readonly Order[]> {
  if (!hasDatabase()) return [];

  const db = createDatabase();
  const tenantId = getCatalogTenantId();
  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), eq(orders.customerId, customerId)))
    .orderBy(desc(orders.placedAt));

  if (orderRows.length === 0) return [];

  const itemRows = await db
    .select()
    .from(orderItems)
    .where(
      and(
        eq(orderItems.tenantId, tenantId),
        inArray(
          orderItems.orderId,
          orderRows.map((order) => order.id),
        ),
      ),
    );

  return orderRows.map((order) => ({
    ...order,
    items: itemRows
      .filter((item) => item.orderId === order.id)
      .map(
        (item): OrderItem => ({
          id: item.id,
          orderId: item.orderId,
          productVariantId: item.productVariantId ?? "",
          productTitle: item.productTitle,
          variantLabel: item.variantLabel,
          sku: item.sku,
          unitPriceAmount: item.unitPriceAmount,
          quantity: item.quantity,
          lineTotalAmount: item.lineTotalAmount,
        }),
      ),
  }));
}
