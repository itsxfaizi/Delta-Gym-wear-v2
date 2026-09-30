import { NextResponse, type NextRequest } from "next/server";

import { verifySafepayWebhookSignature } from "@/features/payments/safepay";
import { getSafepayConfig } from "@/server/env";
import { confirmSafepayPayment } from "@/server/payments/safepay";

/**
 * Safepay's server-to-server notification, the source of truth when the shopper
 * closes the tab before the return redirect. Safepay retries until it sees a 2xx,
 * so: 401 for a bad signature, 500 when we could not confirm (retry later), 200
 * for everything we have handled or deliberately ignore.
 */
export async function POST(request: NextRequest) {
  const config = getSafepayConfig();
  if (!config?.webhookSecret) return NextResponse.json({ error: "Safepay webhooks are not configured." }, { status: 503 });

  // Read the raw text: the signature is computed over the bytes Safepay sent.
  const rawBody = await request.text();
  if (!verifySafepayWebhookSignature(rawBody, request.headers.get("x-sfpy-signature"), config.webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: { type?: unknown; data?: { tracker?: unknown } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const tracker = event.data?.tracker;
  if (event.type !== "payment.succeeded" || typeof tracker !== "string") {
    return NextResponse.json({ received: true });
  }

  try {
    await confirmSafepayPayment(tracker);
  } catch (error) {
    console.error(`safepay webhook: could not confirm tracker ${tracker}`, error);
    return NextResponse.json({ error: "Could not confirm the payment yet." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
