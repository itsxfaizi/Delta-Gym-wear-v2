import "server-only";

import { and, eq } from "drizzle-orm";

import { ADMIN_ROLES } from "@/features/admin/schemas";
import { getAuthenticatedUser } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { requireTenantRole, type AuthenticatedPrincipal, type TenantRole } from "@/server/authorization";
import { createDatabase } from "@/server/db";
import { memberships } from "@/server/db/schema";
import { getCatalogTenantId } from "@/server/env";
import { isMfaDisabledForIsolatedPreview } from "./preview-mfa";

export type AdminAccess =
  | { state: "unauthenticated" }
  | { state: "forbidden" }
  | { state: "mfa_required"; principal: AuthenticatedPrincipal }
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

  if (isMfaDisabledForIsolatedPreview()) return { state: "granted", principal };

  try {
    requireTenantRole(principal, ADMIN_ROLES);
  } catch {
    return { state: "forbidden" };
  }

  // The membership check alone must never make an admin session usable. Pass
  // the access token to Auth so AAL is validated remotely, not inferred from
  // an unverified client cookie. Any Auth error closes the gate.
  const supabase = await createSupabaseServerClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) return { state: "forbidden" };
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa
    .getAuthenticatorAssuranceLevel(sessionData.session.access_token);
  if (assuranceError || !assurance) return { state: "forbidden" };

  return assurance.currentLevel === "aal2"
    ? { state: "granted", principal }
    : { state: "mfa_required", principal };
}

/** Server-action entry point: throws AuthorizationError unless the role fits. */
export async function requireAdminPrincipal(
  allowedRoles: readonly TenantRole[],
): Promise<AuthenticatedPrincipal> {
  const access = await resolveAdminAccess();
  return requireTenantRole(access.state === "granted" ? access.principal : null, allowedRoles);
}
