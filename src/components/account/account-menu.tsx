"use client";

import { LogIn, LogOut, MapPin, Package, Search, User, UserPlus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/server/auth/actions";

export type AccountState = { signedIn: boolean; email: string | null };

/**
 * The storefront's only entry point to /login and /account. Auth state is
 * resolved on the server and passed in: the client never talks to Supabase.
 * Rendered inside the header actions, so it is reachable at every breakpoint
 * including the mobile menu row.
 */
export function AccountMenu({ account }: { account: AccountState }) {
  const [isSigningOut, startSignOut] = useTransition();
  const label = account.signedIn ? "Your account" : "Sign in or create an account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="icon-button" aria-label={label}>
        <User size={24} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {account.signedIn ? (
          <>
            <DropdownMenuLabel>{account.email ?? "Your account"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account">
                <User aria-hidden="true" /> Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/orders">
                <Package aria-hidden="true" /> Orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/addresses">
                <MapPin aria-hidden="true" /> Addresses
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/track-order">
                <Search aria-hidden="true" /> Track an order
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isSigningOut}
              onSelect={() => startSignOut(() => signOut())}
            >
              <LogOut aria-hidden="true" /> {isSigningOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/login">
                <LogIn aria-hidden="true" /> Sign in
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/signup">
                <UserPlus aria-hidden="true" /> Create account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/track-order">
                <Search aria-hidden="true" /> Track an order
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
