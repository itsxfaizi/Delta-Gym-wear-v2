export type PromotionKind = "percentage" | "fixed";

export type PromotionTerms = {
  code: string;
  kind: PromotionKind;
  value: number;
  expiresAt: Date;
  usageLimit: number;
  usageCount: number;
  active: boolean;
};

export type PromotionFailure = "unknown" | "inactive" | "expired" | "exhausted" | "invalid_amount";

export class PromotionError extends Error {
  constructor(public readonly reason: PromotionFailure) {
    super(reason === "unknown" ? "This promo code was not found." : `This promo code is ${reason.replace("_", " ")}.`);
    this.name = "PromotionError";
  }
}

export function normalizePromotionCode(code: string): string {
  return code.trim().toUpperCase();
}

/** The percentage rounds to the nearest paisa, once, against merchandise only. */
export function calculatePromotionDiscount(
  subtotalAmount: number,
  promotion: PromotionTerms,
  now: Date = new Date(),
): number {
  if (!promotion.active) throw new PromotionError("inactive");
  if (promotion.expiresAt.getTime() <= now.getTime()) throw new PromotionError("expired");
  if (promotion.usageCount >= promotion.usageLimit) throw new PromotionError("exhausted");
  if (!Number.isSafeInteger(subtotalAmount) || subtotalAmount <= 0) throw new PromotionError("invalid_amount");
  if (
    !Number.isSafeInteger(promotion.value) ||
    (promotion.kind === "percentage" && (promotion.value < 1 || promotion.value > 100)) ||
    (promotion.kind === "fixed" && promotion.value <= 0)
  ) throw new PromotionError("invalid_amount");

  const discount = Math.min(
    subtotalAmount,
    promotion.kind === "percentage"
      ? Math.round(subtotalAmount * promotion.value / 100)
      : promotion.value,
  );
  if (discount <= 0) throw new PromotionError("invalid_amount");
  return discount;
}
