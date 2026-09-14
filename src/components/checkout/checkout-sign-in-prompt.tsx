"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";

import { loginRedirectPath } from "@/features/account/schemas";

/**
 * Optional convenience only — guest checkout stays fully usable. The cart lives
 * in localStorage, so the full navigation to /login and back to /checkout keeps
 * every line intact.
 */
export function CheckoutSignInPrompt() {
  return (
    <aside className="checkout-signin" aria-label="Sign in for faster checkout">
      <p>
        <LogIn size={18} aria-hidden="true" />
        <strong>Sign in for faster checkout.</strong> Your saved address and contact details fill the form in.
        Your cart is kept.
      </p>
      <p className="checkout-signin-links">
        <Link href={loginRedirectPath("/checkout")}>Sign in</Link>
        <Link href="/signup">Create an account</Link>
      </p>
      <p className="checkout-signin-note">Prefer not to? Carry on below as a guest.</p>
    </aside>
  );
}
