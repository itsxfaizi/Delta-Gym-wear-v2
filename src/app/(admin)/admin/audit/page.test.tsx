/** @jest-environment node */

jest.mock("@/server/admin/audit", () => ({ listOwnerAuditEvents: jest.fn() }));
jest.mock("@/server/admin/guard", () => ({ resolveAdminAccess: jest.fn() }));

import { renderToStaticMarkup } from "react-dom/server";
import { listOwnerAuditEvents } from "@/server/admin/audit";
import { resolveAdminAccess } from "@/server/admin/guard";
import AdminAuditPage from "./page";

describe("AdminAuditPage", () => {
  it("renders safe event fields in the existing admin table pattern", async () => {
    jest.mocked(resolveAdminAccess).mockResolvedValue({
      state: "granted",
      principal: { userId: "owner-1", tenantId: "tenant-a", membership: { role: "owner", status: "active" } },
    });
    jest.mocked(listOwnerAuditEvents).mockResolvedValue([
      {
        id: "event-1",
        actorUserId: "staff-1",
        action: "product.publish",
        targetType: "product",
        targetId: "product-1",
        requestId: "request-1",
        correlationId: "corr-1",
        outcome: "success",
        createdAt: new Date("2026-10-21T10:00:00.000Z"),
      },
    ]);

    const html = renderToStaticMarkup(await AdminAuditPage());
    expect(html).toContain("Audit log");
    expect(html).toContain("product.publish");
    expect(html).toContain("product-1");
    expect(html).toContain("staff-1");
    expect(html).toContain("request-1");
    expect(html).not.toContain("before");
    expect(html).not.toContain("after");
  });

  it("renders an explicit empty state", async () => {
    jest.mocked(resolveAdminAccess).mockResolvedValue({
      state: "granted",
      principal: { userId: "owner-1", tenantId: "tenant-a", membership: { role: "owner", status: "active" } },
    });
    jest.mocked(listOwnerAuditEvents).mockResolvedValue([]);
    const html = renderToStaticMarkup(await AdminAuditPage());
    expect(html).toContain("No audit events recorded yet.");
  });

  it("renders owner denial without querying audit events", async () => {
    jest.mocked(resolveAdminAccess).mockResolvedValue({
      state: "granted",
      principal: {
        userId: "editor-1",
        tenantId: "tenant-a",
        membership: { role: "catalog_editor", status: "active" },
      },
    });
    const html = renderToStaticMarkup(await AdminAuditPage());
    expect(html).toContain("Owner access required");
    expect(listOwnerAuditEvents).not.toHaveBeenCalled();
  });
});
