import type { Metadata } from "next";
import Link from "next/link";

import { AddressBook, type SavedAddress } from "@/components/account/address-book";
import { Toaster } from "@/components/ui/sonner";
import { requireAccountUser } from "@/features/account/guard";
import { getCustomerByAuthUserId, listCustomerAddresses } from "@/features/account/queries";

import "../../../../styles/account.css";

export const metadata: Metadata = { title: "Saved addresses" };

export default async function AccountAddressesPage() {
  const user = await requireAccountUser("/account/addresses");
  const customer = await getCustomerByAuthUserId(user.id);
  const rows = customer ? await listCustomerAddresses(customer.id) : [];

  const addresses: SavedAddress[] = rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
    country: row.country,
    isDefault: row.isDefault,
  }));

  return (
    <div className="account-page">
      <h1>Saved addresses</h1>
      <nav className="account-nav" aria-label="Account">
        <Link href="/account">Account</Link>
        <Link href="/account/orders">Order history</Link>
      </nav>

      <AddressBook addresses={addresses} />
      <Toaster position="top-center" />
    </div>
  );
}
