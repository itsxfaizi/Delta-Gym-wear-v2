import { z } from "zod";

import { ADMIN_ROLES } from "./schemas";

export const MEMBERSHIP_STATUSES = ["active", "suspended"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const addMemberSchema = z.object({
  authUserId: z.string().trim().uuid("Enter the member's Supabase auth user id (a UUID)."),
  role: z.enum(ADMIN_ROLES),
});

export const changeRoleSchema = z.object({
  authUserId: z.string().uuid(),
  role: z.enum(ADMIN_ROLES),
});

export const setStatusSchema = z.object({
  authUserId: z.string().uuid(),
  status: z.enum(MEMBERSHIP_STATUSES),
});

/** What the owner guard needs: a membership's identity, role and standing. */
export type Membership = {
  authUserId: string;
  role: (typeof ADMIN_ROLES)[number];
  status: string;
};

/** A membership as the team screen shows it, with the account's email resolved. */
export type MemberRow = Membership & {
  /** From auth.users; null if the account was deleted out from under the membership. */
  email: string | null;
};

export class LastOwnerError extends Error {
  public readonly code = "LAST_OWNER" as const;

  constructor(message = "The last active owner cannot be removed or demoted.") {
    super(message);
    this.name = "LastOwnerError";
  }
}

/**
 * True when `authUserId` is the tenant's only active owner. A store with zero
 * active owners can never regain admin access, so this is the one membership
 * change the console refuses no matter who asks.
 */
export function isLastActiveOwner(members: readonly Membership[], authUserId: string): boolean {
  const activeOwners = members.filter((member) => member.role === "owner" && member.status === "active");
  return activeOwners.length === 1 && activeOwners[0].authUserId === authUserId;
}
