import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/account/reset-password-form";
import { getAuthenticatedUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage() {
  // /auth/callback exchanges the recovery code for a session first; without one
  // there is nothing to reset and the link has expired or was never followed.
  if (!(await getAuthenticatedUser())) redirect("/forgot-password?error=link");

  return (
    <>
      <h1>Choose a new password</h1>
      <p className="auth-intro">Pick something you have not used on another site.</p>
      <ResetPasswordForm />
    </>
  );
}
