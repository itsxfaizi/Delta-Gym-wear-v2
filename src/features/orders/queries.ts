import "server-only";

import { eq } from "drizzle-orm";

import { createDatabase } from "@/server/db";
import { orderItems, orders } from "@/server/db/schema";
import type { OrderLineSnapshot, PublicOrder } from "./types";

const developmentOrders = new Map<string, PublicOrder>();

export function storeDevelopmentOrder(order: PublicOrder): void {
  if (process.env.DATABASE_URL) return;
  if (process.env.NODE_ENV === "production") throw new Error("Database-backed orders are required in production.");
  developmentOrders.set(order.orderToken, order);
}

export async function getPublicOrder(orderToken: string): Promise<PublicOrder | null> {
  if (!/^[a-f0-9]{64}$/.test(orderToken)) return null;

  if (!process.env.DATABASE_URL) {
    return developmentOrders.get(orderToken) ?? null;
  }

  const db = createDatabase();
  const [order] = await db.select().from(orders).where(eq(orders.orderToken, orderToken)).limit(1);
  if (!order) return null;

  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return {
    orderToken: order.orderToken,
    orderReference: order.orderReference,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: "cod",
    customerFullName: order.customerFullName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    addressLine1: order.addressLine1,
    addressLine2: order.addressLine2,
    city: order.city,
    province: order.province,
    postalCode: order.postalCode,
    country: "PK",
    subtotalAmount: order.subtotalAmount,
    shippingAmount: order.shippingAmount,
    totalAmount: order.totalAmount,
    currency: order.currency,
    createdAt: order.createdAt,
    lines: lines.map((line): OrderLineSnapshot => ({
      productHandle: line.productHandle,
      productTitle: line.productTitle,
      variantId: line.variantId,
      sku: line.sku,
      color: line.color,
      size: line.size,
      unitPriceAmount: line.unitPriceAmount,
      quantity: line.quantity,
      lineTotalAmount: line.lineTotalAmount,
      currency: line.currency,
    })),
  };
}
