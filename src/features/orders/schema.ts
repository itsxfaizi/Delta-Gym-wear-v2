import { z } from "zod";

import { cartLineInputSchema } from "@/features/catalog/cart";

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
  cartLines: z.array(cartLineInputSchema).min(1, "Your cart is empty.").max(100),
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
