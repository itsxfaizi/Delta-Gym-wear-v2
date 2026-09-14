"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/account/schemas";
import { requestPasswordReset } from "@/server/auth/actions";

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    const result = await requestPasswordReset(values);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    reset();
    toast.success("If that email has an account, a reset link is on its way.");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {isSubmitSuccessful ? (
        <p className="auth-form-note" role="status">
          If that email has an account, a reset link is on its way.
        </p>
      ) : null}

      <div className="auth-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email ? (
          <span className="auth-field-error" id="email-error" role="alert">
            {errors.email.message}
          </span>
        ) : null}
      </div>

      <button className="auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send reset link"}
      </button>

      <p className="auth-links">
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}
