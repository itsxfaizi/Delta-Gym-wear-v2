import { formatLongDateTime } from "@/lib/datetime";
import { formatMoney } from "@/features/catalog/money";

import { ORDER_PRICING } from "./orders";
import type { Order } from "./types";

export type ReceiptEmail = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function addressLines(order: Order): string[] {
  const address = order.shippingAddress;
  return [
    address.fullName,
    address.line1,
    address.line2,
    [address.city, address.province].filter(Boolean).join(", "),
    address.postalCode,
    address.country,
    address.phone,
  ].filter((line): line is string => Boolean(line && line.trim()));
}

/**
 * Composes a cash-on-delivery order confirmation. Pure: no I/O, no clock reads
 * beyond the order's own placedAt, so it is fully unit-testable. Never include
 * ops-only fields (internal notes, call attempts, courier) here.
 */
export function buildOrderReceiptEmail(order: Order, options: { trackingUrl?: string } = {}): ReceiptEmail {
  const currency = order.currency || ORDER_PRICING.currency;
  const subject = `Your Delta Gym Wear order ${order.orderNumber} is confirmed`;

  const itemLines = order.items.map((item) => {
    const variant = item.variantLabel ? ` (${item.variantLabel})` : "";
    return {
      text: `${item.quantity} x ${item.productTitle}${variant} — ${formatMoney(item.lineTotalAmount, currency)}`,
      html: `<tr><td>${escapeHtml(item.productTitle)}${variant ? ` <span style="color:#666">${escapeHtml(variant)}</span>` : ""}</td><td>×${item.quantity}</td><td>${formatMoney(item.lineTotalAmount, currency)}</td></tr>`,
    };
  });

  const address = addressLines(order);
  const trackingLine = options.trackingUrl ? `Track your order: ${options.trackingUrl}` : null;

  const text = [
    `Thanks for your order, ${order.shippingAddress.fullName}!`,
    "",
    `Order number: ${order.orderNumber}`,
    `Placed: ${formatLongDateTime(order.placedAt)}`,
    "",
    "Items:",
    ...itemLines.map((item) => `- ${item.text}`),
    "",
    `Subtotal: ${formatMoney(order.subtotalAmount, currency)}`,
    `Shipping: ${order.shippingAmount === 0 ? "Free" : formatMoney(order.shippingAmount, currency)}`,
    `Total: ${formatMoney(order.totalAmount, currency)}`,
    "",
    "Payment method: Cash on delivery. Please have the exact amount ready for the courier.",
    "",
    "Shipping to:",
    ...address,
    ...(trackingLine ? ["", trackingLine] : []),
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;color:#111;max-width:560px;margin:0 auto">
      <p>Thanks for your order, ${escapeHtml(order.shippingAddress.fullName)}!</p>
      <p><strong>Order number:</strong> ${escapeHtml(order.orderNumber)}<br/>
      <strong>Placed:</strong> ${escapeHtml(formatLongDateTime(order.placedAt))}</p>
      <table style="width:100%;border-collapse:collapse" cellpadding="6">
        ${itemLines.map((item) => item.html).join("")}
      </table>
      <p>
        Subtotal: ${formatMoney(order.subtotalAmount, currency)}<br/>
        Shipping: ${order.shippingAmount === 0 ? "Free" : formatMoney(order.shippingAmount, currency)}<br/>
        <strong>Total: ${formatMoney(order.totalAmount, currency)}</strong>
      </p>
      <p><strong>Payment method:</strong> Cash on delivery. Please have the exact amount ready for the courier.</p>
      <p><strong>Shipping to:</strong><br/>${address.map(escapeHtml).join("<br/>")}</p>
      ${trackingLine ? `<p><a href="${escapeHtml(options.trackingUrl!)}">Track your order</a></p>` : ""}
    </div>
  `.trim();

  return { subject, text, html };
}
