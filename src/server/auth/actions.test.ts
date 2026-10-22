jest.mock("server-only", () => ({}));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));
jest.mock("./supabase", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("./throttle", () => ({ allowPublicAuthAttempt: jest.fn() }));
jest.mock("@/server/admin/team", () => ({ activateInvitedMembership: jest.fn() }));

import { createSupabaseServerClient } from "./supabase";
import { allowPublicAuthAttempt } from "./throttle";
import { activateInvitedMembership } from "@/server/admin/team";
import { requestPasswordReset, signIn, updatePassword } from "./actions";

describe("auth actions throttling", () => {
  const signInWithPassword = jest.fn();
  const resetPasswordForEmail = jest.fn();
  const getUser = jest.fn();
  const updateUser = jest.fn();

  beforeEach(() => {
    jest.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { signInWithPassword, resetPasswordForEmail, getUser, updateUser },
    } as never);
    jest.mocked(allowPublicAuthAttempt).mockResolvedValue(true);
    signInWithPassword.mockResolvedValue({ error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: "123e4567-e89b-42d3-a456-426614174000" } }, error: null });
    updateUser.mockResolvedValue({ error: null });
    jest.mocked(activateInvitedMembership).mockResolvedValue(false);
  });

  it("rejects throttled sign-in without calling Supabase", async () => {
    jest.mocked(allowPublicAuthAttempt).mockResolvedValue(false);
    const result = await signIn({ email: "staff@example.com", password: "password123" });
    expect(result).toEqual({ ok: false, message: "Too many sign-in attempts. Please wait a few minutes and try again." });
    expect(allowPublicAuthAttempt).toHaveBeenCalledWith("sign-in", "staff@example.com");
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("keeps the password reset response generic when throttled", async () => {
    jest.mocked(allowPublicAuthAttempt).mockResolvedValue(false);
    const result = await requestPasswordReset({ email: "staff@example.com" });
    expect(result).toEqual({ ok: true });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("passes an allowed sign-in to Supabase", async () => {
    expect(await signIn({ email: "staff@example.com", password: "password123" })).toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "staff@example.com", password: "password123" });
  });

  it("activates an invite only after Supabase updates the verified user's password", async () => {
    jest.mocked(activateInvitedMembership).mockResolvedValue(true);
    const result = await updatePassword({ password: "securePassword123", confirmPassword: "securePassword123" });
    expect(result).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({ password: "securePassword123" });
    expect(activateInvitedMembership).toHaveBeenCalledWith("123e4567-e89b-42d3-a456-426614174000");
    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(activateInvitedMembership).mock.invocationCallOrder[0]);
  });

  it("does not activate when the session cannot be verified", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    const result = await updatePassword({ password: "securePassword123", confirmPassword: "securePassword123" });
    expect(result.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
    expect(activateInvitedMembership).not.toHaveBeenCalled();
  });

  it("does not activate when Supabase rejects the password change", async () => {
    updateUser.mockResolvedValue({ error: new Error("expired") });
    const result = await updatePassword({ password: "securePassword123", confirmPassword: "securePassword123" });
    expect(result.ok).toBe(false);
    expect(activateInvitedMembership).not.toHaveBeenCalled();
  });

  it("reports a retryable failure when password changed but membership activation fails", async () => {
    jest.mocked(activateInvitedMembership).mockRejectedValue(new Error("database down"));
    const result = await updatePassword({ password: "securePassword123", confirmPassword: "securePassword123" });
    expect(result).toEqual({ ok: false, message: "Your password changed, but team access could not be activated. Please try again." });
  });
});
