import "server-only";

import { getCustomerByAuthUserId } from "@/features/account/queries";
import { getAuthenticatedUser } from "@/server/auth/session";

/** Resolves the signed-in customer id for the cart routes; null for a guest or an unconfigured Supabase/DB. */
export async function resolveAuthenticatedCustomerId(): Promise<string | null> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return null;
    const customer = await getCustomerByAuthUserId(user.id);
    return customer?.id ?? null;
  } catch {
    return null;
  }
}
