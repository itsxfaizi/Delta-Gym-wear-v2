import { z } from "zod";

import { normalizePromotionCode } from "./promotions";

export const promotionCodeSchema = z.string().trim().transform(normalizePromotionCode)
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/, "Use 3–32 letters, numbers, _ or -."));

const positiveWholeNumber = z.coerce.number<number>().int().min(1).max(1_000_000);
const fixedRupees = z.string().trim().regex(/^\d{1,7}(?:\.\d{1,2})?$/, "Enter rupees with up to two decimals.")
  .transform((value) => {
    const [whole, fraction = ""] = value.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  }).pipe(z.number().int().positive().max(999_999_999));

const promotionFieldsSchema = z.object({
  code: promotionCodeSchema,
  kind: z.enum(["percentage", "fixed"]),
  value: z.string().trim(),
  expiresAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
  usageLimit: positiveWholeNumber,
  active: z.boolean(),
});

const transformPromotionInput = (input: z.infer<typeof promotionFieldsSchema>, context: z.RefinementCtx) => {
  const parsed = input.kind === "percentage"
    ? z.coerce.number<number>().int().min(1).max(100).safeParse(input.value)
    : fixedRupees.safeParse(input.value);
  if (!parsed.success) {
    context.addIssue({ code: "custom", path: ["value"], message: input.kind === "percentage"
      ? "Enter a whole percentage from 1 to 100."
      : "Enter a positive rupee amount with up to two decimals." });
    return z.NEVER;
  }
  return { ...input, value: parsed.data };
};

export const promotionInputSchema = promotionFieldsSchema.transform(transformPromotionInput);

export const promotionUpdateSchema = promotionFieldsSchema.extend({ id: z.string().uuid() })
  .transform((input, context) => ({ ...transformPromotionInput(input, context), id: input.id }));
