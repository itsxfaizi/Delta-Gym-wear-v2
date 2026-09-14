"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { saveCourier } from "@/features/admin/order-actions";
import { setCourierSchema } from "@/features/orders/ops-schemas";

type CourierFormValues = z.input<typeof setCourierSchema>;

// Fixed to the market timezone so the server render and the hydrated render agree.
const LOCAL_INPUT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toInputValue(date: Date | undefined): string {
  return date ? LOCAL_INPUT.format(date).replace(", ", "T") : "";
}

export function CourierForm({
  orderId,
  courier,
  trackingNumber,
  trackingUrl,
  dispatchedAt,
}: {
  orderId: string;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  dispatchedAt?: Date;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CourierFormValues, unknown, z.output<typeof setCourierSchema>>({
    resolver: zodResolver(setCourierSchema),
    defaultValues: {
      orderId,
      courier: courier ?? "",
      trackingNumber: trackingNumber ?? "",
      trackingUrl: trackingUrl ?? "",
      dispatchedAt: toInputValue(dispatchedAt),
    },
  });

  async function onSubmit(values: z.output<typeof setCourierSchema>) {
    const result = await saveCourier(orderId, values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Courier details saved.");
    router.refresh();
  }

  async function copyTrackingNumber() {
    if (!trackingNumber) return;
    try {
      await navigator.clipboard.writeText(trackingNumber);
      toast.success("CN number copied.");
    } catch {
      toast.error("Your browser blocked the clipboard. Copy it by hand.");
    }
  }

  return (
    <div className="ops-stack">
      {trackingNumber ? (
        <div className="ops-inline">
          <span className="ops-copy">{trackingNumber}</span>
          <button className="admin-button" type="button" onClick={copyTrackingNumber}>
            <Copy aria-hidden="true" size={14} /> Copy CN
          </button>
          {trackingUrl ? (
            <a className="admin-button" href={trackingUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink aria-hidden="true" size={14} /> Open tracking
            </a>
          ) : null}
        </div>
      ) : (
        <p className="admin-empty">No courier recorded yet.</p>
      )}

      <form className="admin-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="courier-name">Courier</label>
            <input
              id="courier-name"
              autoComplete="off"
              aria-invalid={errors.courier ? "true" : "false"}
              {...register("courier")}
            />
            {errors.courier ? (
              <span className="admin-error" role="alert">
                {errors.courier.message}
              </span>
            ) : null}
          </div>

          <div className="admin-field">
            <label htmlFor="courier-cn">CN / tracking number</label>
            <input
              id="courier-cn"
              autoComplete="off"
              aria-invalid={errors.trackingNumber ? "true" : "false"}
              {...register("trackingNumber")}
            />
            {errors.trackingNumber ? (
              <span className="admin-error" role="alert">
                {errors.trackingNumber.message}
              </span>
            ) : null}
          </div>
        </div>

        <div className="admin-form-row">
          <div className="admin-field admin-field--wide">
            <label htmlFor="courier-url">Tracking URL (optional)</label>
            <input
              id="courier-url"
              type="url"
              inputMode="url"
              aria-invalid={errors.trackingUrl ? "true" : "false"}
              {...register("trackingUrl")}
            />
            {errors.trackingUrl ? (
              <span className="admin-error" role="alert">
                {errors.trackingUrl.message}
              </span>
            ) : null}
          </div>

          <div className="admin-field">
            <label htmlFor="courier-dispatched">Dispatched</label>
            <input
              id="courier-dispatched"
              type="datetime-local"
              aria-invalid={errors.dispatchedAt ? "true" : "false"}
              {...register("dispatchedAt", { setValueAs: (value: string) => value || null })}
            />
            {errors.dispatchedAt ? (
              <span className="admin-error" role="alert">
                {errors.dispatchedAt.message}
              </span>
            ) : null}
          </div>
        </div>

        <div className="admin-actions">
          <button className="admin-button admin-button--primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save courier details"}
          </button>
        </div>
      </form>
    </div>
  );
}
