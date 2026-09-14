"use client";

import { useTransition } from "react";

import { signOut } from "@/server/auth/actions";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="account-button"
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => signOut())}
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
