import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { formatMoney } from "@/features/catalog/money";
import { getPublicOrder } from "@/features/orders/queries";

type OrderPageProps = { params: Promise<{ orderToken: string }> };

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }: OrderPageProps) {
  const order = await getPublicOrder((await params).orderToken);
  if (!order) notFound();

  return (
    <main className="order-page">
      <section className="order-confirmation" aria-labelledby="order-title">
        <p className="section-label">Order received</p>
        <h1 id="order-title">Thank you</h1>
        <p role="status">Your Cash on Delivery order is pending confirmation. Our team will confirm it by phone or WhatsApp before dispatch.</p>
        <dl className="order-reference">
          <div><dt>Order reference</dt><dd>{order.orderReference}</dd></div>
          <div><dt>Status</dt><dd>Pending confirmation</dd></div>
          <div><dt>Payment</dt><dd>Cash on Delivery</dd></div>
        </dl>
      </section>

      <section className="order-layout" aria-label="Order details">
        <div className="order-panel">
          <h2>Items</h2>
          <ul className="checkout-lines">
            {order.lines.map((line) => (
              <li key={`${line.productHandle}:${line.variantId}`}>
                <span>{line.productTitle}</span>
                <span>{line.color ?? ""} / {line.size ?? ""} x {line.quantity}</span>
                <strong>{formatMoney(line.lineTotalAmount, line.currency)}</strong>
              </li>
            ))}
          </ul>
        </div>

        <aside className="checkout-summary" aria-label="Order summary">
          <h2>Summary</h2>
          <div className="checkout-total-row"><span>Products</span><strong>{formatMoney(order.subtotalAmount, order.currency)}</strong></div>
          <div className="checkout-total-row"><span>Delivery</span><strong>{formatMoney(order.shippingAmount, order.currency)}</strong></div>
          <div className="checkout-grand-total"><span>Total</span><strong>{formatMoney(order.totalAmount, order.currency)}</strong></div>
          <p>No separate tax line is shown until registration, rate, and invoice treatment are confirmed.</p>
        </aside>

        <div className="order-panel">
          <h2>Delivery</h2>
          <address>
            {order.customerFullName}<br />
            {order.customerPhone}<br />
            {order.customerEmail ? <>{order.customerEmail}<br /></> : null}
            {order.addressLine1}<br />
            {order.addressLine2 ? <>{order.addressLine2}<br /></> : null}
            {[order.city, order.province, order.postalCode].filter(Boolean).join(", ")}<br />
            Pakistan
          </address>
          <p>Nationwide delivery is subject to courier serviceability.</p>
        </div>

        <div className="order-actions">
          <Link className="primary-cta" href="/shop">Continue shopping</Link>
        </div>
      </section>
    </main>
  );
}
