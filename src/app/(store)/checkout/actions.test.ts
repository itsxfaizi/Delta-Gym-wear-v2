/** @jest-environment node */

jest.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "198.51.100.20" }) }));
jest.mock("@/server/orders/queries", () => ({ requireOrdersDatabase: jest.fn() }));
jest.mock("@/server/promotions/queries", () => ({ getPromotionByCode: jest.fn() }));
jest.mock("@/server/rate-limit", () => ({ consumeRateLimit: jest.fn(() => ({ allowed: true })) }));
jest.mock("@/server/auth/session", () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock("@/server/account/customers", () => ({ ensureCustomerId: jest.fn() }));
jest.mock("@/server/orders/mutations", () => ({ placeCodOrder: jest.fn() }));
jest.mock("@/server/orders/receipt-access", () => ({ rememberPlacedOrder: jest.fn() }));

import { getPromotionByCode } from "@/server/promotions/queries";
import { requireOrdersDatabase } from "@/server/orders/queries";

import { previewPromotionAction } from "./actions";

describe("previewPromotionAction", () => {
  it("uses current catalog prices instead of a forged price in the browser payload", async () => {
    const variantId = "123e4567-e89b-42d3-a456-426614174002";
    const where = jest.fn().mockResolvedValue([{ id: variantId, priceAmount: 100_000 }]);
    const innerJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ innerJoin });
    jest.mocked(requireOrdersDatabase).mockReturnValue({
      tenantId: "123e4567-e89b-42d3-a456-426614174001",
      db: { select: jest.fn().mockReturnValue({ from }) },
    } as unknown as ReturnType<typeof requireOrdersDatabase>);
    jest.mocked(getPromotionByCode).mockResolvedValue({
      id: "123e4567-e89b-42d3-a456-426614174003",
      tenantId: "123e4567-e89b-42d3-a456-426614174001",
      code: "SAVE10", kind: "percentage", value: 10,
      expiresAt: new Date(Date.now() + 60_000), usageLimit: 10,
      usageCount: 0, active: true, createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await previewPromotionAction({
      promoCode: "SAVE10",
      lines: [{ productVariantId: variantId, quantity: 1, unitPriceAmount: 1 }],
    });

    expect(result).toEqual({
      ok: true, code: "SAVE10", subtotalAmount: 100_000, discountAmount: 10_000,
      shippingAmount: 25_000, totalAmount: 115_000,
    });
  });
});
