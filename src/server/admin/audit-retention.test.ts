/** @jest-environment node */

jest.mock("server-only", () => ({}));
jest.mock("@/server/auth/supabase", () => ({ createSupabaseServiceClient: jest.fn() }));

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseServiceClient } from "@/server/auth/supabase";
import { purgeExpiredAuditEvents } from "./audit-retention";

describe("purgeExpiredAuditEvents", () => {
  const rpc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createSupabaseServiceClient).mockReturnValue({ rpc } as never);
  });

  it("reports eligible records in dry-run mode without claiming any were deleted", async () => {
    rpc.mockResolvedValue({ data: 3, error: null });
    await expect(purgeExpiredAuditEvents({ dryRun: true })).resolves.toEqual({
      eligible: 3,
      deleted: 0,
      dryRun: true,
    });
    expect(rpc).toHaveBeenCalledWith("purge_expired_audit_events", { p_dry_run: true });
  });

  it("reports deletion count from the privileged procedure", async () => {
    rpc.mockResolvedValue({ data: 2, error: null });
    await expect(purgeExpiredAuditEvents()).resolves.toEqual({ eligible: 2, deleted: 2, dryRun: false });
    expect(rpc).toHaveBeenCalledWith("purge_expired_audit_events", { p_dry_run: false });
  });

  it("fails closed on database errors or malformed procedure results", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("denied") });
    await expect(purgeExpiredAuditEvents()).rejects.toThrow("Audit retention procedure failed");
    rpc.mockResolvedValueOnce({ data: "2", error: null });
    await expect(purgeExpiredAuditEvents()).rejects.toThrow("invalid result");
  });

  it("keeps the bypass narrower than the immutable audit and revision tables", () => {
    const migration = readFileSync(resolve(process.cwd(), "db/migrations/0007_audit_retention.sql"), "utf8");
    expect(migration).toMatch(/created_at\s*<\s*pg_catalog\.transaction_timestamp\(\)\s*-\s*interval '1 year'/i);
    expect(migration).toMatch(/LIMIT 5000/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.purge_expired_audit_events\(boolean\) TO service_role/i);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.purge_expired_audit_events\(boolean\) FROM PUBLIC, anon, authenticated/i);
    expect(migration).toMatch(/DELETE FROM public\.audit_events/i);
    expect(migration).not.toMatch(/DELETE FROM public\.product_revisions/i);
    expect(migration).toMatch(/product_revisions_immutable[\s\S]*?public\.prevent_immutable_record_mutation\(\)/i);
  });
});
