"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/promotions", label: "Promo codes" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/audit", label: "Audit log", ownerOnly: true },
] as const;

export function isCurrentAdminLink(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/** The section title the shell shows in its top bar. */
export function adminSectionTitle(pathname: string): string {
  const match = [...ADMIN_LINKS].reverse().find((link) => isCurrentAdminLink(link.href, pathname));
  return match?.label ?? "Admin";
}

export function AdminNav({ onNavigate, role }: { onNavigate?: () => void; role?: string }) {
  const pathname = usePathname();
  const links = ADMIN_LINKS.filter((link) => !("ownerOnly" in link) || role === "owner");

  return (
    <nav className="admin-nav" aria-label="Admin">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={isCurrentAdminLink(href, pathname) ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
