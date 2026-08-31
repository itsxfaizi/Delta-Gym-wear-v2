import "server-only";

import type { Membership } from "../db/schema";

export const TENANT_ROLES = [
  "owner",
  "catalog_editor",
  "publisher",
  "auditor",
] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export type AuthenticatedPrincipal = {
  userId: string;
  tenantId: string;
  membership: Pick<Membership, "role" | "status">;
};

export class AuthorizationError extends Error {
  public readonly code = "FORBIDDEN" as const;

  constructor(message = "You are not authorized to perform this operation.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Authorization remains fail-closed until a membership has been loaded by a
 * server service. Client-side role visibility must never replace this check.
 */
export function requireTenantRole(
  principal: AuthenticatedPrincipal | null,
  allowedRoles: readonly TenantRole[],
): AuthenticatedPrincipal {
  if (!principal || principal.membership.status !== "active") {
    throw new AuthorizationError();
  }

  if (!allowedRoles.includes(principal.membership.role as TenantRole)) {
    throw new AuthorizationError();
  }

  return principal;
}
