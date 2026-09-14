"use client";

import { LayoutDashboard, Package, ScrollText, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", Icon: Package },
  { href: "/admin/orders", label: "Orders", Icon: ScrollText },
  { href: "/admin/customers", label: "Customers", Icon: Users },
] as const;

export function isCurrentAdminLink(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/** The section title the shell shows in its top bar. */
export function adminSectionTitle(pathname: string): string {
  const match = [...ADMIN_LINKS].reverse().find((link) => isCurrentAdminLink(link.href, pathname));
  return match?.label ?? "Admin";
}

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Admin">
      {ADMIN_LINKS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={isCurrentAdminLink(href, pathname) ? "page" : undefined}
        >
          <Icon aria-hidden size={16} strokeWidth={2} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
