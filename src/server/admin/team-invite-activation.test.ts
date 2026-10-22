jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));
jest.mock("@/server/env", () => ({ getServerEnv: () => ({ DELTA_TENANT_ID: "123e4567-e89b-42d3-a456-426614174001" }) }));

import { createDatabase } from "@/server/db";
import { PgDialect } from "drizzle-orm/pg-core";

import { activateInvitedMembership, hasInvitedMembership } from "./team";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("invited membership transition", () => {
  it("checks an invited membership without changing its status", async () => {
    const limit = jest.fn().mockResolvedValue([{ authUserId: USER_ID }]);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    jest.mocked(createDatabase).mockReturnValue({ select } as never);

    expect(await hasInvitedMembership(USER_ID)).toBe(true);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("records acceptance only when the conditional invited-to-active update succeeds", async () => {
    const returning = jest.fn().mockResolvedValue([{ authUserId: USER_ID }]);
    const where = jest.fn().mockReturnValue({ returning });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({ values });
    jest.mocked(createDatabase).mockReturnValue({ transaction: async (operation: (tx: unknown) => unknown) => operation({ update, insert }) } as never);

    expect(await activateInvitedMembership(USER_ID)).toBe(true);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: USER_ID,
      action: "team.invite_accepted",
      before: { authUserId: USER_ID, status: "invited" },
      after: { authUserId: USER_ID, status: "active" },
    }));
  });

  it("does not activate or audit a cancelled, already active, or missing invitation", async () => {
    const returning = jest.fn().mockResolvedValue([]);
    const where = jest.fn().mockReturnValue({ returning });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const insert = jest.fn();
    jest.mocked(createDatabase).mockReturnValue({ transaction: async (operation: (tx: unknown) => unknown) => operation({ update, insert }) } as never);

    expect(await activateInvitedMembership(USER_ID)).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    // The mutation itself must condition on invited; a previously verified
    // session cannot reactivate a row that an owner has since suspended.
    const predicate = where.mock.calls[0][0];
    expect(new PgDialect().sqlToQuery(predicate).params).toContain("invited");
  });
});
