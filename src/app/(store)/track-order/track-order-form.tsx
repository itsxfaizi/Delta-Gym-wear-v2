"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { orderTrackingSchema, type OrderTrackingInput } from "@/features/orders/tracking";

import { trackOrderAction, type TrackOrderResult } from "./actions";
import { TrackingResult } from "./tracking-result";

type TrackOrderValues = z.input<typeof orderTrackingSchema>;

export function TrackOrderForm({ defaultOrderNumber = "" }: { defaultOrderNumber?: string }) {
  const [result, setResult] = useState<TrackOrderResult | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TrackOrderValues, unknown, OrderTrackingInput>({
    resolver: zodResolver(orderTrackingSchema),
    defaultValues: { orderNumber: defaultOrderNumber, phone: "" },
  });

  async function onSubmit(values: OrderTrackingInput) {
    setResult(null);
    try {
      setResult(await trackOrderAction(values));
    } catch {
      // A transport failure must not look like "your order does not exist".
      setResult({ found: false, message: "We could not reach the tracking service. Please try again." });
    }
  }

  return (
    <>
      <form className="track-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="track-field">
          <label htmlFor="track-order-number">Order number</label>
          <input
            id="track-order-number"
            autoComplete="off"
            placeholder="DG-240131-0001"
            aria-invalid={errors.orderNumber ? "true" : "false"}
            aria-describedby={errors.orderNumber ? "track-order-number-error" : "track-order-number-hint"}
            {...register("orderNumber")}
          />
          <span className="track-hint" id="track-order-number-hint">
            It is printed at the top of your order confirmation.
          </span>
          {errors.orderNumber ? (
            <span className="track-field-error" id="track-order-number-error" role="alert">
              {errors.orderNumber.message}
            </span>
          ) : null}
        </div>

        <div className="track-field">
          <label htmlFor="track-phone">Phone number</label>
          <input
            id="track-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0328 5386793"
            aria-invalid={errors.phone ? "true" : "false"}
            aria-describedby={errors.phone ? "track-phone-error" : undefined}
            {...register("phone")}
          />
          {errors.phone ? (
            <span className="track-field-error" id="track-phone-error" role="alert">
              {errors.phone.message}
            </span>
          ) : null}
        </div>

        <button className="track-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Looking up your order…" : "Track order"}
        </button>
      </form>

      <div aria-live="polite" className="track-output">
        {isSubmitting ? <p className="track-loading">Looking up your order…</p> : null}
        {!isSubmitting && result?.found === false ? (
          <p className="track-empty" role="status">
            {result.message}
          </p>
        ) : null}
        {!isSubmitting && result?.found ? <TrackingResult order={result.order} /> : null}
      </div>
    </>
  );
}
