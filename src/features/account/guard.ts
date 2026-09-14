import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/server/auth/session";

import { loginRedirectPath } from "./schemas";

/**
 * Server-side gate for /account/**. Client-side checks are never sufficient:
 * the page must not render for an anonymous visitor at all.
 */
export async function requireAccountUser(currentPath: string): Promise<User> {
  const user = await getAuthenticatedUser();
  if (!user) redirect(loginRedirectPath(currentPath));
  return user;
}
