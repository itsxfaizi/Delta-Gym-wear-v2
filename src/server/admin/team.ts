import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import {
  LastOwnerError,
  changeRoleSchema,
  inviteMemberSchema,
  isLastActiveOwner,
  setStatusSchema,
  type MemberRow,
} from "@/features/admin/team";
import type { ActionResult } from "@/features/admin/schemas";
import { AuthorizationError } from "@/server/authorization";
import { createDatabase } from "@/server/db";
import { auditEvents, memberships } from "@/server/db/schema";
import { createSupabaseServiceClient } from "@/server/auth/supabase";
import { getServerEnv } from "@/server/env";
import { consumeRateLimit } from "@/server/rate-limit";
import { requireAdminPrincipal } from "./guard";

/** Every team change is owner-only — there is no lesser role for managing roles. */
const OWNER_ONLY = ["owner"] as const;

export class MemberAlreadyExistsError extends Error {
  public readonly code = "MEMBER_ALREADY_EXISTS" as const;

  constructor() {
    super("That email already has a team membership on this store.");
    this.name = "MemberAlreadyExistsError";
  }
}

export class InviteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteError";
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
    error instanceof InviteError ||
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
 * Send an Auth invite only after owner authorization and validation. The
 * membership begins as invited; only a verified password update activates it.
 * Auth email delivery and the database cannot share a transaction; an unbound
 * Auth identity receives no staff access if persistence fails.
 */
export async function inviteTeamMember(rawInput: unknown): Promise<ActionResult> {
  try {
    const input = inviteMemberSchema.parse(rawInput);
    const actor = await requireAdminPrincipal(OWNER_ONLY);
    const tokenHashReady = process.env.DELTA_INVITE_TEMPLATE_TOKEN_HASH_READY === "true";
    if (!tokenHashReady && process.env.DELTA_INVITE_REDIRECT_READY !== "true") {
      throw new InviteError("Staff invitations are not configured yet. Ask an operator to verify the Supabase invite redirect.");
    }
    if (process.env.DELTA_INVITE_EMAIL_READY !== "true") {
      throw new InviteError("Invitation email delivery is not configured. Create an invitation link to share with this staff member.");
    }
    // This process-local cap is defense in depth. Supabase Auth's project-wide
    // email limits or an edge/shared limiter must also be configured for release.
    if (!consumeRateLimit(`team-invite:${actor.tenantId}:${actor.userId}`, 10, 60 * 60_000).allowed) {
      throw new InviteError("Too many invitations have been requested. Try again later.");
    }
    const db = createDatabase();
    const [existing] = await db
      .select({ authUserId: memberships.authUserId })
      .from(memberships)
      .where(and(
        eq(memberships.tenantId, actor.tenantId),
        sql`lower((select u.email from auth.users u where u.id = ${memberships.authUserId})) = ${input.email}`,
      ))
      .limit(1);
    if (existing) throw new MemberAlreadyExistsError();

    const supabase = createSupabaseServiceClient();
    const passwordPath = `/reset-password?next=${encodeURIComponent("/admin")}`;
    const redirectTo = new URL(
      tokenHashReady ? `/auth/callback?next=${encodeURIComponent(passwordPath)}` : "/auth/invite",
      getServerEnv().APP_URL,
    ).toString();
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(input.email, { redirectTo });
    if (error || !data.user?.id) {
      if (error) console.error("team invite delivery failed", error);
      throw new InviteError(
        error?.code === "email_exists" || error?.message?.toLowerCase().includes("already registered")
          ? "That email already has a Supabase account. Contact support to link an existing account."
          : "The invitation could not be sent. Check the email configuration and try again.",
      );
    }
    const authUserId = data.user.id;

    try {
      await db.transaction(async (tx) => {
        await tx.insert(memberships).values({
          tenantId: actor.tenantId,
          authUserId,
          role: input.role,
          status: "invited",
        });

        await tx.insert(auditEvents).values({
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "team.invited",
          targetType: "membership",
          targetId: authUserId,
          requestId: crypto.randomUUID(),
          outcome: "success",
          before: null,
          after: { authUserId, role: input.role, status: "invited" },
        });
      });
    } catch {
      // Do not delete an identity whose provenance cannot be guaranteed across
      // Auth/database races. Without membership the emailed link grants no admin access.
      throw new InviteError("An invite email was sent, but team access could not be saved. Contact support before retrying.");
    }

    revalidateTeam();
    return { ok: true, id: authUserId };
  } catch (error) {
    return toResult(error);
  }
}

export type TeamInvitationResult =
  | { ok: true; id: string; inviteUrl: string }
  | { ok: false; message: string };

/** Creates a one-time invitation for the owner to deliver; no email transport is used. */
export async function createTeamInvitationLink(rawInput: unknown): Promise<TeamInvitationResult> {
  try {
    const input = inviteMemberSchema.parse(rawInput);
    const actor = await requireAdminPrincipal(OWNER_ONLY);
    if (process.env.DELTA_INVITE_REDIRECT_READY !== "true") {
      throw new InviteError("Staff invitations are not configured yet. Ask an operator to verify the Supabase invite redirect.");
    }
    if (!consumeRateLimit(`team-invite:${actor.tenantId}:${actor.userId}`, 10, 60 * 60_000).allowed) {
      throw new InviteError("Too many invitations have been requested. Try again later.");
    }
    const db = createDatabase();
    // Reject identities anywhere in Auth, including users belonging to another
    // tenant. Generating a link must not link an existing identity by email.
    const existing = await db.execute(sql`select id from auth.users where lower(email) = ${input.email} limit 1`);
    if (existing.length > 0) {
      throw new InviteError("That email already has an account. Contact support before creating another invitation.");
    }
    const env = getServerEnv();
    const redirectTo = new URL("/auth/invite", env.APP_URL).toString();
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "invite", email: input.email, options: { redirectTo },
    });
    if (error || !data.user?.id || data.user.email_confirmed_at || !data.properties?.action_link) {
      // Never log this provider response: it contains the invitation credential.
      throw new InviteError("The invitation link could not be created. Check the account and try again.");
    }
    const inviteUrl = new URL(data.properties.action_link);
    const project = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    if (inviteUrl.origin !== project.origin || inviteUrl.pathname !== "/auth/v1/verify" ||
        inviteUrl.username || inviteUrl.password || inviteUrl.hash ||
        inviteUrl.searchParams.get("type") !== "invite" ||
        inviteUrl.searchParams.get("redirect_to") !== redirectTo ||
        !inviteUrl.searchParams.get("token")) {
      throw new InviteError("The invitation redirect is not configured correctly. Ask an operator to check it.");
    }
    const authUserId = data.user.id;
    try {
      await db.transaction(async (tx) => {
        await tx.insert(memberships).values({ tenantId: actor.tenantId, authUserId, role: input.role, status: "invited" });
        await tx.insert(auditEvents).values({
          tenantId: actor.tenantId, actorUserId: actor.userId,
          action: "team.invited", targetType: "membership", targetId: authUserId,
          requestId: crypto.randomUUID(), outcome: "success", before: null,
          after: { authUserId, role: input.role, status: "invited", delivery: "owner-shared-link" },
        });
      });
    } catch {
      // Auth and Postgres cannot share a transaction. Never delete an Auth user:
      // an external account creation could race the preflight existence check.
      // The unbound identity has no admin membership and no link is returned.
      throw new InviteError("The invitation could not be saved. No team access was granted. Contact support before retrying.");
    }
    revalidateTeam();
    return { ok: true, id: authUserId, inviteUrl: inviteUrl.toString() };
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof InviteError || error instanceof ZodError) {
      return { ok: false, message: error instanceof AuthorizationError ? "You do not have permission to do that." : error.message };
    }
    // Avoid serializing unexpected SDK/URL errors that may embed credentials.
    return { ok: false, message: "The invitation could not be created. Please try again." };
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
        targetId: input.authUserId,
        requestId: crypto.randomUUID(),
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

      if (target.status === "invited" && input.status === "active") {
        throw new InviteError("This invitation must be accepted before access can be activated.");
      }
      if (target.status === "cancelled") {
        throw new InviteError("This invitation was cancelled and cannot be reactivated. Contact support for a new invitation.");
      }
      const nextStatus = target.status === "invited" ? "cancelled" : input.status;

      // The last active owner may never be suspended.
      if (input.status === "suspended" && isLastActiveOwner(members, input.authUserId)) {
        throw new LastOwnerError("The last active owner cannot be suspended.");
      }

      await tx
        .update(memberships)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(and(eq(memberships.tenantId, actor.tenantId), eq(memberships.authUserId, input.authUserId)));

      await tx.insert(auditEvents).values({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: nextStatus === "cancelled" ? "team.invite_cancelled" : input.status === "active" ? "team.reactivated" : "team.suspended",
        targetType: "membership",
        targetId: input.authUserId,
        requestId: crypto.randomUUID(),
        outcome: "success",
        before: { authUserId: input.authUserId, status: target.status },
        after: { authUserId: input.authUserId, status: nextStatus },
      });
    });

    revalidateTeam();
    return { ok: true, id: input.authUserId };
  } catch (error) {
    return toResult(error);
  }
}

/** Confirm the invite belongs to this store without granting access yet. */
export async function hasInvitedMembership(authUserId: string): Promise<boolean> {
  const tenantId = getServerEnv().DELTA_TENANT_ID;
  if (!tenantId) return false;

  const [invited] = await createDatabase()
    .select({ authUserId: memberships.authUserId })
    .from(memberships)
    .where(and(
      eq(memberships.tenantId, tenantId),
      eq(memberships.authUserId, authUserId),
      eq(memberships.status, "invited"),
    ))
    .limit(1);
  return Boolean(invited);
}

/** Called only after Supabase has successfully changed the invited user's password. */
export async function activateInvitedMembership(authUserId: string): Promise<boolean> {
  const tenantId = getServerEnv().DELTA_TENANT_ID;
  if (!tenantId) return false;

  return createDatabase().transaction(async (tx) => {
    const [activated] = await tx
      .update(memberships)
      .set({ status: "active", updatedAt: new Date() })
      .where(and(
        eq(memberships.tenantId, tenantId),
        eq(memberships.authUserId, authUserId),
        eq(memberships.status, "invited"),
      ))
      .returning({ authUserId: memberships.authUserId });
    if (!activated) return false;

    await tx.insert(auditEvents).values({
      tenantId,
      actorUserId: authUserId,
      action: "team.invite_accepted",
      targetType: "membership",
      targetId: authUserId,
      requestId: crypto.randomUUID(),
      outcome: "success",
      before: { authUserId, status: "invited" },
      after: { authUserId, status: "active" },
    });
    return true;
  });
}
