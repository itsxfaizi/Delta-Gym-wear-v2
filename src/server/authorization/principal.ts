import "server-only";

import { and, eq } from "drizzle-orm";

import type { TenantRole } from ".";
import { getAuthenticatedUser } from "../auth/session";
import { createDatabase } from "../db";
import { memberships } from "../db/schema";
import { getCatalogTenantId } from "../env";

/** Contract A. A principal is only ever resolved for an active membership. */
export type TenantPrincipal = {
  userId: string;
  tenantId: string;
  role: TenantRole;
  status: "active";
};

/**
 * The only way to obtain a principal. Fail-closed: no session, no membership,
 * a membership that is not active, or any error along the way all yield `null`
 * and never a partial principal.
 *
 * The role is read from the `memberships` table on every call. It is never read
 * from a cookie, header or JWT claim, because those are shapeable by the client
 * and `getAuthenticatedUser` is the only part of the session we trust (it calls
 * Supabase `getUser`, a server-side check, not `getSession`).
 *
 * The tenant comes from server configuration - the same id the public catalog
 * reads - because this deployment serves one tenant and contract C forbids
 * accepting a tenant id from client input. This function therefore takes no
 * arguments by design: there is nothing a caller could pass that would widen it.
 */
export async function resolveTenantPrincipal(): Promise<TenantPrincipal | null> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return null;

    const tenantId = getCatalogTenantId();
    const [membership] = await createDatabase()
      .select({ role: memberships.role, status: memberships.status })
      .from(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.authUserId, user.id)))
      .limit(1);

    // `status` is free text constrained only in shape, so the comparison is
    // made here rather than in SQL: a suspended member must read as no member.
    if (!membership || membership.status !== "active") return null;

    // `membership.role` is the `membership_role` enum from the database. If that
    // enum ever gains a value the schema type widens and this assignment stops
    // compiling, which is the intended way to notice the drift.
    return { userId: user.id, tenantId, role: membership.role, status: "active" };
  } catch {
    // Fail closed. A resolution failure must never read as "no membership was
    // required"; every caller treats `null` as denied.
    return null;
  }
}
