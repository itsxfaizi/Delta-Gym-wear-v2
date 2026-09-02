import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Outfit, Oswald } from "next/font/google";

import "../styles/globals.css";

/**
 * `docs/figma-audit.md` records Outfit as the only evidenced typeface, but it was
 * never delivered: the stack named it and no font file existed, so every route
 * fell back to a system face measuring ~25% wider per unit cap height than the
 * approved export. Self-hosted through next/font; no runtime request is made.
 */
const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

/**
 * The export uses two display faces. Section headlines are condensed at roughly
 * 0.59 advance per unit cap height, where Outfit measures 0.83. The exact face is
 * not identified by any available artifact, so Oswald is the documented closest
 * fallback: measured against five headline strings from the export it lands at
 * 3.83% mean relative width error, the best of twelve candidates tested.
 * This is an approved substitution, NOT Figma-faithful typography.
 */
const oswald = Oswald({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Delta Gym Wear",
    template: "%s | Delta Gym Wear",
  },
  description: "Delta Gym Wear storefront foundation.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // suppressHydrationWarning is scoped to this element's attributes only, and it
    // is required rather than cosmetic: the pre-paint bootstrap in (store)/page.tsx
    // sets data-home-intro-state on <html> before React hydrates, so the server
    // HTML and the client DOM legitimately differ on that one attribute. Without
    // it every homepage load logs a hydration error, which would drown the console
    // checks several specs rely on. It does not suppress anything below <html>.
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${oswald.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
