"use server";

import {
  addTeamMember,
  changeMemberRole as changeMemberRoleOnServer,
  setMemberStatus as setMemberStatusOnServer,
} from "@/server/admin/team";

import type { ActionResult } from "./schemas";

/**
 * Server-action surface for the team screen. The real authorization, validation
 * and last-owner rule live in src/server/admin/team.ts — these only cross the
 * client boundary, so a browser can never reach the server-only module directly.
 */
export async function addMemberAction(rawInput: unknown): Promise<ActionResult> {
  return addTeamMember(rawInput);
}

export async function changeMemberRoleAction(rawInput: unknown): Promise<ActionResult> {
  return changeMemberRoleOnServer(rawInput);
}

export async function setMemberStatusAction(rawInput: unknown): Promise<ActionResult> {
  return setMemberStatusOnServer(rawInput);
}
