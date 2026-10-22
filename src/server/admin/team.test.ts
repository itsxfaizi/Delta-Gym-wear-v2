jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/server/admin/guard", () => ({ requireAdminPrincipal: jest.fn() }));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));
jest.mock("@/server/auth/supabase", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/server/rate-limit", () => ({ consumeRateLimit: jest.fn(() => ({ allowed: true })) }));
jest.mock("@/server/env", () => ({ getServerEnv: () => ({ APP_URL: "https://delta.test" }) }));

import { AuthorizationError } from "@/server/authorization";
import { createSupabaseServiceClient } from "@/server/auth/supabase";
import { createDatabase } from "@/server/db";
import { consumeRateLimit } from "@/server/rate-limit";

import { requireAdminPrincipal } from "./guard";
import { inviteTeamMember } from "./team";

describe("inviteTeamMember authorization", () => {
  const emailReady = process.env.DELTA_INVITE_EMAIL_READY;
  beforeEach(() => { process.env.DELTA_INVITE_EMAIL_READY = "true"; });
  afterEach(() => {
    if (emailReady === undefined) delete process.env.DELTA_INVITE_EMAIL_READY;
    else process.env.DELTA_INVITE_EMAIL_READY = emailReady;
  });
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
    const previousRedirect = process.env.DELTA_INVITE_REDIRECT_READY;
    delete process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
    delete process.env.DELTA_INVITE_REDIRECT_READY;
    try {
      const result = await inviteTeamMember({ email: "staff@example.com", role: "auditor" });
      expect(result).toEqual({
        ok: false,
        message: "Staff invitations are not configured yet. Ask an operator to verify the Supabase invite redirect.",
      });
      expect(createDatabase).not.toHaveBeenCalled();
      expect(createSupabaseServiceClient).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
      else process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY = previous;
      if (previousRedirect === undefined) delete process.env.DELTA_INVITE_REDIRECT_READY;
      else process.env.DELTA_INVITE_REDIRECT_READY = previousRedirect;
    }
  });

  it("uses the dedicated default-template redirect only after its readiness gate", async () => {
    jest.mocked(requireAdminPrincipal).mockResolvedValue({
      userId: "123e4567-e89b-42d3-a456-426614174000",
      tenantId: "123e4567-e89b-42d3-a456-426614174001",
      membership: { role: "owner", status: "active" },
    });
    const limit = jest.fn().mockResolvedValue([]);
    jest.mocked(createDatabase).mockReturnValue({ select: () => ({ from: () => ({ where: () => ({ limit }) }) }) } as never);
    const inviteUserByEmail = jest.fn().mockResolvedValue({ data: {}, error: null });
    jest.mocked(createSupabaseServiceClient).mockReturnValue({ auth: { admin: { inviteUserByEmail } } } as never);
    const previousRedirect = process.env.DELTA_INVITE_REDIRECT_READY;
    const previousTokenHash = process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
    process.env.DELTA_INVITE_REDIRECT_READY = "true";
    delete process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
    try {
      await inviteTeamMember({ email: "staff@example.com", role: "publisher" });
      expect(inviteUserByEmail).toHaveBeenCalledWith("staff@example.com", {
        redirectTo: "https://delta.test/auth/invite",
      });
    } finally {
      if (previousRedirect === undefined) delete process.env.DELTA_INVITE_REDIRECT_READY;
      else process.env.DELTA_INVITE_REDIRECT_READY = previousRedirect;
      if (previousTokenHash === undefined) delete process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
      else process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY = previousTokenHash;
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

  it("stops a throttled owner before querying the database or sending email", async () => {
    jest.mocked(requireAdminPrincipal).mockResolvedValue({
      userId: "123e4567-e89b-42d3-a456-426614174000",
      tenantId: "123e4567-e89b-42d3-a456-426614174001",
      membership: { role: "owner", status: "active" },
    });
    jest.mocked(consumeRateLimit).mockReturnValueOnce({ allowed: false, retryAfterMs: 1000 });
    const previousReadyFlag = process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
    process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY = "true";
    try {
      const result = await inviteTeamMember({ email: "staff@example.com", role: "publisher" });
      expect(result).toEqual({ ok: false, message: "Too many invitations have been requested. Try again later." });
      expect(consumeRateLimit).toHaveBeenCalledWith(
        "team-invite:123e4567-e89b-42d3-a456-426614174001:123e4567-e89b-42d3-a456-426614174000",
        10,
        60 * 60_000,
      );
      expect(createDatabase).not.toHaveBeenCalled();
      expect(createSupabaseServiceClient).not.toHaveBeenCalled();
    } finally {
      if (previousReadyFlag === undefined) delete process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY;
      else process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY = previousReadyFlag;
    }
  });
});
