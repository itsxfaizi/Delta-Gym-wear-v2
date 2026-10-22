/** @jest-environment node */

jest.mock("server-only", () => ({}));
jest.mock("@/server/admin/guard", () => ({ requireAdminPrincipal: jest.fn() }));
jest.mock("@/server/db", () => ({ createDatabase: jest.fn() }));
jest.mock("@/server/orders/queries", () => ({ listOrders: jest.fn() }));

import { requireAdminPrincipal } from "@/server/admin/guard";
import { createDatabase } from "@/server/db";
import { listOrders } from "@/server/orders/queries";
import { getCustomerRecord, listCustomerRecords } from "./customers";
import { getAdminDashboard, getAdminProductForm, listAdminProducts } from "./queries";

describe("admin read authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requireAdminPrincipal).mockRejectedValue(new Error("MFA required"));
  });

  it("rejects protected reads before opening the database or loading orders", async () => {
    await expect(listAdminProducts({ q: "", status: null, page: 1 })).rejects.toThrow("MFA required");
    await expect(getAdminProductForm("product-id")).rejects.toThrow("MFA required");
    await expect(getAdminDashboard()).rejects.toThrow("MFA required");
    await expect(listCustomerRecords()).rejects.toThrow("MFA required");
    await expect(getCustomerRecord("customer-id")).rejects.toThrow("MFA required");
    expect(requireAdminPrincipal).toHaveBeenCalledTimes(5);
    expect(createDatabase).not.toHaveBeenCalled();
    expect(listOrders).not.toHaveBeenCalled();
  });
});
