import type { ReactNode } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { listPublishedProducts } from "@/features/catalog/queries";

/** Structural boundary for future public storefront routes. */
export default async function StoreLayout({ children }: Readonly<{ children: ReactNode }>) {
  const catalog = await listPublishedProducts();
  return <div data-route-surface="store"><StorefrontShell catalog={catalog}>{children}</StorefrontShell></div>;
}
