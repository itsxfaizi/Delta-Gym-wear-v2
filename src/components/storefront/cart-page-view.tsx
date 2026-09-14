"use client";

import Link from "next/link";
import { formatMoney } from "@/features/catalog/money";

import { CartLines, useCart } from "./storefront-shell";

export function CartPageView() {
  const { lines, subtotal, update } = useCart();
  if (!lines.length) {
    return (
      <main className="cart-page route-state">
        <p className="section-label">Cart</p>
        <h1>Your cart is empty</h1>
        <p>Browse the current collection and choose a colour and size.</p>
        <Link className="primary-link" href="/shop">Continue shopping</Link>
      </main>
    );
  }
  return (
    <main className="cart-page">
      <header className="cart-page-heading"><div><p className="section-label">Review</p><h1>Your cart</h1></div><p>{lines.reduce((sum, line) => sum + line.quantity, 0)} items</p></header>
      <div className="cart-page-layout">
        <CartLines lines={lines} update={update} />
        <aside className="cart-summary" aria-label="Cart summary">
          <div><span>Subtotal</span><strong>{formatMoney(subtotal, lines[0]?.variant.currency ?? "PKR")}</strong></div>
          <Link className="primary-cta" href="/checkout">Checkout</Link>
          <Link className="secondary-cta" href="/shop">Continue shopping</Link>
        </aside>
      </div>
    </main>
  );
}
