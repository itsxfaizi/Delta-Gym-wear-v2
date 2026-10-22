/** @jest-environment node */

jest.mock("server-only", () => ({}));
jest.mock("@/server/admin/guard", () => ({ resolveAdminAccess: jest.fn() }));
jest.mock("@/server/auth/supabase", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("@/server/rate-limit", () => ({ consumeRateLimit: jest.fn() }));

import { resolveAdminAccess } from "@/server/admin/guard";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { consumeRateLimit } from "@/server/rate-limit";
import { beginMfaEnrollment, verifyMfaCode } from "./mfa-actions";

describe("staff MFA actions", () => {
  const listFactors = jest.fn();
  const enroll = jest.fn();
  const unenroll = jest.fn();
  const challengeAndVerify = jest.fn();
  const factorId = "123e4567-e89b-42d3-a456-426614174000";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(resolveAdminAccess).mockResolvedValue({
      state: "mfa_required",
      principal: { userId: "staff-id", tenantId: "tenant-id", membership: { role: "owner", status: "active" } },
    });
    jest.mocked(consumeRateLimit).mockReturnValue({ allowed: true, retryAfterMs: 0 });
    jest.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { mfa: { listFactors, enroll, unenroll, challengeAndVerify } },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null });
    enroll.mockResolvedValue({ data: { id: factorId, totp: { qr_code: "data:image/svg+xml;base64,abc", secret: "TOPSECRET" } }, error: null });
    challengeAndVerify.mockResolvedValue({ error: null });
  });

  it("refuses setup without an active staff membership", async () => {
    jest.mocked(resolveAdminAccess).mockResolvedValue({ state: "forbidden" });
    expect(await beginMfaEnrollment()).toMatchObject({ ok: false });
    expect(await verifyMfaCode({ factorId, code: "123456" })).toMatchObject({ ok: false });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("does not create a second factor when a verified TOTP factor exists", async () => {
    listFactors.mockResolvedValue({ data: { totp: [{ id: factorId }], all: [] }, error: null });
    expect(await beginMfaEnrollment()).toMatchObject({ ok: false });
    expect(enroll).not.toHaveBeenCalled();
  });

  it("clears an abandoned unverified factor and returns a fresh QR", async () => {
    listFactors.mockResolvedValue({ data: { totp: [], all: [{ id: "old", factor_type: "totp", status: "unverified" }] }, error: null });
    unenroll.mockResolvedValue({ error: null });
    expect(await beginMfaEnrollment()).toEqual({
      ok: true, factorId, qrCode: "data:image/svg+xml;base64,abc", secret: "TOPSECRET",
    });
    expect(unenroll).toHaveBeenCalledWith({ factorId: "old" });
  });

  it("rejects malformed codes and factor IDs not owned by the user", async () => {
    expect(await verifyMfaCode({ factorId, code: "12abc6" })).toMatchObject({ ok: false });
    listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null });
    expect(await verifyMfaCode({ factorId, code: "123456" })).toMatchObject({ ok: false });
    expect(challengeAndVerify).not.toHaveBeenCalled();
  });

  it("submits a valid code only for the current user's TOTP factor", async () => {
    listFactors.mockResolvedValue({ data: { totp: [{ id: factorId }], all: [{ id: factorId, factor_type: "totp", status: "verified" }] }, error: null });
    expect(await verifyMfaCode({ factorId, code: "123456" })).toEqual({ ok: true });
    expect(challengeAndVerify).toHaveBeenCalledWith({ factorId, code: "123456" });
  });

  it("rate limits code attempts before contacting Auth", async () => {
    jest.mocked(consumeRateLimit).mockReturnValue({ allowed: false, retryAfterMs: 1 });
    expect(await verifyMfaCode({ factorId, code: "123456" })).toMatchObject({ ok: false });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
