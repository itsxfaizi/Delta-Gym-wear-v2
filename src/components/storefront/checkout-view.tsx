"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { serializeCartLines } from "@/features/catalog/cart";
import { formatMoney } from "@/features/catalog/money";
import { placeCodOrder } from "@/features/orders/actions";
import type { CheckoutField, CheckoutState } from "@/features/orders/types";
import { useCart } from "./storefront-shell";

/** What the buyer last submitted, so a rejection re-renders it instead of blanking it. */
type SubmittedValues = Record<string, FormDataEntryValue>;

function fieldError(state: CheckoutState, field: CheckoutField) {
  return state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;
}

function TextField({
  name,
  label,
  autoComplete,
  state,
  submitted,
  optional = false,
  type = "text",
  inputMode,
  pattern,
  title,
}: {
  name: CheckoutField;
  label: string;
  autoComplete: string;
  state: CheckoutState;
  submitted: SubmittedValues;
  optional?: boolean;
  type?: string;
  inputMode?: "email" | "numeric" | "tel" | "text";
  pattern?: string;
  title?: string;
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
        pattern={pattern}
        title={title}
        // React 19 resets an uncontrolled form once the action settles, and a
        // reset restores each input to its CURRENT defaultValue. Re-rendering
        // the submitted value here is what makes that reset a no-op after a
        // rejection. A controlled `value` would not survive it: the reset
        // clears the DOM node without changing React state, so nothing
        // re-renders and the field stays empty.
        defaultValue={String(submitted[name] ?? "")}
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
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(placeCodOrder, null);
  const [submitted, setSubmitted] = useState<SubmittedValues>({});
  const redirectedRef = useRef(false);
  const currency = lines[0]?.variant.currency ?? "PKR";
  const total = shippingAmount === null ? subtotal : subtotal + shippingAmount;
  const orderToken = state?.ok ? state.data.orderToken : null;
  const errorMessage = state && !state.ok ? state.message : null;

  useEffect(() => {
    if (!orderToken || redirectedRef.current) return;
    redirectedRef.current = true;
    clear();
    router.push(`/orders/${orderToken}`);
  }, [clear, orderToken, router]);

  if (!lines.length && !state?.ok) {
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

      <form
        className="checkout-layout"
        // Captured inside the action, so it lands in the same transition as the
        // form reset React schedules; the new defaultValues are committed first.
        action={(formData) => {
          setSubmitted(Object.fromEntries(formData));
          formAction(formData);
        }}
      >
        <section className="checkout-panel" aria-labelledby="checkout-contact-title">
          <h2 id="checkout-contact-title">Contact and delivery</h2>
          <input type="hidden" name="cartLines" value={JSON.stringify(serializeCartLines(lines))} />
          <TextField name="fullName" label="Full name" autoComplete="name" state={state} submitted={submitted} />
          <TextField
            name="phone"
            label="Pakistani mobile number"
            autoComplete="tel"
            inputMode="tel"
            // Mirrors the server rule in features/orders/schema.ts, so a `+92…`
            // number is caught in the field instead of by a round trip.
            pattern="03[0-9]{9}"
            title="Enter a Pakistani mobile number like 03XXXXXXXXX."
            state={state}
            submitted={submitted}
          />
          <TextField name="email" label="Email" autoComplete="email" type="email" inputMode="email" optional state={state} submitted={submitted} />
          <TextField name="addressLine1" label="Address line 1" autoComplete="address-line1" state={state} submitted={submitted} />
          <TextField name="addressLine2" label="Address line 2" autoComplete="address-line2" optional state={state} submitted={submitted} />
          <div className="checkout-field-row">
            <TextField name="city" label="City" autoComplete="address-level2" state={state} submitted={submitted} />
            <TextField name="province" label="Province" autoComplete="address-level1" optional state={state} submitted={submitted} />
          </div>
          <TextField name="postalCode" label="Postal code" autoComplete="postal-code" optional inputMode="numeric" state={state} submitted={submitted} />
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
          {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
          {shippingAmount === null ? <p className="form-error" role="alert">Set DELTA_COD_SHIPPING_FEE_AMOUNT before accepting COD orders.</p> : null}
          <button className="primary-cta" type="submit" disabled={pending || shippingAmount === null}>{pending ? "Placing order..." : "Place COD order"}</button>
        </aside>
      </form>
    </main>
  );
}
