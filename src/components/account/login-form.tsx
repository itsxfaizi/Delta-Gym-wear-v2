"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { safeNextPath, signInSchema, type SignInInput } from "@/features/account/schemas";
import { signIn } from "@/server/auth/actions";

export function LoginForm({ next }: { next: string | null }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignInInput) {
    const result = await signIn(values);

    if (!result.ok) {
      setError("root", { type: "server", message: result.message });
      toast.error(result.message);
      return;
    }

    toast.success("Signed in.");
    // A full navigation guarantees the server renders with the new session cookie.
    window.location.assign(safeNextPath(next));
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {errors.root ? (
        <p className="auth-form-error" role="alert">
          {errors.root.message}
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

      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
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

      <button className="auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>

      <p className="auth-links">
        <Link href="/forgot-password">Forgot password?</Link>
        <Link href="/signup">Create an account</Link>
      </p>
    </form>
  );
}
