import { resolveTenantPrincipal } from "./principal";
import { getAuthenticatedUser } from "../auth/session";
import { createDatabase } from "../db";
import { getCatalogTenantId } from "../env";

// No database and no Supabase in `npm test`; the mock boundary is the session
// and the db handle, as in src/features/catalog/catalog-server-contracts.test.ts.
jest.mock("../auth/session", () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock("../db", () => ({ createDatabase: jest.fn() }));
jest.mock("../env", () => ({ getCatalogTenantId: jest.fn() }));

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

/** Collects the column names and bound values of a drizzle SQL fragment. */
function sqlAtoms(fragment: unknown, columns: string[] = [], values: string[] = []) {
  const chunks = (fragment as { queryChunks?: readonly unknown[] }).queryChunks;
  if (chunks) {
    for (const chunk of chunks) sqlAtoms(chunk, columns, values);
    return { columns, values };
  }
  const name = (fragment as { name?: unknown }).name;
  const value = (fragment as { value?: unknown }).value;
  if (typeof name === "string") columns.push(name);
  else if (typeof value === "string") values.push(value);
  return { columns, values };
}

function arrange(rows: readonly unknown[]) {
  const wheres: unknown[] = [];
  const builder = {
    from: () => builder,
    where(fragment: unknown) {
      wheres.push(fragment);
      return builder;
    },
    limit: () => builder,
    then(onFulfilled: (rows: readonly unknown[]) => unknown, onRejected: (reason: unknown) => unknown) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  };
  (createDatabase as jest.Mock).mockReturnValue({ select: () => builder });
  (getCatalogTenantId as jest.Mock).mockReturnValue(TENANT_ID);
  (getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: USER_ID });
  return { wheres };
}

describe("resolveTenantPrincipal", () => {
  it("reads the role from the memberships row, scoped to the configured tenant and the session user", async () => {
    const { wheres } = arrange([{ role: "publisher", status: "active" }]);

    await expect(resolveTenantPrincipal()).resolves.toEqual({
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "publisher",
      status: "active",
    });
    const { columns, values } = sqlAtoms(wheres[0]);
    expect(columns).toEqual(["tenant_id", "auth_user_id"]);
    expect(values).toEqual([TENANT_ID, USER_ID]);
  });

  it("returns null with no session, without querying the database", async () => {
    arrange([{ role: "owner", status: "active" }]);
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);

    await expect(resolveTenantPrincipal()).resolves.toBeNull();
    expect(createDatabase).not.toHaveBeenCalled();
  });

  it("returns null for a session with no membership in this tenant", async () => {
    arrange([]);

    await expect(resolveTenantPrincipal()).resolves.toBeNull();
  });

  it("returns null for a membership that is not active, whatever its role", async () => {
    arrange([{ role: "owner", status: "suspended" }]);

    await expect(resolveTenantPrincipal()).resolves.toBeNull();
  });

  it("treats a status that only looks active as inactive", async () => {
    // The database constrains the shape of this column, not the value set; a
    // trimmed-and-lowered comparison here would be a second, laxer rule.
    arrange([{ role: "owner", status: "Active" }]);

    await expect(resolveTenantPrincipal()).resolves.toBeNull();
  });

  it("fails closed when the membership query throws", async () => {
    arrange([]);
    (createDatabase as jest.Mock).mockImplementation(() => {
      throw new Error('relation "memberships" does not exist');
    });

    await expect(resolveTenantPrincipal()).resolves.toBeNull();
  });

  it("fails closed when the tenant is not configured", async () => {
    arrange([{ role: "owner", status: "active" }]);
    (getCatalogTenantId as jest.Mock).mockImplementation(() => {
      throw new Error("DELTA_TENANT_ID is required for database-backed catalog reads.");
    });

    await expect(resolveTenantPrincipal()).resolves.toBeNull();
  });
});
