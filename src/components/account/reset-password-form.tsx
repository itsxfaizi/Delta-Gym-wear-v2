"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { resetPasswordSchema, type ResetPasswordInput } from "@/features/account/schemas";
import { updatePassword } from "@/server/auth/actions";

export function ResetPasswordForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    const result = await updatePassword(values);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Your password has been updated.");
    router.replace("/account");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="auth-field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password ? "true" : "false"}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
        {errors.password ? (
          <span className="auth-field-error" id="password-error" role="alert">
            {errors.password.message}
          </span>
        ) : null}
      </div>

      <div className="auth-field">
        <label htmlFor="confirmPassword">Confirm new password</label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? "true" : "false"}
          aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <span className="auth-field-error" id="confirm-password-error" role="alert">
            {errors.confirmPassword.message}
          </span>
        ) : null}
      </div>

      <button className="auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
