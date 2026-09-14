import Link from "next/link";
import type { Metadata } from "next";

import "../styles/not-found.css";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="not-found" id="main-content">
      <p className="not-found__code">Error 404</p>
      <h1 className="not-found__title">This page left the gym</h1>
      <p className="not-found__body">
        The page you were looking for has moved, been retired, or never existed. The rest of the
        Delta Gym Wear catalog is still where you left it.
      </p>
      <div className="not-found__actions">
        <Link href="/">Back to home</Link>
        <Link href="/shop">Shop all products</Link>
      </div>
    </main>
  );
}
