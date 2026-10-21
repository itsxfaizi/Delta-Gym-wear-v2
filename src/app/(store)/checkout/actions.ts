"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { ZodError } from "zod";

import { OutOfStockError } from "@/features/orders/inventory";
import { checkoutInputSchema } from "@/features/orders/schemas";
import { calculateOrderTotals } from "@/features/orders/orders";
import { promotionCodeSchema } from "@/features/promotions/schemas";
import { calculatePromotionDiscount, PromotionError } from "@/features/promotions/promotions";
import { getPromotionByCode } from "@/server/promotions/queries";
import { requireOrdersDatabase } from "@/server/orders/queries";
import { productVariants, products } from "@/server/db/schema";
import { consumeRateLimit } from "@/server/rate-limit";
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
  if (error instanceof PromotionError) {
    return error.reason === "exhausted" ? "This promo code has reached its usage limit." :
      error.reason === "expired" ? "This promo code has expired." :
      error.reason === "inactive" ? "This promo code is not active." :
      error.reason === "invalid_amount" ? "This promo code cannot be applied to this order." :
      "This promo code was not found.";
  }
  if (error instanceof ZodError) {
    return "Some of the details you entered are not valid. Please check the form and try again.";
  }
  console.error("checkout: placing the order failed", error);
  return "We could not place your order. Please try again.";
}

/** Preview against current catalog prices. Final eligibility is checked again in the order transaction. */
export async function previewPromotionAction(rawInput: unknown): Promise<
  { ok: true; code: string; subtotalAmount: number; discountAmount: number; shippingAmount: number; totalAmount: number } |
  { ok: false; message: string }
> {
  try {
    const forwarded = (await headers()).get("x-forwarded-for") ?? "";
    const caller = forwarded.split(",")[0]?.trim() || "unknown";
    if (!consumeRateLimit(`promo-preview:${caller}`, 20, 10 * 60_000).allowed) {
      return { ok: false, message: "Please wait a few minutes before trying another promo code." };
    }
    const request = checkoutInputSchema.pick({ lines: true, promoCode: true }).parse(rawInput);
    const code = promotionCodeSchema.parse(request.promoCode);
    const { db, tenantId } = requireOrdersDatabase();
    const ids = [...new Set(request.lines.map((line) => line.productVariantId))];
    const rows = await db.select({ id: productVariants.id, priceAmount: productVariants.priceAmount })
      .from(productVariants)
      .innerJoin(products, and(eq(products.id, productVariants.productId), eq(products.tenantId, tenantId)))
      .where(and(eq(productVariants.tenantId, tenantId), inArray(productVariants.id, ids),
        eq(productVariants.isAvailable, true), eq(products.status, "published")));
    if (rows.length !== ids.length) throw new UnknownVariantError(ids.filter((id) => !rows.some((row) => row.id === id)));
    const lines = request.lines.map((line) => ({ quantity: line.quantity,
      unitPriceAmount: rows.find((row) => row.id === line.productVariantId)!.priceAmount }));
    const subtotalAmount = lines.reduce((sum, line) => sum + line.unitPriceAmount * line.quantity, 0);
    const promo = await getPromotionByCode(code);
    if (!promo) throw new PromotionError("unknown");
    const discountAmount = calculatePromotionDiscount(subtotalAmount, promo);
    return { ok: true, code, ...calculateOrderTotals(lines, undefined, discountAmount) };
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }
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
