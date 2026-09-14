import Link from "next/link";

import "../../../../styles/checkout.css";

export default function OrderNotFound() {
  return (
    <main className="order-receipt route-state">
      <p className="section-label">Order</p>
      <h1>We could not find that order</h1>
      <p>Check the order number in the link from your confirmation, or sign in to see your order history.</p>
      <Link className="checkout-back" href="/account/orders">
        Your orders
      </Link>
    </main>
  );
}
