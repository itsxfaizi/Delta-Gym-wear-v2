import type { ReactNode } from "react";

/** Structural boundary for future authenticated admin routes. */
export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div data-route-surface="admin">{children}</div>;
}
