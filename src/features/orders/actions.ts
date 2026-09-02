"use server";

import { randomBytes } from "node:crypto";

import { restoreCartLines } from "@/features/catalog/cart";
import { listPublishedProducts } from "@/features/catalog/queries";
import { createDatabase } from "@/server/db";
import { orderItems, orders } from "@/server/db/schema";
import { getCatalogTenantId, getCodShippingFeeAmount } from "@/server/env";
import { parseCheckoutFormData } from "./schema";
import { storeDevelopmentOrder } from "./queries";
import type { CheckoutActionState, OrderLineSnapshot } from "./types";

function generateOrderToken() {
  return randomBytes(32).toString("hex");
}

function generateOrderReference() {
  return `DGW-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function failure(message: string, fieldErrors: CheckoutActionState["fieldErrors"] = {}): CheckoutActionState {
  return { ok: false, message, fieldErrors };
}

export async function placeCodOrder(
  _previousState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const shippingAmount = getCodShippingFeeAmount();
  if (shippingAmount === null) {
    return failure("COD checkout needs an approved shipping fee before orders can be placed.");
  }

  const parsed = parseCheckoutFormData(formData);
  if (!parsed.success) {
    return failure("Check the highlighted fields and try again.", parsed.error.flatten().fieldErrors);
  }

  const catalog = await listPublishedProducts();
  const lines = restoreCartLines(parsed.data.cartLines, catalog);
  if (lines.length !== parsed.data.cartLines.length) {
    return failure("One or more cart items are no longer available. Review your cart and try again.", { cartLines: ["Review your cart."] });
  }

  const currency = lines[0]?.variant.currency;
  if (!currency || lines.some((line) => line.variant.currency !== currency)) {
    return failure("Cart items must use one currency.");
  }

  const orderToken = generateOrderToken();
  const orderReference = generateOrderReference();
  const subtotalAmount = lines.reduce((sum, line) => sum + line.variant.priceAmount * line.quantity, 0);
  const totalAmount = subtotalAmount + shippingAmount;
  const orderLines: OrderLineSnapshot[] = lines.map((line) => ({
    productHandle: line.product.handle,
    productTitle: line.product.title,
    variantId: line.variant.id,
    sku: line.variant.sku,
    color: line.variant.color,
    size: line.variant.size,
    unitPriceAmount: line.variant.priceAmount,
    quantity: line.quantity,
    lineTotalAmount: line.variant.priceAmount * line.quantity,
    currency,
  }));

  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production") {
      return failure("COD orders require database configuration in production.");
    }
    storeDevelopmentOrder({
      orderToken,
      orderReference,
      status: "pending_confirmation",
      paymentStatus: "cod_pending_collection",
      paymentMethod: "cod",
      customerFullName: parsed.data.fullName,
      customerPhone: parsed.data.phone,
      customerEmail: parsed.data.email ?? null,
      addressLine1: parsed.data.addressLine1,
      addressLine2: parsed.data.addressLine2 ?? null,
      city: parsed.data.city,
      province: parsed.data.province ?? null,
      postalCode: parsed.data.postalCode ?? null,
      country: "PK",
      subtotalAmount,
      shippingAmount,
      totalAmount,
      currency,
      createdAt: new Date(),
      lines: orderLines,
    });
    return { ok: true, message: "Order received.", fieldErrors: {}, orderToken };
  }

  const db = createDatabase();
  const tenantId = getCatalogTenantId();
  await db.transaction(async (tx) => {
    const [order] = await tx.insert(orders).values({
      tenantId,
      orderToken,
      orderReference,
      customerFullName: parsed.data.fullName,
      customerPhone: parsed.data.phone,
      customerEmail: parsed.data.email ?? null,
      addressLine1: parsed.data.addressLine1,
      addressLine2: parsed.data.addressLine2 ?? null,
      city: parsed.data.city,
      province: parsed.data.province ?? null,
      postalCode: parsed.data.postalCode ?? null,
      country: "PK",
      subtotalAmount,
      shippingAmount,
      totalAmount,
      currency,
    }).returning({ id: orders.id });

    if (!order) throw new Error("Order insert failed.");
    await tx.insert(orderItems).values(orderLines.map((line) => ({ orderId: order.id, ...line })));
  });

  return { ok: true, message: "Order received.", fieldErrors: {}, orderToken };
}
