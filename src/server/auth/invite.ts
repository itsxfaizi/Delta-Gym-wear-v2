"use server";

import { hasInvitedMembership } from "@/server/admin/team";
import { createSupabaseServerClient } from "./supabase";

type InviteResult = { ok: true; next: "/reset-password?next=%2Fadmin" } | { ok: false };

/** Browser-supplied tokens, IDs, emails and redirect parameters cannot authorize an invite. */
export async function validateStaffInvite(): Promise<InviteResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user || !await hasInvitedMembership(user.id)) return { ok: false };
    return { ok: true, next: "/reset-password?next=%2Fadmin" };
  } catch {
    // Do not log auth errors here: provider errors may contain sensitive link details.
    return { ok: false };
  }
}
