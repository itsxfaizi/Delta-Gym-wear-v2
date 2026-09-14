"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { getCustomerByAuthUserId } from "@/features/account/queries";
import { OutOfStockError } from "@/features/orders/inventory";
import { getAuthenticatedUser } from "@/server/auth/session";
import { UnknownVariantError, placeCodOrder } from "@/server/orders/mutations";
import { OrdersDatabaseUnavailableError } from "@/server/orders/queries";
import { rememberPlacedOrder } from "@/server/orders/receipt-access";

export type CheckoutActionResult = { ok: false; message: string };

/** Attaches the order to the signed-in customer; a guest checkout stays anonymous. */
async function resolveCustomerId(): Promise<string | null> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return null;
    const customer = await getCustomerByAuthUserId(user.id);
    return customer?.id ?? null;
  } catch {
    // Supabase is not configured in this environment: continue as a guest.
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
  if (error instanceof ZodError) {
    return "Some of the details you entered are not valid. Please check the form and try again.";
  }
  console.error("checkout: placing the order failed", error);
  return "We could not place your order. Please try again.";
}

/**
 * Re-validates the checkout payload server-side (placeCodOrder parses it with the
 * same zod schema the form uses) and redirects to the order receipt on success.
 */
export async function placeOrderAction(rawInput: unknown): Promise<CheckoutActionResult | void> {
  let orderNumber: string;

  try {
    const order = await placeCodOrder(rawInput, { customerId: await resolveCustomerId() });
    orderNumber = order.orderNumber;
    await rememberPlacedOrder(orderNumber);
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  redirect(`/orders/${orderNumber}`);
}
