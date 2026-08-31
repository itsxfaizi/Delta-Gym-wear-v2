import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getPublicSupabaseConfig, getServiceRoleKey } from "../env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always mutate cookies. Middleware or a
          // route handler remains responsible for refreshing the session.
        }
      },
    },
  });
}

/**
 * This client bypasses RLS and is intentionally unavailable to browser code.
 * Callers must use it only for an explicitly reviewed server-side operation.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  const { url } = getPublicSupabaseConfig();

  return createClient(url, getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
