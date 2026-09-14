import type { Metadata } from "next";
import { formatDate } from "@/lib/datetime";
import Link from "next/link";

import { requireAccountUser } from "@/features/account/guard";
import { getCustomerByAuthUserId, listCustomerOrders } from "@/features/account/queries";
import { formatMoney } from "@/features/catalog/money";
import { getCustomerStatus } from "@/server/orders/tracking";
import { describeStatus } from "@/features/orders/status";

import "../../../../styles/account.css";

export const metadata: Metadata = { title: "Order history" };


export default async function AccountOrdersPage() {
  const user = await requireAccountUser("/account/orders");
  const customer = await getCustomerByAuthUserId(user.id);
  const orders = customer ? await listCustomerOrders(customer.id) : [];
  // The receipt shows the effective COD status, so the list must too.
  const statuses = await Promise.all(orders.map((order) => getCustomerStatus(order.id, order.status)));

  return (
    <div className="account-page">
      <h1>Order history</h1>
      <nav className="account-nav" aria-label="Account">
        <Link href="/account">Account</Link>
        <Link href="/account/addresses">Saved addresses</Link>
        <Link href="/track-order">Track an order</Link>
      </nav>

      {orders.length === 0 ? (
        <p className="account-empty">You have not placed an order yet.</p>
      ) : (
        <ul className="order-list">
          {orders.map((order, index) => (
            <li className="order-card" key={order.id}>
              {/* A real anchor: the whole card is keyboard-reachable and openable in a new tab. */}
              <Link className="order-card-link" href={`/orders/${order.orderNumber}`}>
                <header className="order-card-header">
                  <p className="order-number">
                    <span className="sr-only">View receipt for order </span>
                    {order.orderNumber}
                  </p>
                  <p className="order-status" data-tone={describeStatus(statuses[index]).tone}>
                    {describeStatus(statuses[index]).label}
                  </p>
                  <p className="order-date">
                    <time dateTime={order.placedAt.toISOString()}>{formatDate(order.placedAt)}</time>
                  </p>
                  <p className="order-total">{formatMoney(order.totalAmount, order.currency)}</p>
                </header>
                <ul className="order-items">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.productTitle}
                        {item.variantLabel ? ` — ${item.variantLabel}` : ""}
                      </span>
                      <span>
                        {item.quantity} × {formatMoney(item.unitPriceAmount, order.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                <span className="order-card-cta" aria-hidden="true">View receipt</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
