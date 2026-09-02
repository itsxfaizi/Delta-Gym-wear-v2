"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import { serializeCartLines } from "@/features/catalog/cart";
import { formatMoney } from "@/features/catalog/money";
import { placeCodOrder } from "@/features/orders/actions";
import type { CheckoutActionState, CheckoutField } from "@/features/orders/types";
import { useCart } from "./storefront-shell";

const initialState: CheckoutActionState = { ok: false, message: "", fieldErrors: {} };

function fieldError(state: CheckoutActionState, field: CheckoutField) {
  return state.fieldErrors[field]?.[0];
}

function TextField({
  name,
  label,
  autoComplete,
  state,
  optional = false,
  type = "text",
  inputMode,
}: {
  name: CheckoutField;
  label: string;
  autoComplete: string;
  state: CheckoutActionState;
  optional?: boolean;
  type?: string;
  inputMode?: "email" | "numeric" | "tel" | "text";
}) {
  const error = fieldError(state, name);
  return (
    <label className="checkout-field">
      <span>{label}{optional ? " (optional)" : ""}</span>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={!optional}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error ? <span id={`${name}-error`} className="form-error">{error}</span> : null}
    </label>
  );
}

export function CheckoutView({ shippingAmount }: { shippingAmount: number | null }) {
  const router = useRouter();
  const { lines, subtotal, clear } = useCart();
  const [state, formAction, pending] = useActionState(placeCodOrder, initialState);
  const redirectedRef = useRef(false);
  const currency = lines[0]?.variant.currency ?? "PKR";
  const total = shippingAmount === null ? subtotal : subtotal + shippingAmount;

  useEffect(() => {
    if (!state.ok || !state.orderToken || redirectedRef.current) return;
    redirectedRef.current = true;
    clear();
    router.push(`/orders/${state.orderToken}`);
  }, [clear, router, state.ok, state.orderToken]);

  if (!lines.length && !state.ok) {
    return (
      <main className="checkout-page route-state">
        <p className="section-label">Checkout</p>
        <h1>Your cart is empty</h1>
        <p>Add an item before placing a Cash on Delivery order.</p>
        <Link className="primary-link" href="/shop">Continue shopping</Link>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <header className="checkout-heading">
        <p className="section-label">Cash on Delivery</p>
        <h1>Checkout</h1>
        <p>Nationwide delivery is subject to courier serviceability. We will confirm your COD order by phone or WhatsApp before dispatch.</p>
      </header>

      <form className="checkout-layout" action={formAction}>
        <section className="checkout-panel" aria-labelledby="checkout-contact-title">
          <h2 id="checkout-contact-title">Contact and delivery</h2>
          <input type="hidden" name="cartLines" value={JSON.stringify(serializeCartLines(lines))} />
          <TextField name="fullName" label="Full name" autoComplete="name" state={state} />
          <TextField name="phone" label="Pakistani mobile number" autoComplete="tel" inputMode="tel" state={state} />
          <TextField name="email" label="Email" autoComplete="email" type="email" inputMode="email" optional state={state} />
          <TextField name="addressLine1" label="Address line 1" autoComplete="address-line1" state={state} />
          <TextField name="addressLine2" label="Address line 2" autoComplete="address-line2" optional state={state} />
          <div className="checkout-field-row">
            <TextField name="city" label="City" autoComplete="address-level2" state={state} />
            <TextField name="province" label="Province" autoComplete="address-level1" optional state={state} />
          </div>
          <TextField name="postalCode" label="Postal code" autoComplete="postal-code" optional inputMode="numeric" state={state} />
        </section>

        <aside className="checkout-summary" aria-label="Order summary">
          <h2>Order summary</h2>
          <ul className="checkout-lines">
            {lines.map((line) => (
              <li key={line.key}>
                <span>{line.product.title}</span>
                <span>{line.variant.color ?? ""} / {line.variant.size ?? ""} x {line.quantity}</span>
                <strong>{formatMoney(line.variant.priceAmount * line.quantity, line.variant.currency)}</strong>
              </li>
            ))}
          </ul>
          <div className="checkout-total-row"><span>Products</span><strong>{formatMoney(subtotal, currency)}</strong></div>
          <div className="checkout-total-row"><span>Delivery</span><strong>{shippingAmount === null ? "Not configured" : formatMoney(shippingAmount, currency)}</strong></div>
          <div className="checkout-grand-total"><span>Total</span><strong>{formatMoney(total, currency)}</strong></div>
          <p>Payment method: Cash on Delivery.</p>
          {state.message ? <p className="form-error" role="alert">{state.message}</p> : null}
          {shippingAmount === null ? <p className="form-error" role="alert">Set DELTA_COD_SHIPPING_FEE_AMOUNT before accepting COD orders.</p> : null}
          <button className="primary-cta" type="submit" disabled={pending || shippingAmount === null}>{pending ? "Placing order..." : "Place COD order"}</button>
        </aside>
      </form>
    </main>
  );
}
