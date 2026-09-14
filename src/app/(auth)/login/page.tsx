import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/account/login-form";
import { safeNextPath } from "@/features/account/schemas";
import { getAuthenticatedUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next ?? null);
  if (await getAuthenticatedUser()) redirect(next);

  return (
    <>
      <h1>Sign in</h1>
      <p className="auth-intro">Access your orders, addresses and account details.</p>
      <LoginForm next={next} />
    </>
  );
}
