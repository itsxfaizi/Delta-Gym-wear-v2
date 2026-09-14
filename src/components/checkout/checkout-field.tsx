"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

/** One labelled control plus its inline error, wired for screen readers. */
export function CheckoutField({
  label,
  registration,
  error,
  type = "text",
  autoComplete,
  inputMode,
  multiline = false,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  multiline?: boolean;
}) {
  const id = `checkout-${registration.name.replace(/\./g, "-")}`;
  const errorId = `${id}-error`;
  const shared = {
    id,
    autoComplete,
    inputMode,
    "aria-invalid": error ? ("true" as const) : ("false" as const),
    "aria-describedby": error ? errorId : undefined,
    ...registration,
  };

  return (
    <div className="checkout-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? <textarea rows={3} {...shared} /> : <input type={type} {...shared} />}
      {error ? (
        <span className="checkout-field-error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
