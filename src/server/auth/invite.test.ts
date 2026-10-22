jest.mock("server-only", () => ({}));
jest.mock("./supabase", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("@/server/admin/team", () => ({ hasInvitedMembership: jest.fn() }));

import { hasInvitedMembership } from "@/server/admin/team";
import { createSupabaseServerClient } from "./supabase";
import { validateStaffInvite } from "./invite";

describe("staff invite session validation", () => {
  const getUser = jest.fn();
  beforeEach(() => {
    jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser } } as never);
    getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
    jest.mocked(hasInvitedMembership).mockResolvedValue(true);
  });

  it("returns only the fixed password setup route after validating the principal", async () => {
    expect(await validateStaffInvite()).toEqual({ ok: true, next: "/reset-password?next=%2Fadmin" });
    expect(hasInvitedMembership).toHaveBeenCalledWith("verified-user");
  });

  it("denies an expired or fabricated session before membership lookup", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    expect(await validateStaffInvite()).toEqual({ ok: false });
    expect(hasInvitedMembership).not.toHaveBeenCalled();
  });

  it("denies a verified user without an invited membership on this tenant", async () => {
    jest.mocked(hasInvitedMembership).mockResolvedValue(false);
    expect(await validateStaffInvite()).toEqual({ ok: false });
  });

  it("fails closed on a membership database outage", async () => {
    jest.mocked(hasInvitedMembership).mockRejectedValue(new Error("offline"));
    expect(await validateStaffInvite()).toEqual({ ok: false });
  });
});
