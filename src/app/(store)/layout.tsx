import type { ReactNode } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import type { AccountState } from "@/components/account/account-menu";
import { listPublishedProducts } from "@/features/catalog/queries";
import { getAuthenticatedUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** Resolved here so the header never has to ask Supabase from the client. */
async function loadAccountState(): Promise<AccountState> {
  try {
    const user = await getAuthenticatedUser();
    return user ? { signedIn: true, email: user.email ?? null } : { signedIn: false, email: null };
  } catch {
    // Supabase not configured in this environment: the storefront renders signed out.
    return { signedIn: false, email: null };
  }
}

/** Structural boundary for future public storefront routes. */
export default async function StoreLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [catalog, account] = await Promise.all([listPublishedProducts(), loadAccountState()]);
  return (
    <div data-route-surface="store">
      <StorefrontShell catalog={catalog} account={account}>
        {children}
      </StorefrontShell>
    </div>
  );
}
