import "server-only";

import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "./supabase";

export class AuthenticationError extends Error {
  public readonly code = "UNAUTHENTICATED" as const;

  constructor(message = "Authentication is required for this operation.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Resolves the authenticated Supabase user on the server. `getUser` performs
 * a server-side Auth check rather than trusting claims supplied by the client.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  // Presence check mirrors middleware.ts: without Supabase configured there is no
  // session, and getServerEnv() would throw and 500 every page that asks who is here.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AuthenticationError();
  }

  return user;
}
