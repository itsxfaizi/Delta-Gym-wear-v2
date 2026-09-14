import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/features/account/schemas";
import { createSupabaseServerClient } from "@/server/auth/supabase";

/**
 * Consumes the one-time code from a Supabase confirmation or recovery email and
 * exchanges it for a session cookie. Without this route those emails land on a
 * page that ignores the code, so signup confirmation and password reset dead-end.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("auth callback: code exchange failed", error);
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
