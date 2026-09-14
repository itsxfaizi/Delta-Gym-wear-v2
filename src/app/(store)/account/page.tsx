import type { Metadata } from "next";
import Link from "next/link";

import { SignOutButton } from "@/components/account/sign-out-button";
import { Toaster } from "@/components/ui/sonner";
import { requireAccountUser } from "@/features/account/guard";
import { getCustomerByAuthUserId } from "@/features/account/queries";

import "../../../styles/account.css";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await requireAccountUser("/account");
  const customer = await getCustomerByAuthUserId(user.id);
  const fullName =
    customer?.fullName ?? (user.user_metadata?.full_name as string | undefined) ?? null;

  return (
    <div className="account-page">
      <h1>Your account</h1>

      <dl className="account-summary">
        <div>
          <dt>Name</dt>
          <dd>{fullName ?? "Not provided"}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{customer?.email ?? user.email ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{customer?.phone ?? "Not provided"}</dd>
        </div>
      </dl>

      <nav className="account-nav" aria-label="Account">
        <Link href="/account/orders">Order history</Link>
        <Link href="/account/addresses">Saved addresses</Link>
      </nav>

      <SignOutButton />
      <Toaster position="top-center" />
    </div>
  );
}
