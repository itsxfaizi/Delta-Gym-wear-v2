import { calculatePromotionDiscount, normalizePromotionCode, PromotionError } from "./promotions";
import { promotionInputSchema } from "./schemas";

const now = new Date("2026-10-21T12:00:00.000Z");
const base = {
  code: "DELTA10", kind: "percentage" as const, value: 10,
  expiresAt: new Date("2026-11-01T00:00:00.000Z"), usageLimit: 2,
  usageCount: 0, active: true,
};

describe("promo pricing and eligibility", () => {
  it("normalizes the code and rounds the percentage to the nearest paisa", () => {
    expect(normalizePromotionCode(" delta10 ")).toBe("DELTA10");
    expect(calculatePromotionDiscount(999, base, now)).toBe(100);
  });

  it("caps a fixed rupee discount at the merchandise subtotal", () => {
    expect(calculatePromotionDiscount(1_000, { ...base, kind: "fixed", value: 5_000 }, now)).toBe(1_000);
  });

  it.each([
    [{ active: false }, "inactive"],
    [{ expiresAt: now }, "expired"],
    [{ usageCount: 2 }, "exhausted"],
    [{ value: 0 }, "invalid_amount"],
  ] as const)("rejects %j as %s", (change, reason) => {
    expect(() => calculatePromotionDiscount(10_000, { ...base, ...change }, now)).toThrow(new PromotionError(reason));
  });

  it("parses admin fixed amounts from PKR rupees to integer paisa", () => {
    expect(promotionInputSchema.parse({
      code: " save50 ", kind: "fixed", value: "50.25", expiresAt: "2026-11-01T00:00:00.000Z",
      usageLimit: "25", active: true,
    })).toMatchObject({ code: "SAVE50", value: 5_025, usageLimit: 25 });
  });

  it("rejects malformed and nonpositive code values", () => {
    expect(promotionInputSchema.safeParse({ code: "!!", kind: "percentage", value: "0", expiresAt: "2026-11-01T00:00:00.000Z", usageLimit: "1", active: true }).success).toBe(false);
  });
});
