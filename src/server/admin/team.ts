import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import {
  LastOwnerError,
  addMemberSchema,
  changeRoleSchema,
  isLastActiveOwner,
  setStatusSchema,
  type MemberRow,
} from "@/features/admin/team";
import type { ActionResult } from "@/features/admin/schemas";
import { AuthorizationError } from "@/server/authorization";
import { createDatabase } from "@/server/db";
import { auditEvents, memberships } from "@/server/db/schema";
import { requireAdminPrincipal } from "./guard";

/** Every team change is owner-only — there is no lesser role for managing roles. */
const OWNER_ONLY = ["owner"] as const;

export class MemberAlreadyExistsError extends Error {
  public readonly code = "MEMBER_ALREADY_EXISTS" as const;

  constructor() {
    super("That auth user id already has a membership on this store.");
    this.name = "MemberAlreadyExistsError";
  }
}

export class MemberNotFoundError extends Error {
  public readonly code = "MEMBER_NOT_FOUND" as const;

  constructor() {
    super("That member was not found.");
    this.name = "MemberNotFoundError";
  }
}

function toResult(error: unknown): ActionResult {
  if (error instanceof AuthorizationError) {
    return { ok: false, message: "You do not have permission to do that." };
  }
  if (
    error instanceof LastOwnerError ||
    error instanceof MemberAlreadyExistsError ||
    error instanceof MemberNotFoundError ||
    error instanceof ZodError
  ) {
    return { ok: false, message: error.message };
  }
  console.error("team action failed", error);
  return { ok: false, message: "That did not work. Please try again." };
}

/** Server Component read: the /admin/team page lists members directly. */
export async function listMembers(): Promise<MemberRow[]> {
  const actor = await requireAdminPrincipal(OWNER_ONLY);
  const db = createDatabase();
  // auth.users is Supabase's own table, outside the Drizzle schema, so the
  // email is joined by raw SQL. A member whose account was deleted still has a
  // membership row, hence the left join and the nullable email.
  const rows = await db
    .select({
      authUserId: memberships.authUserId,
      role: memberships.role,
      status: memberships.status,
      email: sql<string | null>`(select u.email from auth.users u where u.id = ${memberships.authUserId})`,
    })
    .from(memberships)
    .where(eq(memberships.tenantId, actor.tenantId))
    .orderBy(memberships.createdAt);
  return rows;
}

function revalidateTeam() {
  revalidatePath("/admin/team");
}

/**
 * There is no invite API available yet, so a new member is added by the auth
 * user id an owner already has (e.g. from the Supabase dashboard) — the UI
 * says this plainly rather than pretending to send an invite.
 */
export async function addTeamMember(rawInput: unknown): Promise<ActionResult> {
  try {
    const input = addMemberSchema.parse(rawInput);
    const actor = await requireAdminPrincipal(OWNER_ONLY);
    const db = createDatabase();

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ authUserId: memberships.authUserId })
        .from(memberships)
        .where(and(eq(memberships.tenantId, actor.tenantId), eq(memberships.authUserId, input.authUserId)))
        .limit(1);
      if (existing) throw new MemberAlreadyExistsError();

      await tx.insert(memberships).values({
        tenantId: actor.tenantId,
        authUserId: input.authUserId,
        role: input.role,
        status: "active",
      });

      await tx.insert(auditEvents).values({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "team.member_added",
        targetType: "membership",
        targetId: null,
        outcome: "success",
        before: null,
        after: { authUserId: input.authUserId, role: input.role },
      });
    });

    revalidateTeam();
    return { ok: true, id: input.authUserId };
  } catch (error) {
    return toResult(error);
  }
}

export async function changeMemberRole(rawInput: unknown): Promise<ActionResult> {
  try {
    const input = changeRoleSchema.parse(rawInput);
    const actor = await requireAdminPrincipal(OWNER_ONLY);
    const db = createDatabase();

    await db.transaction(async (tx) => {
      const members = await tx
        .select({ authUserId: memberships.authUserId, role: memberships.role, status: memberships.status })
        .from(memberships)
        .where(eq(memberships.tenantId, actor.tenantId))
        .for("update");

      const target = members.find((member) => member.authUserId === input.authUserId);
      if (!target) throw new MemberNotFoundError();

      // The last active owner may never be demoted — a store with no active
      // owner can never regain admin access to fix it.
      if (input.role !== "owner" && isLastActiveOwner(members, input.authUserId)) {
        throw new LastOwnerError("The last active owner cannot be demoted.");
      }

      await tx
        .update(memberships)
        .set({ role: input.role, updatedAt: new Date() })
        .where(and(eq(memberships.tenantId, actor.tenantId), eq(memberships.authUserId, input.authUserId)));

      await tx.insert(auditEvents).values({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "team.role_changed",
        targetType: "membership",
        targetId: null,
        outcome: "success",
        before: { authUserId: input.authUserId, role: target.role },
        after: { authUserId: input.authUserId, role: input.role },
      });
    });

    revalidateTeam();
    return { ok: true, id: input.authUserId };
  } catch (error) {
    return toResult(error);
  }
}

export async function setMemberStatus(rawInput: unknown): Promise<ActionResult> {
  try {
    const input = setStatusSchema.parse(rawInput);
    const actor = await requireAdminPrincipal(OWNER_ONLY);
    const db = createDatabase();

    await db.transaction(async (tx) => {
      const members = await tx
        .select({ authUserId: memberships.authUserId, role: memberships.role, status: memberships.status })
        .from(memberships)
        .where(eq(memberships.tenantId, actor.tenantId))
        .for("update");

      const target = members.find((member) => member.authUserId === input.authUserId);
      if (!target) throw new MemberNotFoundError();

      // The last active owner may never be suspended.
      if (input.status === "suspended" && isLastActiveOwner(members, input.authUserId)) {
        throw new LastOwnerError("The last active owner cannot be suspended.");
      }

      await tx
        .update(memberships)
        .set({ status: input.status, updatedAt: new Date() })
        .where(and(eq(memberships.tenantId, actor.tenantId), eq(memberships.authUserId, input.authUserId)));

      await tx.insert(auditEvents).values({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: input.status === "active" ? "team.reactivated" : "team.suspended",
        targetType: "membership",
        targetId: null,
        outcome: "success",
        before: { authUserId: input.authUserId, status: target.status },
        after: { authUserId: input.authUserId, status: input.status },
      });
    });

    revalidateTeam();
    return { ok: true, id: input.authUserId };
  } catch (error) {
    return toResult(error);
  }
}
