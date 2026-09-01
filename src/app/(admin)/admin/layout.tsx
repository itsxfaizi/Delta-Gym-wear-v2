import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { resolveTenantPrincipal } from "@/server/authorization/principal";

/**
 * The gate for the admin route group. It lives in the layout, not in a page,
 * so every future admin page inherits it and cannot forget it, and it fails
 * closed: no active membership, no admin tree, whatever the page below does.
 *
 * `notFound()` rather than a 403 screen. It keeps the response non-disclosing
 * (an outsider cannot tell an admin surface exists here) and it keeps `/admin`
 * a 404 while decision O-002 blocks the admin UI, so the gate is proved by
 * `src/app/route-guards.test.tsx` rather than by a screen.
 */
export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await resolveTenantPrincipal())) notFound();
  return <div data-route-surface="admin">{children}</div>;
}
