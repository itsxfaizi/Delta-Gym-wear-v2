"use client";

import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { validateStaffInvite } from "@/server/auth/invite";

/** Default Supabase invite emails return credentials in a fragment, never a server query. */
export function InviteLanding() {
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    // Remove credentials and untrusted query parameters before asynchronous work.
    window.history.replaceState(window.history.state, "", window.location.pathname);

    async function acceptInvite() {
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      if (fragment.get("type") !== "invite" || !accessToken || !refreshToken) {
        setFailed(true);
        return;
      }
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { isSingleton: false, auth: { detectSessionInUrl: false } },
      );
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) { setFailed(true); return; }
      // @supabase/ssr persists the session in cookies before the server verifies it.
      const result = await validateStaffInvite();
      if (!result.ok) {
        await supabase.auth.signOut({ scope: "local" });
        setFailed(true);
        return;
      }
      window.location.replace(result.next);
    }

    void acceptInvite().catch(() => setFailed(true));
  }, []);

  return (
    <>
      <h1>{failed ? "Invitation unavailable" : "Accepting your invitation"}</h1>
      <p className="auth-intro" role={failed ? "alert" : "status"}>
        {failed ? "This invitation is invalid, expired, or no longer grants access. Ask the store owner for help." : "Verifying your invitation before you choose a password…"}
      </p>
      {failed ? <Link href="/login">Return to sign in</Link> : null}
    </>
  );
}
