"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { placeOrderAction } from "@/app/(store)/checkout/actions";
import { CheckoutField } from "@/components/checkout/checkout-field";
import { CheckoutSignInPrompt } from "@/components/checkout/checkout-sign-in-prompt";
import { useCart, useStorefrontAccount } from "@/components/storefront/storefront-shell";
import { cartStorageKey } from "@/features/catalog/cart";
import { formatMoney } from "@/features/catalog/money";
import { ORDER_PRICING, calculateOrderTotals } from "@/features/orders/orders";
import { checkoutInputSchema, type CheckoutInput } from "@/features/orders/schemas";

type CheckoutFormValues = z.input<typeof checkoutInputSchema>;
export type CheckoutPrefill = Omit<CheckoutFormValues, "lines">;

export const EMPTY_CHECKOUT: CheckoutPrefill = {
  contactEmail: "",
  contactPhone: "",
  notes: "",
  shippingAddress: {
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    province: "",
    postalCode: "",
    country: "PK",
  },
};

/** True only when the browser has nothing stored, so we do not redirect before the cart is restored. */
function storedCartIsEmpty(): boolean {
  try {
    const stored = window.localStorage.getItem(cartStorageKey());
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return !Array.isArray(parsed) || parsed.length === 0;
  } catch {
    return true;
  }
}

export function CheckoutForm({ prefill }: { prefill: CheckoutPrefill }) {
  const router = useRouter();
  const { lines } = useCart();
  const account = useStorefrontAccount();
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues, unknown, CheckoutInput>({
    resolver: zodResolver(checkoutInputSchema),
    defaultValues: { ...prefill, lines: [] },
  });

  // The cart lives in localStorage, so the lines arrive after hydration.
  useEffect(() => {
    setValue(
      "lines",
      lines.map((line) => ({ productVariantId: line.variant.id, quantity: line.quantity })),
    );
  }, [lines, setValue]);

  useEffect(() => {
    if (lines.length === 0 && storedCartIsEmpty()) router.replace("/cart");
  }, [lines, router]);

  const totals = calculateOrderTotals(
    lines.map((line) => ({ unitPriceAmount: line.variant.priceAmount, quantity: line.quantity })),
  );

  async function onSubmit(values: CheckoutInput) {
    // A successful action redirects, so anything returned here is a failure.
    const result = await placeOrderAction(values);
    if (result) setError("root", { message: result.message });
  }

  const rootError = errors.root?.message ?? (errors.lines ? "Your cart could not be prepared for checkout." : null);

  return (
    <form className="checkout-layout" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="checkout-sections">
        {account.signedIn ? null : <CheckoutSignInPrompt />}

        <section className="checkout-section" aria-labelledby="checkout-contact">
          <h2 id="checkout-contact">Contact</h2>
          <div className="checkout-grid">
            <CheckoutField
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              registration={register("contactEmail")}
              error={errors.contactEmail?.message}
            />
            <CheckoutField
              label="Mobile number"
              inputMode="tel"
              autoComplete="tel"
              registration={register("contactPhone")}
              error={errors.contactPhone?.message}
            />
          </div>
        </section>

        <section className="checkout-section" aria-labelledby="checkout-shipping">
          <h2 id="checkout-shipping">Shipping address</h2>
          <div className="checkout-grid">
            <CheckoutField
              label="Full name"
              autoComplete="name"
              registration={register("shippingAddress.fullName")}
              error={errors.shippingAddress?.fullName?.message}
            />
            <CheckoutField
              label="Delivery phone"
              inputMode="tel"
              autoComplete="tel"
              registration={register("shippingAddress.phone")}
              error={errors.shippingAddress?.phone?.message}
            />
            <CheckoutField
              label="Address"
              autoComplete="address-line1"
              registration={register("shippingAddress.line1")}
              error={errors.shippingAddress?.line1?.message}
            />
            <CheckoutField
              label="Apartment, suite (optional)"
              autoComplete="address-line2"
              registration={register("shippingAddress.line2")}
              error={errors.shippingAddress?.line2?.message}
            />
            <CheckoutField
              label="City"
              autoComplete="address-level2"
              registration={register("shippingAddress.city")}
              error={errors.shippingAddress?.city?.message}
            />
            <CheckoutField
              label="Province"
              autoComplete="address-level1"
              registration={register("shippingAddress.province")}
              error={errors.shippingAddress?.province?.message}
            />
            <CheckoutField
              label="Postal code (optional)"
              inputMode="numeric"
              autoComplete="postal-code"
              registration={register("shippingAddress.postalCode")}
              error={errors.shippingAddress?.postalCode?.message}
            />
            <CheckoutField
              label="Country code"
              autoComplete="country"
              registration={register("shippingAddress.country")}
              error={errors.shippingAddress?.country?.message}
            />
          </div>
        </section>

        <section className="checkout-section" aria-labelledby="checkout-notes">
          <h2 id="checkout-notes">Order notes</h2>
          <CheckoutField
            label="Anything our courier should know (optional)"
            multiline
            registration={register("notes")}
            error={errors.notes?.message}
          />
        </section>
      </div>

      <aside className="checkout-summary" aria-labelledby="checkout-review">
        <h2 id="checkout-review">Review</h2>
        <ul className="checkout-summary-lines">
          {lines.map((line) => (
            <li key={line.key}>
              <span>
                {line.product.title}
                {line.variant.color || line.variant.size
                  ? ` — ${[line.variant.color, line.variant.size].filter(Boolean).join(" / ")}`
                  : ""}
                {` × ${line.quantity}`}
              </span>
              <span>{formatMoney(line.variant.priceAmount * line.quantity, ORDER_PRICING.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="checkout-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(totals.subtotalAmount, ORDER_PRICING.currency)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd>
              {totals.shippingAmount === 0 ? "Free" : formatMoney(totals.shippingAmount, ORDER_PRICING.currency)}
            </dd>
          </div>
          <div className="checkout-total">
            <dt>Total</dt>
            <dd>{formatMoney(totals.totalAmount, ORDER_PRICING.currency)}</dd>
          </div>
        </dl>
        <p className="checkout-payment-note">
          Payment method: cash on delivery. Pay the courier when your order arrives.
        </p>
        {rootError ? (
          <p className="checkout-form-error" role="alert">
            {rootError}
          </p>
        ) : null}
        <button className="checkout-submit" type="submit" disabled={isSubmitting || lines.length === 0}>
          {isSubmitting ? "Placing order…" : "Place order"}
        </button>
        <Link className="checkout-back" href="/cart">
          Back to cart
        </Link>
      </aside>
    </form>
  );
}
