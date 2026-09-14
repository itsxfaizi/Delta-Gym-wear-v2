import { z } from "zod";

import { ORDER_STATUSES } from "./types";

/** Permissive PK shape: 03xxxxxxxxx, +923xxxxxxxxx, or 0092…, spaces/dashes allowed. */
const phoneSchema = z
  .string()
  .trim()
  .min(10)
  .max(24)
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => /^(?:\+92|0092|92|0)3\d{9}$/.test(value), {
    message: "Enter a valid Pakistani mobile number, for example 03001234567.",
  });

export const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  line1: z.string().trim().min(4).max(200),
  line2: z.string().trim().max(200).nullish().transform((value) => value || null),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^(?:\d{5})?$/, "Postal code must be 5 digits.")
    .nullish()
    .transform((value) => value || null),
  country: z.string().trim().length(2).default("PK"),
});

export const checkoutLineSchema = z.object({
  // Not .uuid(): the development seed catalog uses slug ids, and the real guard is
  // the variant lookup in placeCodOrder, which throws UnknownVariantError.
  productVariantId: z.string().min(1).max(128),
  quantity: z.number().int().min(1).max(99),
});

export const checkoutInputSchema = z.object({
  contactEmail: z.string().trim().toLowerCase().email().max(254),
  contactPhone: phoneSchema,
  shippingAddress: addressSchema,
  notes: z.string().trim().max(1000).nullish().transform((value) => value || null),
  lines: z.array(checkoutLineSchema).min(1).max(50),
});

export const orderStatusTransitionSchema = z.object({
  orderId: z.string().uuid(),
  nextStatus: z.enum(ORDER_STATUSES),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type CheckoutLineInput = z.infer<typeof checkoutLineSchema>;
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type OrderStatusTransitionInput = z.infer<typeof orderStatusTransitionSchema>;
