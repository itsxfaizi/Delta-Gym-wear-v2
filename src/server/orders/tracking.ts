import "server-only";

import { orderTrackingSchema, phonesMatch } from "@/features/orders/tracking";
import { getOrderOps } from "@/server/ops/order-ops";

import { getOrderByNumber } from "./queries";

/** Courier fields a customer may see. Internal notes and call attempts never appear here. */
export type CourierView = {
  courier: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

export type TrackedOrderItem = {
  id: string;
  title: string;
  variantLabel: string | null;
  quantity: number;
  lineTotalAmount: number;
};

/** Deliberately narrow: built field by field so an ops or order field can never leak by spreading. */
export type TrackedOrder = {
  orderNumber: string;
  placedAt: Date;
  status: string;
  items: TrackedOrderItem[];
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  deliverTo: { fullName: string; city: string; province: string; country: string };
  courier: CourierView | null;
};

/**
 * Courier + tracking for a storefront view. Returns null until dispatch details
 * exist, and never exposes notes, call attempts or the ops status reason.
 */
export async function getCourierView(orderId: string): Promise<CourierView | null> {
  const ops = await getOrderOps(orderId);
  if (!ops.courier) return null;
  return {
    courier: ops.courier,
    trackingNumber: ops.trackingNumber ?? null,
    trackingUrl: ops.trackingUrl ?? null,
  };
}

/** The customer-facing status: the ops adapter wins because it holds the COD-only states. */
export async function getCustomerStatus(orderId: string, fallback: string): Promise<string> {
  const ops = await getOrderOps(orderId);
  return ops.opsStatus ?? fallback;
}

/**
 * Guest lookup. Matches on order number AND phone, and collapses every failure
 * — bad input, unknown number, wrong phone, no database — into null so the
 * caller can only ever render one generic message.
 */
export async function lookupOrderForTracking(rawInput: unknown): Promise<TrackedOrder | null> {
  const parsed = orderTrackingSchema.safeParse(rawInput);
  if (!parsed.success) return null;

  let order;
  try {
    order = await getOrderByNumber(parsed.data.orderNumber);
  } catch {
    // No DATABASE_URL configured: a clean not-found beats a 500.
    return null;
  }
  if (!order) return null;

  const matches =
    phonesMatch(parsed.data.phone, order.contactPhone) ||
    phonesMatch(parsed.data.phone, order.shippingAddress.phone);
  if (!matches) return null;

  const ops = await getOrderOps(order.id);

  return {
    orderNumber: order.orderNumber,
    placedAt: order.placedAt,
    status: ops.opsStatus ?? order.status,
    items: order.items.map((item) => ({
      id: item.id,
      title: item.productTitle,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      lineTotalAmount: item.lineTotalAmount,
    })),
    subtotalAmount: order.subtotalAmount,
    shippingAmount: order.shippingAmount,
    totalAmount: order.totalAmount,
    currency: order.currency,
    deliverTo: {
      fullName: order.shippingAddress.fullName,
      city: order.shippingAddress.city,
      province: order.shippingAddress.province,
      country: order.shippingAddress.country,
    },
    courier: ops.courier
      ? { courier: ops.courier, trackingNumber: ops.trackingNumber ?? null, trackingUrl: ops.trackingUrl ?? null }
      : null,
  };
}
