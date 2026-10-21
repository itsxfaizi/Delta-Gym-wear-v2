jest.mock("server-only", () => ({}));
jest.mock("@/server/orders/queries", () => ({ requireOrdersDatabase: jest.fn() }));

import { AuthorizationError, type AuthenticatedPrincipal } from "@/server/authorization";
import { requireOrdersDatabase } from "@/server/orders/queries";

import { createPromotion, setPromotionActive, updatePromotion } from "./mutations";

const editor: AuthenticatedPrincipal = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  membership: { role: "catalog_editor", status: "active" },
};

describe("promotion mutation authorization", () => {
  it("rejects unauthenticated creation before accessing the database", async () => {
    await expect(createPromotion({}, null)).rejects.toThrow(AuthorizationError);
  });

  it("rejects non-owner update and disable before accessing the database", async () => {
    await expect(updatePromotion({}, editor)).rejects.toThrow(AuthorizationError);
    await expect(setPromotionActive("33333333-3333-4333-8333-333333333333", false, editor)).rejects.toThrow(AuthorizationError);
  });

  it("rejects suspended owners", async () => {
    await expect(createPromotion({}, { ...editor, membership: { role: "owner", status: "suspended" } }))
      .rejects.toThrow(AuthorizationError);
  });

  it("does not let an owner lower the usage cap below redeemed orders", async () => {
    const promoId = "33333333-3333-4333-8333-333333333333";
    const previous = {
      id: promoId, tenantId: editor.tenantId, code: "SAVE10", kind: "percentage", value: 10,
      expiresAt: new Date(Date.now() + 60_000), usageLimit: 5, usageCount: 4,
      active: true, createdAt: new Date(), updatedAt: new Date(),
    };
    const forUpdate = jest.fn().mockResolvedValue([previous]);
    const limit = jest.fn().mockReturnValue({ for: forUpdate });
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const update = jest.fn();
    jest.mocked(requireOrdersDatabase).mockReturnValue({
      tenantId: editor.tenantId,
      db: {
        transaction: async (work: (tx: unknown) => Promise<unknown>) => work({
          select: () => ({ from }), update,
        }),
      },
    } as unknown as ReturnType<typeof requireOrdersDatabase>);

    await expect(updatePromotion({
      id: promoId, code: "SAVE10", kind: "percentage", value: "10",
      expiresAt: new Date(Date.now() + 120_000).toISOString(), usageLimit: 3, active: true,
    }, { ...editor, membership: { role: "owner", status: "active" } }))
      .rejects.toThrow("Usage limit cannot be below the number already redeemed.");
    expect(update).not.toHaveBeenCalled();
  });
});
