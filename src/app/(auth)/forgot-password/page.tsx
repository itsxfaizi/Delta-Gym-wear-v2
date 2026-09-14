import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/account/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1>Reset your password</h1>
      <p className="auth-intro">We will email you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </>
  );
}
