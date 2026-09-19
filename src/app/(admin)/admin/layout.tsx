import { IBM_Plex_Mono, Outfit } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { NewOrderAlerts } from "@/components/admin/new-order-alerts";
import { Toaster } from "@/components/ui/sonner";
import { readOrderAlertSnapshot } from "@/server/admin/alerts";
import { loginRedirectPath } from "@/features/account/schemas";
import { resolveAdminAccess } from "@/server/admin/guard";

import "../../../styles/admin.css";

// Scoped to this segment on purpose: the storefront keeps its own type stack.
// Outfit ships a variable axis, which the console's 650/750 weights need.
const outfit = Outfit({ subsets: ["latin"], variable: "--admin-font-ui" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--admin-font-mono" });
const fontClass = `${outfit.variable} ${plexMono.variable}`;

export const metadata = { title: "Delta admin" };

/**
 * The whole /admin segment is gated here, on the server. No page below this
 * layout renders for a visitor without an active tenant membership.
 */
export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const access = await resolveAdminAccess();

  if (access.state === "unauthenticated") redirect(loginRedirectPath("/admin"));

  if (access.state === "forbidden") {
    return (
      <div data-route-surface="admin" className={`${fontClass} admin-forbidden`}>
        <div>
          <h1>403 — no access</h1>
          <p className="admin-hint">
            Your account is signed in but has no active membership for this store.
          </p>
          <Link className="admin-button" href="/">
            Back to the store
          </Link>
        </div>
      </div>
    );
  }

  const snapshot = await readOrderAlertSnapshot();

  return (
    <div data-route-surface="admin" className={fontClass}>
      <AdminShell role={access.principal.membership.role} awaitingCall={snapshot.pendingConfirmation}>
        <NewOrderAlerts key={snapshot.latestPlacedAt ?? "none"} snapshot={snapshot} />
        {children}
      </AdminShell>
      {/* Every admin mutation reports through toast; without this the whole
          console fails silently — a rejected save simply did nothing. */}
      <Toaster position="top-center" />
    </div>
  );
}
