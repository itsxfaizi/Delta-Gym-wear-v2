import Link from "next/link";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";

import "../../styles/account.css";

/** Standalone shell: the auth routes intentionally skip the storefront chrome. */
export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="auth-page" data-route-surface="auth">
      <main className="auth-panel" id="main-content">
        <Link className="auth-brand" href="/">
          Delta Gym Wear
        </Link>
        {children}
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
