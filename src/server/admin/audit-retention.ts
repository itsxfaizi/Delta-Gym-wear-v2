import "server-only";

import { createSupabaseServiceClient } from "@/server/auth/supabase";

const AUDIT_RETENTION_YEARS = 1;

export type AuditRetentionResult = {
  eligible: number;
  deleted: number;
  dryRun: boolean;
};

/**
 * Uses the narrowly scoped database procedure. The database computes the
 * calendar-year cutoff and caps each run at 5,000 entries.
 */
export async function purgeExpiredAuditEvents(
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<AuditRetentionResult> {
  const { data, error } = await createSupabaseServiceClient()
    .rpc("purge_expired_audit_events", { p_dry_run: dryRun });

  if (error) throw new Error("Audit retention procedure failed", { cause: error });
  if (typeof data !== "number" || !Number.isInteger(data) || data < 0) {
    throw new Error("Audit retention procedure returned an invalid result");
  }

  return { eligible: data, deleted: dryRun ? 0 : data, dryRun };
}

export const AUDIT_RETENTION_POLICY_YEARS = AUDIT_RETENTION_YEARS;
