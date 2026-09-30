import { NextResponse, type NextRequest } from "next/server";

import { confirmSafepayPayment } from "@/server/payments/safepay";

/**
 * Safepay sends the shopper back here after paying: `?tracker=` on a GET (API v3),
 * or a form POST with `tracker` (older hosted checkout). The tracker is only a
 * lookup key — confirmSafepayPayment re-fetches it from Safepay before anything
 * is marked paid. `?order=` is ours, so the shopper still reaches their receipt
 * when Safepay cannot be reached; the webhook then settles the payment later.
 */
async function settleAndRedirect(request: NextRequest, tracker: string | null) {
  const fallbackOrder = request.nextUrl.searchParams.get("order");
  let orderNumber: string | null = null;

  if (tracker) {
    try {
      orderNumber = await confirmSafepayPayment(tracker);
    } catch (error) {
      console.error(`safepay return: could not confirm tracker ${tracker}`, error);
    }
  }

  const resolved = orderNumber ?? fallbackOrder;
  const destination = resolved ? `/orders/${encodeURIComponent(resolved)}` : "/";
  // 303 so a POST callback is followed by a GET of the receipt.
  return NextResponse.redirect(new URL(destination, request.nextUrl.origin), 303);
}

export async function GET(request: NextRequest) {
  return settleAndRedirect(request, request.nextUrl.searchParams.get("tracker"));
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const tracker = form?.get("tracker");
  return settleAndRedirect(
    request,
    typeof tracker === "string" ? tracker : request.nextUrl.searchParams.get("tracker"),
  );
}
