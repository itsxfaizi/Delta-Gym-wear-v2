"use client";

import { Menu, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { SignOutButton } from "@/components/account/sign-out-button";
import { AdminNav, adminSectionTitle } from "@/components/admin/admin-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * The admin frame: a persistent sidebar on wide screens, the same navigation in a
 * sheet below it, and one top bar carrying the section title, order search and profile.
 */
export function AdminShell({ role, children }: { role: string; children: ReactNode }) {
  const pathname = usePathname();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const title = adminSectionTitle(pathname);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          Delta<span>admin</span>
        </Link>
        <AdminNav />
        <p className="admin-sidebar-foot">Cash on delivery console</p>
      </aside>

      <div className="admin-frame">
        <header className="admin-bar">
          <Sheet open={isMenuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger className="admin-icon-button admin-menu-button" aria-label="Open navigation">
              <Menu aria-hidden size={20} />
            </SheetTrigger>
            <SheetContent side="left" className="admin-sheet">
              <SheetHeader>
                <SheetTitle>Delta admin</SheetTitle>
              </SheetHeader>
              <AdminNav onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>

          <p className="admin-bar-title">{title}</p>

          <form className="admin-search" action="/admin/orders" role="search">
            <label className="admin-visually-hidden" htmlFor="admin-search-input">
              Search orders
            </label>
            <Search aria-hidden size={16} />
            <input
              id="admin-search-input"
              name="q"
              type="search"
              placeholder="Search orders, phone, email"
              autoComplete="off"
            />
          </form>

          <DropdownMenu>
            <DropdownMenuTrigger className="admin-icon-button" aria-label={`Signed in as ${role}`}>
              <UserRound aria-hidden size={20} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="admin-profile-menu">
              <DropdownMenuLabel>{role.replace("_", " ")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/">View store</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/account">Account</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <SignOutButton />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="admin-main" id="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
