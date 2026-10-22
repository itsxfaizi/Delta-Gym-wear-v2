/** @jest-environment node */

jest.mock("server-only", () => ({}));
jest.mock("@/server/auth/session", () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock("@/server/auth/supabase", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));
jest.mock("@/server/env", () => ({ getCatalogTenantId: jest.fn() }));

import { getAuthenticatedUser } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { createDatabase } from "@/server/db";
import { getCatalogTenantId } from "@/server/env";
import { requireAdminPrincipal, resolveAdminAccess } from "./guard";

describe("staff MFA gate", () => {
  const getSession = jest.fn();
  const getAuthenticatorAssuranceLevel = jest.fn();
  const limit = jest.fn();
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = "postgres://example.invalid/test";
    jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: "staff-id" } as Awaited<ReturnType<typeof getAuthenticatedUser>>);
    jest.mocked(getCatalogTenantId).mockReturnValue("tenant-id");
    jest.mocked(createDatabase).mockReturnValue({
      select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
    } as unknown as ReturnType<typeof createDatabase>);
    limit.mockResolvedValue([{ role: "owner", status: "active" }]);
    jest.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getSession, mfa: { getAuthenticatorAssuranceLevel } },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    getSession.mockResolvedValue({ data: { session: { access_token: "valid-token" } }, error: null });
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
  });

  afterAll(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("blocks admin reads and writes for an active owner at AAL1", async () => {
    expect(await resolveAdminAccess()).toMatchObject({ state: "mfa_required" });
    await expect(requireAdminPrincipal(["owner"])).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getAuthenticatorAssuranceLevel).toHaveBeenCalledWith("valid-token");
  });

  it("grants an AAL2 session with active membership", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
    await expect(requireAdminPrincipal(["owner"])).resolves.toMatchObject({
      userId: "staff-id",
      membership: { role: "owner", status: "active" },
    });
  });

  it("fails closed when Supabase cannot verify assurance", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: new Error("Auth unavailable") });
    expect(await resolveAdminAccess()).toEqual({ state: "forbidden" });
    await expect(requireAdminPrincipal(["owner"])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not offer MFA enrollment to invited or suspended members", async () => {
    for (const status of ["invited", "suspended"]) {
      limit.mockResolvedValueOnce([{ role: "owner", status }]);
      expect(await resolveAdminAccess()).toEqual({ state: "forbidden" });
    }
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
