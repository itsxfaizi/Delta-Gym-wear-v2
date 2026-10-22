jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("./guard", () => ({ requireAdminPrincipal: jest.fn() }));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));

import { AuthorizationError } from "@/server/authorization";
import { createDatabase } from "@/server/db";
import { requireAdminPrincipal } from "./guard";
import { setMemberStatus } from "./team";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("pending invitation cancellation", () => {
  const set = jest.fn();
  const update = jest.fn();
  const values = jest.fn();
  let membershipStatus: string;
  beforeEach(() => {
    membershipStatus = "invited";
    jest.mocked(requireAdminPrincipal).mockResolvedValue({ userId: "owner", tenantId: "tenant", membership: { role: "owner", status: "active" } });
    set.mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    update.mockReturnValue({ set });
    values.mockResolvedValue(undefined);
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ for: async () => [{ authUserId: USER_ID, role: "auditor", status: membershipStatus }] }) }) }),
      update, insert: () => ({ values }),
    };
    jest.mocked(createDatabase).mockReturnValue({ transaction: async (run: (value: unknown) => unknown) => run(tx) } as never);
  });

  it("lets an authorized owner permanently cancel a pending invitation with a safe audit event", async () => {
    expect(await setMemberStatus({ authUserId: USER_ID, status: "suspended" })).toEqual({ ok: true, id: USER_ID });
    expect(requireAdminPrincipal).toHaveBeenCalledWith(["owner"]);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      action: "team.invite_cancelled", before: { authUserId: USER_ID, status: "invited" },
      after: { authUserId: USER_ID, status: "cancelled" },
    }));
  });

  it.each(["active", "suspended"])("never changes a cancelled invitation to %s", async (status) => {
    membershipStatus = "cancelled";
    expect((await setMemberStatus({ authUserId: USER_ID, status })).ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });

  it("never activates a pending invitation through the owner status action", async () => {
    expect((await setMemberStatus({ authUserId: USER_ID, status: "active" })).ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });

  it("rejects cancellation when owner or AAL2 authorization fails", async () => {
    jest.mocked(requireAdminPrincipal).mockRejectedValue(new AuthorizationError());
    expect((await setMemberStatus({ authUserId: USER_ID, status: "suspended" })).ok).toBe(false);
    expect(createDatabase).not.toHaveBeenCalled();
  });
});
