import { z } from "zod";

import { cartLineInputSchema, type CartLineInput } from "@/features/catalog/cart";

/**
 * The same `(productHandle, variantId)` may arrive on more than one line, and
 * every line is resolved independently downstream, so 100 lines x 99 units of
 * one variant is legal input today and the money columns overflow on it.
 * Summing at the parse boundary gives one line per variant, which is what makes
 * the per-line quantity cap mean anything.
 */
export function coalesceCartLines(lines: readonly CartLineInput[]): CartLineInput[] {
  const byVariant = new Map<string, CartLineInput>();
  for (const line of lines) {
    const key = `${line.productHandle}:${line.variantId}`;
    const existing = byVariant.get(key);
    if (existing) existing.quantity += line.quantity;
    else byVariant.set(key, { ...line });
  }
  return [...byVariant.values()];
}

const optionalText = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(160).optional(),
);

export const checkoutOrderSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z.string().trim().regex(/^03\d{9}$/, "Enter a Pakistani mobile number like 03XXXXXXXXX."),
  email: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().email("Enter a valid email address.").max(160).optional(),
  ),
  addressLine1: z.string().trim().min(5, "Enter your delivery address.").max(180),
  addressLine2: optionalText,
  city: z.string().trim().min(2, "Enter your city.").max(80),
  province: optionalText,
  postalCode: optionalText,
  country: z.literal("PK"),
  // Re-validated against the SAME per-line rules after coalescing, so the
  // existing `quantity.max(99)` becomes the cap on the summed quantity too and
  // is not written down twice. A sum over the cap is refused rather than
  // clamped: the cart UI merges on add and caps at 99, so only fabricated input
  // can reach it, and silently reducing a quantity on a COD order is the kind of
  // surprise a courier discovers at the buyer's door.
  cartLines: z.array(cartLineInputSchema)
    .min(1, "Your cart is empty.")
    .max(100)
    .transform(coalesceCartLines)
    .pipe(z.array(cartLineInputSchema)),
});

export function parseCheckoutFormData(formData: FormData) {
  let cartLines: unknown = [];
  try {
    cartLines = JSON.parse(String(formData.get("cartLines") ?? "[]"));
  } catch {
    cartLines = [];
  }

  return checkoutOrderSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    province: formData.get("province"),
    postalCode: formData.get("postalCode"),
    country: "PK",
    cartLines,
  });
}
