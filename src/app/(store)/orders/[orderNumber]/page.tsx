import type { Metadata } from "next";
import { formatDate } from "@/lib/datetime";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClearCart } from "@/components/checkout/clear-cart";
import { PayNowButton } from "@/components/checkout/pay-now-button";
import { formatMoney } from "@/features/catalog/money";
import type { Order } from "@/features/orders/types";
import { describeStatus } from "@/features/orders/status";
import { getAuthenticatedUser } from "@/server/auth/session";
import { getOrderByNumber } from "@/server/orders/queries";
import { getCourierView, getCustomerStatus } from "@/server/orders/tracking";
import { canViewOrder } from "@/server/orders/receipt-access";

import "../../../../styles/checkout.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Order receipt", robots: { index: false, follow: false } };


async function loadOrder(orderNumber: string): Promise<Order | null> {
  try {
    return await getOrderByNumber(orderNumber);
  } catch {
    // No database configured: the order cannot be shown rather than crashing.
    return null;
  }
}

/** ?payment= is set by Safepay's cancel link and by checkout when Safepay could not be reached. */
const PAYMENT_NOTICES: Record<string, string> = {
  cancelled: "Payment was cancelled. Your order is saved — pay whenever you are ready.",
  unavailable: "We could not open the secure payment page. Your order is saved — try again below.",
};

function PaymentNote({ order, notice }: { order: Order; notice: string | undefined }) {
  const total = formatMoney(order.totalAmount, order.currency);

  if (order.paymentMethod === "cod") {
    return (
      <p className="checkout-payment-note">
        Cash on delivery — pay {total} to the courier when your order arrives. Nothing has been charged online.
      </p>
    );
  }
  if (order.paymentStatus === "paid") {
    return <p className="checkout-payment-note">Paid online — {total} received through Safepay. Thank you.</p>;
  }
  if (order.paymentStatus === "refunded") {
    return <p className="checkout-payment-note">Refunded — {total} was returned to your payment method.</p>;
  }
  if (order.status === "cancelled") {
    return <p className="checkout-payment-note">This order was cancelled before payment. Nothing was charged.</p>;
  }
  return (
    <div className="checkout-payment-note" role={notice ? "status" : undefined}>
      <p>{PAYMENT_NOTICES[notice ?? ""] ?? "Awaiting online payment. We start packing as soon as it goes through."}</p>
      <PayNowButton orderNumber={order.orderNumber} label={`Pay ${total} now`} />
    </div>
  );
}

export default async function OrderReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ payment?: string | string[] }>;
}) {
  const { orderNumber } = await params;
  const { payment } = await searchParams;
  const order = await loadOrder(orderNumber);
  if (!order || !(await canViewOrder(order))) notFound();

  // Customer-safe only: courier and tracking. Internal notes and call attempts
  // live in the ops adapter and must never be projected onto a storefront page.
  const [courier, status, viewer] = await Promise.all([
    getCourierView(order.id),
    getCustomerStatus(order.id, order.status),
    getAuthenticatedUser().catch(() => null),
  ]);
  const statusMeta = describeStatus(status);

  return (
    <main className="order-receipt">
      <ClearCart />
      <header className="checkout-heading">
        <p className="section-label">Order placed</p>
        <h1>{order.orderNumber}</h1>
        <p>
          Placed <time dateTime={order.placedAt.toISOString()}>{formatDate(order.placedAt)}</time> ·{" "}
          <span className="order-status" data-status={status}>
            {statusMeta.label}
          </span>
        </p>
      </header>

      <PaymentNote order={order} notice={typeof payment === "string" ? payment : undefined} />

      <section className="checkout-section" aria-labelledby="receipt-items">
        <h2 id="receipt-items">Items</h2>
        <ul className="checkout-summary-lines">
          {order.items.map((item) => (
            <li key={item.id}>
              <span>
                {item.productTitle}
                {item.variantLabel ? ` — ${item.variantLabel}` : ""}
                {` × ${item.quantity}`}
              </span>
              <span>{formatMoney(item.lineTotalAmount, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="checkout-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotalAmount, order.currency)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd>
              {order.shippingAmount === 0 ? "Free" : formatMoney(order.shippingAmount, order.currency)}
            </dd>
          </div>
          <div className="checkout-total">
            <dt>Total</dt>
            <dd>{formatMoney(order.totalAmount, order.currency)}</dd>
          </div>
        </dl>
      </section>

      <section className="checkout-section" aria-labelledby="receipt-shipping">
        <h2 id="receipt-shipping">Shipping to</h2>
        <address className="order-address">
          {order.shippingAddress.fullName}
          <br />
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? <>, {order.shippingAddress.line2}</> : null}
          <br />
          {order.shippingAddress.city}, {order.shippingAddress.province}
          {order.shippingAddress.postalCode ? ` ${order.shippingAddress.postalCode}` : ""}
          <br />
          {order.shippingAddress.country}
          <br />
          {order.shippingAddress.phone}
        </address>
        <p>{order.contactEmail}</p>
        {order.notes ? <p className="order-notes">Notes: {order.notes}</p> : null}
      </section>

      {courier ? (
        <section className="checkout-section receipt-courier" aria-labelledby="receipt-courier">
          <h2 id="receipt-courier">Courier</h2>
          <dl>
            <div>
              <dt>Courier</dt>
              <dd>{courier.courier}</dd>
            </div>
            {courier.trackingNumber ? (
              <div>
                <dt>Tracking number</dt>
                <dd>{courier.trackingNumber}</dd>
              </div>
            ) : null}
          </dl>
          {courier.trackingUrl ? (
            <p>
              <a href={courier.trackingUrl} rel="noreferrer noopener" target="_blank">
                Track on the courier&rsquo;s site
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="receipt-next" aria-labelledby="receipt-next-heading">
        <h2 id="receipt-next-heading">What next</h2>
        {viewer ? (
          <p>
            Keep this order handy in your account, and keep your addresses in one place to reuse them at your next checkout.
          </p>
        ) : (
          <p>
            Checked out as a guest. Create an account with {order.contactEmail} to keep your orders and
            addresses in one place — this receipt stays reachable from Track this order either way.
          </p>
        )}
        <div className="receipt-actions">
          <Link href="/shop">Continue shopping</Link>
          {viewer ? <Link href="/account/orders">View my orders</Link> : null}
          {viewer ? <Link href="/account/addresses">Manage saved addresses</Link> : null}
          {viewer ? null : <Link href="/signup">Create an account</Link>}
          <Link href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`}>Track this order</Link>
        </div>
      </section>
    </main>
  );
}
