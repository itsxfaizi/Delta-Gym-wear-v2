"use server";

import { randomBytes } from "node:crypto";

import { headers } from "next/headers";

import { restoreCartLines } from "@/features/catalog/cart";
import { listPublishedProducts } from "@/features/catalog/queries";
import type { Result } from "@/features/result";
import { createDatabase } from "@/server/db";
import { orderItems, orders } from "@/server/db/schema";
import { getCatalogTenantId, getCodShippingFeeAmount } from "@/server/env";
import { log } from "@/server/observability/logger";
import { getRequestId } from "@/server/observability/request-id";
import { parseCheckoutFormData } from "./schema";
import { storeDevelopmentOrder } from "./queries";
import type { CheckoutState, CheckoutSuccess, OrderLineSnapshot } from "./types";

/** Every message a buyer can see. None names a column, a variable or a failure. */
const MESSAGES = {
  unavailable: "Cash on Delivery is unavailable right now. Please try again later.",
  validation: "Check the highlighted fields and try again.",
  cartChanged: "One or more cart items are no longer available. Review your cart and try again.",
  mixedCurrency: "Your cart cannot be checked out as one order. Review your cart and try again.",
  rateLimited: "Too many checkout attempts from this connection. Wait a minute and try again.",
  server: "We could not place your order just now. No order was created — please try again.",
} as const;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_KEYS = 5_000;
const recentAttempts = new Map<string, number[]>();

function clientKey(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip")?.trim() || "unknown";
}

/**
 * A sliding window per client address, checked before any parsing or database
 * work. This endpoint is an unauthenticated POST that writes rows and COD has no
 * payment step, so an unbudgeted request is free to an attacker.
 *
 * ponytail: the counter is an in-process Map, so the budget is per instance, not
 * global — a second instance doubles the ceiling and a restart clears it. Upgrade
 * path when the deployment is multi-instance: keep this call site and move the
 * window to a shared store (a Postgres row or Redis) keyed the same way.
 */
async function exceedsOrderRate(): Promise<boolean> {
  let requestHeaders: Headers;
  try {
    requestHeaders = await headers();
  } catch {
    return false; // No request scope (prerender, unit test): nothing to budget.
  }

  const key = clientKey(requestHeaders);
  const now = Date.now();
  // Bounds the Map so a spray of unique addresses cannot grow it without limit.
  if (recentAttempts.size > RATE_LIMIT_MAX_KEYS) recentAttempts.clear();

  const recent = (recentAttempts.get(key) ?? []).filter((at) => now - at < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  recentAttempts.set(key, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function generateOrderToken() {
  return randomBytes(32).toString("hex");
}

function generateOrderReference() {
  return `DGW-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Guest COD checkout (decision D-007). Returns contract B's `Result`; it never
 * throws across the boundary, so a database failure renders as an error on the
 * checkout page instead of unwinding to the store error boundary, where the copy
 * ("We couldn't load the collection") tells the buyer nothing about the order.
 */
export async function placeCodOrder(
  _previousState: CheckoutState,
  formData: FormData,
): Promise<Result<CheckoutSuccess>> {
  if (await exceedsOrderRate()) {
    return { ok: false, code: "CONFLICT", message: MESSAGES.rateLimited };
  }

  const orderToken = generateOrderToken();
  const orderReference = generateOrderReference();

  try {
    const shippingAmount = getCodShippingFeeAmount();
    if (shippingAmount === null) {
      return { ok: false, code: "SERVER", message: MESSAGES.unavailable };
    }

    const parsed = parseCheckoutFormData(formData);
    if (!parsed.success) {
      return {
        ok: false,
        code: "VALIDATION",
        message: MESSAGES.validation,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    // `parseCheckoutFormData` has already coalesced duplicate lines.
    const catalog = await listPublishedProducts();
    const lines = restoreCartLines(parsed.data.cartLines, catalog);
    if (lines.length !== parsed.data.cartLines.length) {
      return { ok: false, code: "CONFLICT", message: MESSAGES.cartChanged };
    }

    const currency = lines[0]?.variant.currency;
    if (!currency || lines.some((line) => line.variant.currency !== currency)) {
      return { ok: false, code: "CONFLICT", message: MESSAGES.mixedCurrency };
    }

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
        return { ok: false, code: "SERVER", message: MESSAGES.unavailable };
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
      return { ok: true, data: { orderToken } };
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

      if (!order) throw new Error("Order insert returned no row.");
      await tx.insert(orderItems).values(orderLines.map((line) => ({ orderId: order.id, ...line })));
    });

    return { ok: true, data: { orderToken } };
  } catch (error) {
    // The exception never crosses the boundary. It is logged server-side, where a
    // SQL fragment is diagnostics rather than disclosure.
    log("error", "checkout.cod_order.failed", {
      requestId: await getRequestId(),
      orderReference,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, code: "SERVER", message: MESSAGES.server };
  }
}
