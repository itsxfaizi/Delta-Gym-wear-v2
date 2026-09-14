"use client";

import { Truck } from "lucide-react";
import { formatDate } from "@/lib/datetime";

import { formatMoney } from "@/features/catalog/money";
import { describeStatus } from "@/features/orders/status";
import { trackingTimeline } from "@/features/orders/tracking";
import type { TrackedOrder } from "@/server/orders/tracking";


export function TrackingResult({ order }: { order: TrackedOrder }) {
  const status = describeStatus(order.status);
  const timeline = trackingTimeline(order.status);

  return (
    <section className="track-result" aria-labelledby="track-result-heading">
      <header className="track-result-header">
        <h2 id="track-result-heading">{order.orderNumber}</h2>
        <p className="track-badge" data-tone={status.tone}>
          {status.label}
        </p>
        <p className="track-placed">
          Placed <time dateTime={order.placedAt.toISOString()}>{formatDate(order.placedAt)}</time>
        </p>
        <p className="track-status-description">{status.description}</p>
      </header>

      <ol className="track-timeline">
        {timeline.map((step) => (
          <li key={step.status} data-state={step.state} data-tone={step.meta.tone}>
            <span className="track-timeline-label">{step.meta.label}</span>
            <span className="track-timeline-description">{step.meta.description}</span>
            {step.state === "current" ? <span className="sr-only">Current status</span> : null}
          </li>
        ))}
      </ol>

      {order.courier ? (
        <section className="track-courier" aria-labelledby="track-courier-heading">
          <h3 id="track-courier-heading">
            <Truck size={18} aria-hidden="true" /> Courier
          </h3>
          <dl>
            <div>
              <dt>Courier</dt>
              <dd>{order.courier.courier}</dd>
            </div>
            {order.courier.trackingNumber ? (
              <div>
                <dt>Tracking number</dt>
                <dd>{order.courier.trackingNumber}</dd>
              </div>
            ) : null}
          </dl>
          {order.courier.trackingUrl ? (
            <a className="track-courier-link" href={order.courier.trackingUrl} rel="noreferrer noopener" target="_blank">
              Track on the courier&rsquo;s site
            </a>
          ) : null}
        </section>
      ) : null}

      <section className="track-summary" aria-labelledby="track-summary-heading">
        <h3 id="track-summary-heading">Order summary</h3>
        <ul className="track-lines">
          {order.items.map((item) => (
            <li key={item.id}>
              <span>
                {item.title}
                {item.variantLabel ? ` — ${item.variantLabel}` : ""}
                {` × ${item.quantity}`}
              </span>
              <span>{formatMoney(item.lineTotalAmount, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="track-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotalAmount, order.currency)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd>{order.shippingAmount === 0 ? "Free" : formatMoney(order.shippingAmount, order.currency)}</dd>
          </div>
          <div className="track-total">
            <dt>Total</dt>
            <dd>{formatMoney(order.totalAmount, order.currency)}</dd>
          </div>
        </dl>
      </section>

      <section className="track-address" aria-labelledby="track-address-heading">
        <h3 id="track-address-heading">Delivering to</h3>
        <address>
          {order.deliverTo.fullName}
          <br />
          {order.deliverTo.city}, {order.deliverTo.province}
          <br />
          {order.deliverTo.country}
        </address>
      </section>
    </section>
  );
}
