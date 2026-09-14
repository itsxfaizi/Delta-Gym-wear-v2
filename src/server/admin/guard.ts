import "server-only";

import { and, eq } from "drizzle-orm";

import { ADMIN_ROLES } from "@/features/admin/schemas";
import { getAuthenticatedUser } from "@/server/auth/session";
import { requireTenantRole, type AuthenticatedPrincipal, type TenantRole } from "@/server/authorization";
import { createDatabase } from "@/server/db";
import { memberships } from "@/server/db/schema";
import { getCatalogTenantId } from "@/server/env";

export type AdminAccess =
  | { state: "unauthenticated" }
  | { state: "forbidden" }
  | { state: "granted"; principal: AuthenticatedPrincipal };

/**
 * Fail-closed admin gate: a missing session redirects, and anything else — no
 * database, no tenant, no membership, a suspended membership, or a role outside
 * ADMIN_ROLES — is forbidden rather than silently allowed.
 */
export async function resolveAdminAccess(): Promise<AdminAccess> {
  const user = await getAuthenticatedUser();
  if (!user) return { state: "unauthenticated" };

  if (!process.env.DATABASE_URL) return { state: "forbidden" };

  let tenantId: string;
  try {
    tenantId = getCatalogTenantId();
  } catch {
    return { state: "forbidden" };
  }

  const [membership] = await createDatabase()
    .select({ role: memberships.role, status: memberships.status })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.authUserId, user.id)))
    .limit(1);

  if (!membership) return { state: "forbidden" };

  const principal: AuthenticatedPrincipal = { userId: user.id, tenantId, membership };

  try {
    return { state: "granted", principal: requireTenantRole(principal, ADMIN_ROLES) };
  } catch {
    return { state: "forbidden" };
  }
}

/** Server-action entry point: throws AuthorizationError unless the role fits. */
export async function requireAdminPrincipal(
  allowedRoles: readonly TenantRole[],
): Promise<AuthenticatedPrincipal> {
  const access = await resolveAdminAccess();
  return requireTenantRole(access.state === "granted" ? access.principal : null, allowedRoles);
}
