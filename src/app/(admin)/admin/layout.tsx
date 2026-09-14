import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { NewOrderAlerts } from "@/components/admin/new-order-alerts";
import { readOrderAlertSnapshot } from "@/server/admin/alerts";
import { loginRedirectPath } from "@/features/account/schemas";
import { resolveAdminAccess } from "@/server/admin/guard";

import "../../../styles/admin.css";

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
      <div data-route-surface="admin" className="admin-forbidden">
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

  return (
    <div data-route-surface="admin">
      <AdminShell role={access.principal.membership.role}>
        {await (async () => {
          const snapshot = await readOrderAlertSnapshot();
          return <NewOrderAlerts key={snapshot.latestPlacedAt ?? "none"} snapshot={snapshot} />;
        })()}
        {children}
      </AdminShell>
    </div>
  );
}
