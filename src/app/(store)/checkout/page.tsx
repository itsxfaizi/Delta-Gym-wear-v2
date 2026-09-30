import type { Metadata } from "next";

import { CheckoutForm, EMPTY_CHECKOUT, type CheckoutPrefill } from "@/components/checkout/checkout-form";
import { getCustomerByAuthUserId, listCustomerAddresses } from "@/features/account/queries";
import { getAuthenticatedUser } from "@/server/auth/session";
import { getSafepayConfig } from "@/server/env";

import "../../../styles/checkout.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

/** Prefills from the signed-in customer's default address; a guest gets a blank form. */
async function loadPrefill(): Promise<CheckoutPrefill> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return EMPTY_CHECKOUT;

    const customer = await getCustomerByAuthUserId(user.id);
    // listCustomerAddresses orders the default address first.
    const address = customer ? (await listCustomerAddresses(customer.id))[0] : undefined;
    const email = customer?.email ?? user.email ?? "";

    if (!address) {
      return { ...EMPTY_CHECKOUT, contactEmail: email, contactPhone: customer?.phone ?? "" };
    }

    return {
      contactEmail: email,
      contactPhone: customer?.phone ?? address.phone,
      notes: "",
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 ?? "",
        city: address.city,
        province: address.province,
        postalCode: address.postalCode ?? "",
        country: address.country,
      },
    };
  } catch {
    // Auth or database not configured here: checkout still works as a guest.
    return EMPTY_CHECKOUT;
  }
}

function onlinePaymentEnabled(): boolean {
  try {
    return getSafepayConfig() !== null;
  } catch {
    return false;
  }
}

export default async function CheckoutPage() {
  const paysOnline = onlinePaymentEnabled();

  return (
    <main className="checkout-page">
      <header className="checkout-heading">
        <p className="section-label">Checkout</p>
        <h1>{paysOnline ? "Checkout" : "Cash on delivery"}</h1>
        <p>
          {paysOnline
            ? "Confirm your details, then pay online or when the order arrives."
            : "Confirm your details. You pay the courier when the order arrives."}
        </p>
      </header>
      <CheckoutForm prefill={await loadPrefill()} onlinePaymentEnabled={paysOnline} />
    </main>
  );
}
