"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { OutOfStockError } from "@/features/orders/inventory";
import { checkoutInputSchema } from "@/features/orders/schemas";
import { ensureCustomerId } from "@/server/account/customers";
import { getAuthenticatedUser } from "@/server/auth/session";
import { UnknownVariantError, placeCodOrder } from "@/server/orders/mutations";
import { OrdersDatabaseUnavailableError } from "@/server/orders/queries";
import { rememberPlacedOrder } from "@/server/orders/receipt-access";

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
    const order = await placeCodOrder(rawInput, { customerId: await resolveCustomerId(rawInput) });
    orderNumber = order.orderNumber;
    await rememberPlacedOrder(orderNumber);
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  redirect(`/orders/${orderNumber}`);
}
