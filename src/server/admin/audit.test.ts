/** @jest-environment node */

jest.mock("server-only", () => ({}));
jest.mock("@/server/admin/guard", () => ({ requireAdminPrincipal: jest.fn() }));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));
jest.mock("@/server/env", () => ({ getCatalogTenantId: jest.fn(() => "tenant-a") }));

import { requireAdminPrincipal } from "@/server/admin/guard";
import { createDatabase } from "@/server/db";
import { listOwnerAuditEvents } from "./audit";

describe("listOwnerAuditEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test";
  });

  afterAll(() => {
    delete process.env.DATABASE_URL;
  });

  it("requires owner authorization before reading, tenant-filters, sorts newest first, and caps at 100", async () => {
    const rows = [{ id: "event-1", action: "product.publish" }];
    const limit = jest.fn().mockResolvedValue(rows);
    const orderBy = jest.fn(() => ({ limit }));
    const where = jest.fn(() => ({ orderBy }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    jest.mocked(createDatabase).mockReturnValue({ select } as never);

    await expect(listOwnerAuditEvents()).resolves.toBe(rows);

    expect(requireAdminPrincipal).toHaveBeenCalledWith(["owner"]);
    expect(createDatabase).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(100);
  });

  it("does not open the database when authorization denies the caller", async () => {
    jest.mocked(requireAdminPrincipal).mockRejectedValueOnce(new Error("forbidden"));
    await expect(listOwnerAuditEvents()).rejects.toThrow("forbidden");
    expect(createDatabase).not.toHaveBeenCalled();
  });

  it("returns an empty list without database access when persistence is unavailable", async () => {
    delete process.env.DATABASE_URL;
    await expect(listOwnerAuditEvents()).resolves.toEqual([]);
    expect(requireAdminPrincipal).toHaveBeenCalledWith(["owner"]);
    expect(createDatabase).not.toHaveBeenCalled();
  });
});
