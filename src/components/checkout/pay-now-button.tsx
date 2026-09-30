"use client";

import { useState, useTransition } from "react";

import { payOrderAction } from "@/app/(store)/checkout/actions";

/** Reopens Safepay's hosted checkout for an unpaid online order. */
export function PayNowButton({ orderNumber, label }: { orderNumber: string; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function payNow() {
    setError(null);
    startTransition(async () => {
      // A successful action redirects to Safepay, so anything returned is a failure.
      const result = await payOrderAction(orderNumber);
      if (result) setError(result.message);
    });
  }

  return (
    <div className="receipt-pay-now">
      <button className="checkout-submit" type="button" onClick={payNow} disabled={isPending}>
        {isPending ? "Opening secure payment…" : label}
      </button>
      {error ? (
        <p className="checkout-form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
