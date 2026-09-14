import type { Metadata } from "next";
import Link from "next/link";

import { normalizeOrderNumber } from "@/features/orders/tracking";

import { TrackOrderForm } from "./track-order-form";

import "../../../styles/track-order.css";

export const metadata: Metadata = { title: "Track your order", robots: { index: false, follow: false } };

/** Public by design: no account needed, the phone number on the order is the secret. */
export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const requested = (await searchParams).order;

  return (
    <main className="track-page">
      <header className="track-heading">
        <p className="section-label">Order tracking</p>
        <h1>Track your order</h1>
        <p>Enter the order number from your confirmation and the phone number you ordered with.</p>
      </header>

      <TrackOrderForm defaultOrderNumber={requested ? normalizeOrderNumber(requested) : ""} />

      <p className="track-footnote">
        Have an account? <Link href="/account/orders">See all your orders</Link> or{" "}
        <Link href="/shop">keep shopping</Link>.
      </p>
    </main>
  );
}
