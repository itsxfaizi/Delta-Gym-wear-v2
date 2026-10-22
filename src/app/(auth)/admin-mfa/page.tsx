import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MfaForm } from "@/components/admin/mfa-form";
import { loginRedirectPath } from "@/features/account/schemas";
import { resolveAdminAccess } from "@/server/admin/guard";
import { createSupabaseServerClient } from "@/server/auth/supabase";

import "../../../styles/admin-mfa.css";

export const metadata: Metadata = {
  title: "Staff verification | Delta",
  robots: { index: false, follow: false },
};

export default async function AdminMfaPage() {
  const access = await resolveAdminAccess();
  if (access.state === "unauthenticated") redirect(loginRedirectPath("/admin"));
  if (access.state === "granted") redirect("/admin");
  if (access.state === "forbidden") {
    return (
      <>
        <h1>Access unavailable</h1>
        <p className="auth-intro">This account cannot access the Delta admin.</p>
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error || !factors) {
    return (
      <>
        <h1>Verification unavailable</h1>
        <p className="auth-intro">Could not load your authenticator. Please refresh this page.</p>
      </>
    );
  }
  const verifiedFactorId = factors.totp[0]?.id ?? null;

  return (
    <>
      <h1>{verifiedFactorId ? "Verify your identity" : "Secure your staff account"}</h1>
      <p className="auth-intro">
        {verifiedFactorId
          ? "Enter the current code from your authenticator app to continue to admin."
          : "Set up an authenticator app to protect access to the Delta admin."}
      </p>
      <MfaForm verifiedFactorId={verifiedFactorId} />
    </>
  );
}
