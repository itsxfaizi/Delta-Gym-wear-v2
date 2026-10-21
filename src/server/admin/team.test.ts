jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/server/admin/guard", () => ({ requireAdminPrincipal: jest.fn() }));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));
jest.mock("@/server/auth/supabase", () => ({ createSupabaseServiceClient: jest.fn() }));

import { AuthorizationError } from "@/server/authorization";
import { createSupabaseServiceClient } from "@/server/auth/supabase";
import { createDatabase } from "@/server/db";

import { requireAdminPrincipal } from "./guard";
import { inviteTeamMember } from "./team";

describe("inviteTeamMember authorization", () => {
  it("does not touch Auth or the database when the actor is not an owner", async () => {
    jest.mocked(requireAdminPrincipal).mockRejectedValue(new AuthorizationError());

    const result = await inviteTeamMember({ email: "staff@example.com", role: "auditor" });

    expect(result).toEqual({ ok: false, message: "You do not have permission to do that." });
    expect(requireAdminPrincipal).toHaveBeenCalledWith(["owner"]);
    expect(createDatabase).not.toHaveBeenCalled();
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("rejects malformed input before any privileged call", async () => {
    const result = await inviteTeamMember({ email: "invalid", role: "owner" });

    expect(result.ok).toBe(false);
    expect(requireAdminPrincipal).not.toHaveBeenCalled();
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("refuses to send an email until the invite callback template is verified", async () => {
    jest.mocked(requireAdminPrincipal).mockResolvedValue({
      userId: "123e4567-e89b-42d3-a456-426614174000",
      tenantId: "123e4567-e89b-42d3-a456-426614174001",
      membership: { role: "owner", status: "active" },
    });
    const previous = process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
    delete process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
    try {
      const result = await inviteTeamMember({ email: "staff@example.com", role: "auditor" });
      expect(result).toEqual({
        ok: false,
        message: "Staff invitations are not configured yet. Ask an operator to verify the Supabase invite email template.",
      });
      expect(createDatabase).not.toHaveBeenCalled();
      expect(createSupabaseServiceClient).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
      else process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY = previous;
    }
  });

  it("does not send another invitation to an email already on this tenant", async () => {
    jest.mocked(requireAdminPrincipal).mockResolvedValue({
      userId: "123e4567-e89b-42d3-a456-426614174000",
      tenantId: "123e4567-e89b-42d3-a456-426614174001",
      membership: { role: "owner", status: "active" },
    });
    const limit = jest.fn().mockResolvedValue([{ authUserId: "123e4567-e89b-42d3-a456-426614174002" }]);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    jest.mocked(createDatabase).mockReturnValue({ select: () => ({ from }) } as unknown as ReturnType<typeof createDatabase>);
    const previousReadyFlag = process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
    process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY = "true";

    try {
      const result = await inviteTeamMember({ email: "Staff@Example.com", role: "publisher" });
      expect(result).toEqual({ ok: false, message: "That email already has a team membership on this store." });
      expect(createSupabaseServiceClient).not.toHaveBeenCalled();
    } finally {
      if (previousReadyFlag === undefined) delete process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
      else process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY = previousReadyFlag;
    }
  });
});
