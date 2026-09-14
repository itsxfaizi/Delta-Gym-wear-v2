import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignupForm } from "@/components/account/signup-form";
import { ACCOUNT_HOME } from "@/features/account/schemas";
import { getAuthenticatedUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await getAuthenticatedUser()) redirect(ACCOUNT_HOME);

  return (
    <>
      <h1>Create an account</h1>
      <p className="auth-intro">Save your addresses and track every order in one place.</p>
      <SignupForm />
    </>
  );
}
