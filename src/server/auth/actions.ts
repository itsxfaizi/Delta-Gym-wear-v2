"use server";

import { redirect } from "next/navigation";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ActionResult,
} from "@/features/account/schemas";
import { createDatabase } from "@/server/db";
import { customers } from "@/server/db/schema";
import { getCatalogTenantId, getServerEnv } from "@/server/env";

import { createSupabaseServerClient } from "./supabase";

/** Auth failures are returned as data; an uncaught throw would leak a stack to the client. */
function failure(message: string): ActionResult {
  return { ok: false, message };
}

/**
 * Keeps the tenant's customer record in step with the Supabase identity. It is
 * a no-op without a database so signup still works in a catalog-only install.
 */
async function upsertCustomer(input: {
  authUserId: string;
  email: string;
  fullName: string;
}): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  await createDatabase()
    .insert(customers)
    .values({
      tenantId: getCatalogTenantId(),
      authUserId: input.authUserId,
      email: input.email,
      fullName: input.fullName,
    })
    .onConflictDoUpdate({
      target: [customers.tenantId, customers.email],
      set: { authUserId: input.authUserId, fullName: input.fullName, updatedAt: new Date() },
    });
}

export async function signUp(rawInput: unknown): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(rawInput);
  if (!parsed.success) return failure("Check the highlighted fields and try again.");

  const { email, password, fullName } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${getServerEnv().APP_URL}/auth/callback`,
    },
  });

  if (error) {
    // Generic on purpose: the raw Supabase message ("User already registered") turns
    // signup into an account-enumeration oracle. signIn and reset are already generic.
    console.error("signUp failed", error);
    return failure("We could not create that account. Check your details and try again.");
  }

  if (data.user) {
    try {
      await upsertCustomer({ authUserId: data.user.id, email, fullName });
    } catch {
      // The identity exists; a failed profile write must not block sign-up.
      return { ok: true };
    }
  }

  return { ok: true };
}

export async function signIn(rawInput: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(rawInput);
  if (!parsed.success) return failure("Check the highlighted fields and try again.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  // Deliberately generic: never reveal whether the email exists.
  if (error) return failure("That email and password combination is not recognised.");

  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(rawInput: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(rawInput);
  if (!parsed.success) return failure("Enter a valid email address.");

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getServerEnv().APP_URL}/auth/callback?next=/reset-password`,
  });

  // Always reports success so the endpoint cannot be used to enumerate accounts.
  return { ok: true };
}

/**
 * Completes a reset: the recovery link is exchanged for a session by
 * /auth/callback, so by the time this runs Supabase has an authenticated user.
 */
export async function updatePassword(rawInput: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) return failure("Check the password fields and try again.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    console.error("updatePassword failed", error);
    return failure("That reset link has expired. Request a new one.");
  }

  return { ok: true };
}
