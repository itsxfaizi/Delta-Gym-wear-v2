"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ACCOUNT_HOME, signUpSchema, type SignUpInput } from "@/features/account/schemas";
import { signUp } from "@/server/auth/actions";

export function SignupForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: SignUpInput) {
    const result = await signUp(values);

    if (!result.ok) {
      setError("root", { type: "server", message: result.message });
      toast.error(result.message);
      return;
    }

    toast.success("Account created. Check your inbox if we ask you to confirm your email.");
    // Same full navigation the login form uses, so the server re-renders with the
    // session cookie. When confirmation is still pending there is no session and
    // /account sends them to /login?next=/account, which is the right place to wait.
    window.location.assign(ACCOUNT_HOME);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {errors.root ? (
        <p className="auth-form-error" role="alert">
          {errors.root.message}
        </p>
      ) : null}

      <div className="auth-field">
        <label htmlFor="fullName">Full name</label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          aria-invalid={errors.fullName ? "true" : "false"}
          aria-describedby={errors.fullName ? "fullName-error" : undefined}
          {...register("fullName")}
        />
        {errors.fullName ? (
          <span className="auth-field-error" id="fullName-error" role="alert">
            {errors.fullName.message}
          </span>
        ) : null}
      </div>

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

      <div className="auth-field">
        <label htmlFor="password">Password</label>
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
        <label htmlFor="confirmPassword">Confirm password</label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? "true" : "false"}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <span className="auth-field-error" id="confirmPassword-error" role="alert">
            {errors.confirmPassword.message}
          </span>
        ) : null}
      </div>

      <button className="auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>

      <p className="auth-links">
        <Link href="/login">Already have an account?</Link>
      </p>
    </form>
  );
}
