/** @jest-environment node */

jest.mock("server-only", () => ({}));
jest.mock("@/server/admin/audit-retention", () => ({ purgeExpiredAuditEvents: jest.fn() }));

import { purgeExpiredAuditEvents } from "@/server/admin/audit-retention";
import { GET } from "./route";

const secret = "a-long-random-test-secret";

describe("audit retention cron route", () => {
  const previousSecret = process.env.CRON_SECRET;
  afterEach(() => {
    jest.clearAllMocks();
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });

  it("rejects calls without a configured secret", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("https://example.com/api/cron/audit-retention"));
    expect(response.status).toBe(401);
    expect(purgeExpiredAuditEvents).not.toHaveBeenCalled();
  });

  it("rejects an incorrect bearer token", async () => {
    process.env.CRON_SECRET = secret;
    const response = await GET(new Request("https://example.com/api/cron/audit-retention", {
      headers: { authorization: "Bearer wrong-secret" },
    }));
    expect(response.status).toBe(401);
    expect(purgeExpiredAuditEvents).not.toHaveBeenCalled();
  });

  it("runs a dry-run request without deletion", async () => {
    process.env.CRON_SECRET = secret;
    jest.mocked(purgeExpiredAuditEvents).mockResolvedValue({ eligible: 2, deleted: 0, dryRun: true });
    const response = await GET(new Request("https://example.com/api/cron/audit-retention?dryRun=1", {
      headers: { authorization: `Bearer ${secret}` },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ eligible: 2, deleted: 0, dryRun: true });
    expect(purgeExpiredAuditEvents).toHaveBeenCalledWith({ dryRun: true });
  });

  it("returns a no-store service error when the retention procedure fails", async () => {
    process.env.CRON_SECRET = secret;
    jest.mocked(purgeExpiredAuditEvents).mockRejectedValue(new Error("database unavailable"));
    const response = await GET(new Request("https://example.com/api/cron/audit-retention", {
      headers: { authorization: `Bearer ${secret}` },
    }));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
