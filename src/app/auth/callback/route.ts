import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/features/account/schemas";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { hasInvitedMembership } from "@/server/admin/team";

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
      const invited = await hasInvitedMembership(user.id);
      if (!invited) {
        return NextResponse.redirect(new URL("/login?error=invite", request.url));
      }
    } catch (lookupError) {
      console.error("auth callback: invite lookup failed", lookupError);
      return NextResponse.redirect(new URL("/login?error=invite", request.url));
    }
    // Never follow an invite link directly into /admin. The verified session
    // may only complete onboarding by choosing a password first.
    return NextResponse.redirect(new URL("/reset-password?next=/admin", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
