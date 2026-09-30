/** @jest-environment node */
import { createHmac } from "node:crypto";

import {
  buildSafepayCheckoutUrl,
  parseSafepayTracker,
  settlementProblem,
  verifySafepayWebhookSignature,
  type SafepayTracker,
} from "./safepay";

const SECRET = "whsec_test";
const sign = (payload: string) => createHmac("sha512", SECRET).update(payload).digest("hex");

const webhookBody = JSON.stringify({
  token: "evt_1",
  type: "payment.succeeded",
  data: { tracker: "track_1", state: "TRACKER_ENDED", amount: 475000, currency: "PKR" },
});

describe("verifySafepayWebhookSignature", () => {
  it("accepts a signature over the raw body", () => {
    expect(verifySafepayWebhookSignature(webhookBody, sign(webhookBody), SECRET)).toBe(true);
  });

  it("accepts a signature over the stringified data field, as the older SDK computed it", () => {
    const data = JSON.stringify(JSON.parse(webhookBody).data);
    expect(verifySafepayWebhookSignature(webhookBody, sign(data), SECRET)).toBe(true);
  });

  it("rejects a tampered body, a wrong secret, a missing header and non-hex junk", () => {
    const tampered = webhookBody.replace("475000", "1");
    expect(verifySafepayWebhookSignature(tampered, sign(webhookBody), SECRET)).toBe(false);
    expect(verifySafepayWebhookSignature(webhookBody, sign(webhookBody), "other")).toBe(false);
    expect(verifySafepayWebhookSignature(webhookBody, null, SECRET)).toBe(false);
    expect(verifySafepayWebhookSignature(webhookBody, "not-hex", SECRET)).toBe(false);
    expect(verifySafepayWebhookSignature("not json", sign("x"), SECRET)).toBe(false);
  });
});

describe("parseSafepayTracker", () => {
  const reporterBody = (orderId: unknown) => ({
    data: {
      token: "track_1",
      state: "TRACKER_ENDED",
      metadata: { order_id: orderId },
      charge: { amount: { currency: "PKR", amount: 475000 } },
    },
  });

  it("reads order_id bare or wrapped in { value }", () => {
    expect(parseSafepayTracker(reporterBody("DG-240131-0001")).orderNumber).toBe("DG-240131-0001");
    expect(parseSafepayTracker(reporterBody({ value: "DG-240131-0001" })).orderNumber).toBe("DG-240131-0001");
  });

  it("leaves amount null for a tracker that has no charge yet", () => {
    const parsed = parseSafepayTracker({ data: { token: "track_1", state: "TRACKER_STARTED" } });
    expect(parsed).toEqual({
      tracker: "track_1",
      state: "TRACKER_STARTED",
      orderNumber: null,
      amount: null,
      currency: null,
    });
  });

  it("throws on a response that is not a tracker", () => {
    expect(() => parseSafepayTracker({ error: "nope" })).toThrow();
  });
});

describe("settlementProblem", () => {
  const order = { orderNumber: "DG-240131-0001", totalAmount: 475000, currency: "PKR" };
  const paid: SafepayTracker = {
    tracker: "track_1",
    state: "TRACKER_ENDED",
    orderNumber: order.orderNumber,
    amount: 475000,
    currency: "PKR",
  };

  it("settles an ended tracker for this order and the exact total", () => {
    expect(settlementProblem(paid, order)).toBeNull();
  });

  it.each([
    ["an unfinished tracker", { state: "TRACKER_STARTED" }],
    ["another order's tracker", { orderNumber: "DG-240131-0002" }],
    ["a short payment", { amount: 100 }],
    ["a different currency", { currency: "USD" }],
    ["a tracker with no charge", { amount: null, currency: null }],
  ])("refuses %s", (_label, override) => {
    expect(settlementProblem({ ...paid, ...override }, order)).not.toBeNull();
  });
});

describe("buildSafepayCheckoutUrl", () => {
  it("points at the environment's hosted checkout with every parameter encoded", () => {
    const url = new URL(
      buildSafepayCheckoutUrl({
        environment: "sandbox",
        tracker: "track_1",
        tbt: "tbt+/=",
        orderNumber: "DG-240131-0001",
        redirectUrl: "https://shop.example/api/payments/safepay/return?order=DG-240131-0001",
        cancelUrl: "https://shop.example/orders/DG-240131-0001?payment=cancelled",
      }),
    );

    expect(url.origin + url.pathname).toBe("https://sandbox.api.getsafepay.com/embedded/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      environment: "sandbox",
      tracker: "track_1",
      tbt: "tbt+/=",
      source: "hosted",
      order_id: "DG-240131-0001",
      redirect_url: "https://shop.example/api/payments/safepay/return?order=DG-240131-0001",
      cancel_url: "https://shop.example/orders/DG-240131-0001?payment=cancelled",
    });
  });
});
