import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

/**
 * Safepay hosted checkout (API v3). Endpoints and parameter names follow
 * @sfpy/node-core 0.3.x and https://safepay-docs.netlify.app — the SDK itself is
 * not a dependency because it is three HTTP calls and an HMAC.
 */
export type SafepayEnvironment = "sandbox" | "production";

export const SAFEPAY_HOSTS = {
  sandbox: { api: "https://sandbox.api.getsafepay.com", checkout: "https://sandbox.api.getsafepay.com/embedded/" },
  production: { api: "https://api.getsafepay.com", checkout: "https://getsafepay.com/embedded/" },
} as const satisfies Record<SafepayEnvironment, { api: string; checkout: string }>;

/** A tracker is paid once its lifecycle has ended; every other state is still in flight or failed. */
export const SAFEPAY_PAID_STATE = "TRACKER_ENDED";

export function buildSafepayCheckoutUrl(params: {
  environment: SafepayEnvironment;
  tracker: string;
  tbt: string;
  orderNumber: string;
  redirectUrl: string;
  cancelUrl: string;
}): string {
  const query = new URLSearchParams({
    environment: params.environment,
    tracker: params.tracker,
    tbt: params.tbt,
    source: "hosted",
    order_id: params.orderNumber,
    redirect_url: params.redirectUrl,
    cancel_url: params.cancelUrl,
  });
  return `${SAFEPAY_HOSTS[params.environment].checkout}?${query.toString()}`;
}

function hexEquals(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(actual, "hex");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

/**
 * X-SFPY-SIGNATURE is hex HMAC-SHA512 with the endpoint's shared secret. Safepay's
 * docs say it covers the raw body; their older SDK hashed JSON.stringify(body.data).
 * Either is accepted. This check is defence in depth only: a webhook never marks an
 * order paid by itself — the tracker is always re-fetched from Safepay first.
 */
export function verifySafepayWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const sign = (payload: string) => createHmac("sha512", secret).update(payload).digest("hex");

  if (hexEquals(sign(rawBody), signature)) return true;
  try {
    const data = (JSON.parse(rawBody) as { data?: unknown }).data;
    return data !== undefined && hexEquals(sign(JSON.stringify(data)), signature);
  } catch {
    return false;
  }
}

const moneySchema = z.object({ amount: z.number().int(), currency: z.string() });

/** GET /reporter/api/v1/payments/{tracker}. order_id has been seen both bare and wrapped in { value }. */
const reporterTrackerSchema = z.object({
  data: z.object({
    token: z.string(),
    state: z.string(),
    metadata: z
      .object({ order_id: z.union([z.string(), z.object({ value: z.string() })]).optional() })
      .partial()
      .nullish(),
    charge: z.object({ amount: moneySchema }).nullish(),
  }),
});

export type SafepayTracker = {
  tracker: string;
  state: string;
  orderNumber: string | null;
  /** Minor units, like every amount in this app. Null until the tracker has a charge. */
  amount: number | null;
  currency: string | null;
};

export function parseSafepayTracker(body: unknown): SafepayTracker {
  const { data } = reporterTrackerSchema.parse(body);
  const orderId = data.metadata?.order_id;

  return {
    tracker: data.token,
    state: data.state,
    orderNumber: typeof orderId === "string" ? orderId : (orderId?.value ?? null),
    amount: data.charge?.amount.amount ?? null,
    currency: data.charge?.amount.currency ?? null,
  };
}

/** Null when the tracker settles this order in full; otherwise why it does not. */
export function settlementProblem(
  tracker: SafepayTracker,
  order: { orderNumber: string; totalAmount: number; currency: string },
): string | null {
  if (tracker.state !== SAFEPAY_PAID_STATE) return `tracker state is ${tracker.state}`;
  if (tracker.orderNumber !== order.orderNumber) return `tracker is for order ${tracker.orderNumber}`;
  if (tracker.currency !== order.currency) return `charged in ${tracker.currency}, order is ${order.currency}`;
  if (tracker.amount !== order.totalAmount) return `charged ${tracker.amount}, order total is ${order.totalAmount}`;
  return null;
}
