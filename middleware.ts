import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth cookie on every navigation. Server Components
 * cannot write cookies, so without this the session silently expires and
 * `getAuthenticatedUser()` starts returning null mid-session.
 */
export async function middleware(request: NextRequest) {
  // Read directly rather than via src/server/env.ts: a throw here would take down
  // every route, and these are browser-public presence checks only.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase configured there is no session to refresh (local/CI builds).
  if (!url || !anonKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not add logic between the client creation and getUser(): it is this call
  // that performs the refresh and triggers the setAll cookie write above.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Every path except static assets, image optimizer output, the favicon and
     * the health probe, none of which carry a session worth refreshing.
     */
    "/((?!_next/static|_next/image|api/health|favicon.ico|design-reference|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|mp4|webm|woff2?)$).*)",
  ],
};
