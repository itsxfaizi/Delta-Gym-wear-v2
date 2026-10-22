jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("./guard", () => ({ requireAdminPrincipal: jest.fn() }));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));
jest.mock("@/server/auth/supabase", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/server/rate-limit", () => ({ consumeRateLimit: jest.fn(() => ({ allowed: true })) }));
jest.mock("@/server/env", () => ({ getServerEnv: () => ({ APP_URL: "https://delta.test", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" }) }));

import { AuthorizationError } from "@/server/authorization";
import { createDatabase } from "@/server/db";
import { createSupabaseServiceClient } from "@/server/auth/supabase";
import { requireAdminPrincipal } from "./guard";
import { createTeamInvitationLink, inviteTeamMember } from "./team";

const actionLink = "https://project.supabase.co/auth/v1/verify?token=one-time-credential&type=invite&redirect_to=https%3A%2F%2Fdelta.test%2Fauth%2Finvite";

describe("owner-shared staff invitation", () => {
  const execute = jest.fn();
  const values = jest.fn();
  const transaction = jest.fn();
  const generateLink = jest.fn();
  const deleteUser = jest.fn();
  const original = process.env.DELTA_INVITE_REDIRECT_READY;
  beforeEach(() => {
    process.env.DELTA_INVITE_REDIRECT_READY = "true";
    jest.mocked(requireAdminPrincipal).mockResolvedValue({ userId: "owner", tenantId: "tenant", membership: { role: "owner", status: "active" } });
    execute.mockResolvedValue([]);
    values.mockResolvedValue(undefined);
    transaction.mockImplementation(async (run) => run({ insert: () => ({ values }) }));
    jest.mocked(createDatabase).mockReturnValue({ execute, transaction } as never);
    generateLink.mockResolvedValue({ data: { user: { id: "new-user", email_confirmed_at: null }, properties: { action_link: actionLink } }, error: null });
    jest.mocked(createSupabaseServiceClient).mockReturnValue({ auth: { admin: { generateLink, deleteUser } } } as never);
  });
  afterEach(() => {
    if (original === undefined) delete process.env.DELTA_INVITE_REDIRECT_READY;
    else process.env.DELTA_INVITE_REDIRECT_READY = original;
  });

  it("returns a validated one-time link after invited membership and safe audit commit", async () => {
    expect(await createTeamInvitationLink({ email: "New@Example.com", role: "auditor" })).toEqual({ ok: true, id: "new-user", inviteUrl: actionLink });
    expect(requireAdminPrincipal).toHaveBeenCalledWith(["owner"]);
    expect(generateLink).toHaveBeenCalledWith({ type: "invite", email: "new@example.com", options: { redirectTo: "https://delta.test/auth/invite" } });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ status: "invited", role: "auditor" }));
    expect(JSON.stringify(values.mock.calls)).not.toContain("one-time-credential");
  });

  it("denies a non-owner or AAL1 guard failure before creating credentials", async () => {
    jest.mocked(requireAdminPrincipal).mockRejectedValue(new AuthorizationError());
    expect((await createTeamInvitationLink({ email: "new@example.com", role: "auditor" })).ok).toBe(false);
    expect(generateLink).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("fails closed before credential creation while redirect readiness is disabled", async () => {
    delete process.env.DELTA_INVITE_REDIRECT_READY;
    expect((await createTeamInvitationLink({ email: "new@example.com", role: "auditor" })).ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("rejects any preexisting Auth identity without generating a link", async () => {
    execute.mockResolvedValue([{ id: "existing-user" }]);
    expect((await createTeamInvitationLink({ email: "new@example.com", role: "auditor" })).ok).toBe(false);
    expect(generateLink).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it.each([
    "https://evil.test/auth/v1/verify?token=secret&type=invite&redirect_to=https%3A%2F%2Fdelta.test%2Fauth%2Finvite",
    actionLink.replace("https%3A%2F%2Fdelta.test%2Fauth%2Finvite", "https%3A%2F%2Fevil.test"),
    actionLink.replace("type=invite", "type=recovery"),
  ])("rejects provider links outside the project and fixed invitation redirect", async (link) => {
    generateLink.mockResolvedValue({ data: { user: { id: "new-user" }, properties: { action_link: link } }, error: null });
    expect((await createTeamInvitationLink({ email: "new@example.com", role: "auditor" })).ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns no link and never deletes an identity after persistence failure", async () => {
    transaction.mockRejectedValue(new Error("offline"));
    const result = await createTeamInvitationLink({ email: "new@example.com", role: "auditor" });
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("inviteUrl");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("keeps provider email delivery disabled independently of link readiness", async () => {
    const previous = process.env.DELTA_INVITE_EMAIL_READY;
    delete process.env.DELTA_INVITE_EMAIL_READY;
    try {
      const result = await inviteTeamMember({ email: "new@example.com", role: "auditor" });
      expect(result.ok).toBe(false);
      expect(createSupabaseServiceClient).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.DELTA_INVITE_EMAIL_READY;
      else process.env.DELTA_INVITE_EMAIL_READY = previous;
    }
  });
});
