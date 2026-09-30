import "server-only";

import {
  SAFEPAY_HOSTS,
  buildSafepayCheckoutUrl,
  parseSafepayTracker,
  settlementProblem,
  type SafepayTracker,
} from "@/features/payments/safepay";
import type { Order } from "@/features/orders/types";
import { getSafepayConfig, type SafepayConfig } from "@/server/env";
import { markOrderPaid } from "@/server/orders/mutations";
import { getOrderByNumber } from "@/server/orders/queries";

export class SafepayUnavailableError extends Error {
  public readonly code = "SAFEPAY_UNAVAILABLE" as const;

  constructor(message = "Safepay is not configured.") {
    super(message);
    this.name = "SafepayUnavailableError";
  }
}

export function requireSafepayConfig(): SafepayConfig {
  const config = getSafepayConfig();
  if (!config) throw new SafepayUnavailableError();
  return config;
}

async function safepayRequest(config: SafepayConfig, path: string, init: { method: "GET" | "POST"; body?: unknown }) {
  const response = await fetch(`${SAFEPAY_HOSTS[config.environment].api}${path}`, {
    method: init.method,
    headers: { "Content-Type": "application/json", "X-SFPY-MERCHANT-SECRET": config.secretKey },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  // Never log the response body wholesale: it can carry customer contact details.
  if (!response.ok) throw new SafepayUnavailableError(`Safepay ${init.method} ${path} returned ${response.status}.`);
  return (await response.json()) as unknown;
}

/** Opens a Safepay payment session for an unpaid order and returns the hosted checkout URL. */
export async function startSafepayCheckout(order: Pick<Order, "orderNumber" | "totalAmount" | "currency">): Promise<string> {
  const config = requireSafepayConfig();

  const session = (await safepayRequest(config, "/order/payments/v3/", {
    method: "POST",
    body: {
      merchant_api_key: config.apiKey,
      intent: "CYBERSOURCE",
      mode: "payment",
      entry_mode: "raw",
      currency: order.currency,
      amount: order.totalAmount,
      metadata: { order_id: order.orderNumber },
      include_fees: false,
    },
  })) as { data?: { tracker?: { token?: string } } };
  const tracker = session.data?.tracker?.token;
  if (!tracker) throw new SafepayUnavailableError("Safepay did not return a tracker.");

  const passport = (await safepayRequest(config, "/client/passport/v1/token", { method: "POST", body: {} })) as {
    data?: string;
  };
  if (!passport.data) throw new SafepayUnavailableError("Safepay did not return a checkout token.");

  const orderPath = `/orders/${encodeURIComponent(order.orderNumber)}`;
  return buildSafepayCheckoutUrl({
    environment: config.environment,
    tracker,
    tbt: passport.data,
    orderNumber: order.orderNumber,
    redirectUrl: new URL(`/api/payments/safepay/return?order=${encodeURIComponent(order.orderNumber)}`, config.appUrl).toString(),
    cancelUrl: new URL(`${orderPath}?payment=cancelled`, config.appUrl).toString(),
  });
}

async function fetchSafepayTracker(config: SafepayConfig, tracker: string): Promise<SafepayTracker> {
  return parseSafepayTracker(
    await safepayRequest(config, `/reporter/api/v1/payments/${encodeURIComponent(tracker)}`, { method: "GET" }),
  );
}

/**
 * The only path that marks a Safepay order paid. Nothing the browser or the
 * webhook sends is trusted: the tracker is re-fetched from Safepay with our
 * secret key and must have ended, for this order, for the exact total.
 * Returns the order number it resolved to (paid or not), or null if none.
 */
export async function confirmSafepayPayment(tracker: string): Promise<string | null> {
  const config = requireSafepayConfig();
  const settled = await fetchSafepayTracker(config, tracker);
  if (!settled.orderNumber) return null;

  const order = await getOrderByNumber(settled.orderNumber);
  if (!order || order.paymentMethod !== "safepay") return null;
  if (order.paymentStatus !== "unpaid") return order.orderNumber;

  const problem = settlementProblem(settled, order);
  if (problem) {
    console.warn(`safepay: tracker ${tracker} does not settle ${order.orderNumber}: ${problem}`);
    return order.orderNumber;
  }

  await markOrderPaid(order.orderNumber, settled.tracker);
  return order.orderNumber;
}
