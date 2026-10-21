import { AuthorizationError, type AuthenticatedPrincipal } from "@/server/authorization";

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
});
