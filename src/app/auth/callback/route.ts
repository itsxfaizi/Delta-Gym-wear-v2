import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/features/account/schemas";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { activateInvitedMembership } from "@/server/admin/team";

/**
 * Consumes the one-time code from a Supabase confirmation or recovery email and
 * exchanges it for a session cookie. Without this route those emails land on a
 * page that ignores the code, so signup confirmation and password reset dead-end.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const isInvite = request.nextUrl.searchParams.get("type") === "invite";
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!code && !(tokenHash && isInvite)) {
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = tokenHash && isInvite
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" })
    : await supabase.auth.exchangeCodeForSession(code!);

  if (error) {
    console.error("auth callback: code exchange failed", error);
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  if (isInvite && tokenHash) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.redirect(new URL("/login?error=link", request.url));
    }
    try {
      const activated = await activateInvitedMembership(user.id);
      if (!activated) {
        return NextResponse.redirect(new URL("/login?error=invite", request.url));
      }
    } catch (activationError) {
      console.error("auth callback: invite activation failed", activationError);
      return NextResponse.redirect(new URL("/login?error=invite", request.url));
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
