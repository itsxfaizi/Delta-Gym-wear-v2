"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { OutOfStockError } from "@/features/orders/inventory";
import { checkoutInputSchema } from "@/features/orders/schemas";
import { ensureCustomerId } from "@/server/account/customers";
import { getAuthenticatedUser } from "@/server/auth/session";
import { UnknownVariantError, placeOrder } from "@/server/orders/mutations";
import { OrdersDatabaseUnavailableError, getOrderByNumber } from "@/server/orders/queries";
import { canViewOrder, rememberPlacedOrder } from "@/server/orders/receipt-access";
import { SafepayUnavailableError, requireSafepayConfig, startSafepayCheckout } from "@/server/payments/safepay";

export type CheckoutActionResult = { ok: false; message: string };

/**
 * Attaches the order to the signed-in customer; a guest checkout stays
 * anonymous. The customer record is created here if it does not exist yet —
 * this checkout is the first moment the shopper has one.
 */
async function resolveCustomerId(rawInput: unknown): Promise<string | null> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return null;

    const input = checkoutInputSchema.safeParse(rawInput);
    if (!input.success) return null;

    return await ensureCustomerId(user.id, {
      email: input.data.contactEmail || user.email || "",
      fullName: input.data.shippingAddress.fullName,
      phone: input.data.contactPhone,
    });
  } catch (error) {
    // Supabase or the database is unavailable here: the order still goes
    // through as a guest checkout rather than failing over a history link.
    console.error("checkout: could not resolve the customer record", error);
    return null;
  }
}

function toMessage(error: unknown): string {
  if (error instanceof OutOfStockError) {
    const items = error.shortfalls
      .map((item) => `${item.sku ?? item.productVariantId} (${item.available} left, you asked for ${item.requested})`)
      .join(", ");
    return `We no longer have enough stock for ${items}. Update the quantity in your cart and try again.`;
  }
  if (error instanceof UnknownVariantError) {
    return "An item in your cart is no longer available. Remove it and try again.";
  }
  if (error instanceof OrdersDatabaseUnavailableError) {
    return "Checkout is temporarily unavailable. Please try again shortly.";
  }
  if (error instanceof SafepayUnavailableError) {
    return "Online payment is unavailable right now. Choose cash on delivery or try again shortly.";
  }
  if (error instanceof ZodError) {
    return "Some of the details you entered are not valid. Please check the form and try again.";
  }
  console.error("checkout: placing the order failed", error);
  return "We could not place your order. Please try again.";
}

/** Where to send the shopper after a Safepay order is placed; the receipt offers "Pay now" if this fails. */
async function safepayCheckoutUrlOrReceipt(order: { orderNumber: string; totalAmount: number; currency: string }) {
  try {
    return await startSafepayCheckout(order);
  } catch (error) {
    console.error(`checkout: could not open Safepay for ${order.orderNumber}`, error);
    return `/orders/${order.orderNumber}?payment=unavailable`;
  }
}

/**
 * Re-validates the checkout payload server-side (placeOrder parses it with the
 * same zod schema the form uses), then redirects to the order receipt for cash
 * on delivery or to Safepay's hosted checkout for online payment.
 */
export async function placeOrderAction(rawInput: unknown): Promise<CheckoutActionResult | void> {
  let destination: string;

  try {
    // Refuse before stock is reserved, not after, when online payment is off.
    if ((rawInput as { paymentMethod?: unknown } | null)?.paymentMethod === "safepay") requireSafepayConfig();

    const order = await placeOrder(rawInput, { customerId: await resolveCustomerId(rawInput) });
    await rememberPlacedOrder(order.orderNumber);
    destination =
      order.paymentMethod === "safepay" ? await safepayCheckoutUrlOrReceipt(order) : `/orders/${order.orderNumber}`;
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  redirect(destination);
}

/** "Pay now" on the receipt of an unpaid Safepay order: a cancelled or abandoned payment is retried here. */
export async function payOrderAction(orderNumber: string): Promise<CheckoutActionResult | void> {
  let destination: string;

  try {
    const order = await getOrderByNumber(orderNumber);
    if (!order || order.paymentMethod !== "safepay" || !(await canViewOrder(order))) {
      return { ok: false, message: "This order could not be found." };
    }
    if (order.paymentStatus !== "unpaid" || order.status === "cancelled") {
      return { ok: false, message: "This order no longer needs payment." };
    }

    destination = await startSafepayCheckout(order);
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  redirect(destination);
}
