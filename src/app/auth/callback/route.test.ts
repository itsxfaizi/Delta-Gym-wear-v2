/** @jest-environment node */

import type { NextRequest } from "next/server";

jest.mock("server-only", () => ({}));
jest.mock("@/server/auth/supabase", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("@/server/admin/team", () => ({ hasInvitedMembership: jest.fn() }));

import { hasInvitedMembership } from "@/server/admin/team";
import { createSupabaseServerClient } from "@/server/auth/supabase";

import { GET } from "./route";

function request(path: string): NextRequest {
  const url = new URL(path, "https://delta.example");
  return { url: url.toString(), nextUrl: url } as NextRequest;
}

describe("auth callback staff invitation", () => {
  const verifyOtp = jest.fn();
  const exchangeCodeForSession = jest.fn();
  const getUser = jest.fn();

  beforeEach(() => {
    jest.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { verifyOtp, exchangeCodeForSession, getUser },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    verifyOtp.mockResolvedValue({ error: null });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: "123e4567-e89b-42d3-a456-426614174000" } }, error: null });
  });

  it("requires a verified invite and sends staff to password setup without granting access", async () => {
    jest.mocked(hasInvitedMembership).mockResolvedValue(true);

    const response = await GET(request("/auth/callback?token_hash=one-time&type=invite&next=%2Freset-password%3Fnext%3D%2Fadmin"));

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "one-time", type: "invite" });
    expect(hasInvitedMembership).toHaveBeenCalledWith("123e4567-e89b-42d3-a456-426614174000");
    expect(response.headers.get("location")).toBe("https://delta.example/reset-password?next=/admin");
  });

  it("does not look up an invite for a normal code exchange", async () => {
    await GET(request("/auth/callback?code=recovery-code&type=invite&next=%2Freset-password"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("recovery-code");
    expect(hasInvitedMembership).not.toHaveBeenCalled();
  });

  it("does not continue to onboarding when no invited membership exists", async () => {
    jest.mocked(hasInvitedMembership).mockResolvedValue(false);

    const response = await GET(request("/auth/callback?token_hash=one-time&type=invite&next=%2Fadmin"));

    expect(response.headers.get("location")).toBe("https://delta.example/login?error=invite");
  });

  it("cannot use a valid invite token to skip password setup", async () => {
    jest.mocked(hasInvitedMembership).mockResolvedValue(true);

    const response = await GET(request("/auth/callback?token_hash=one-time&type=invite&next=%2Fadmin"));

    expect(response.headers.get("location")).toBe("https://delta.example/reset-password?next=/admin");
  });
});
