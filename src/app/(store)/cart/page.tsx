import type { Metadata } from "next";

import { CartPageView } from "@/components/storefront/cart-page-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cart", robots: { index: false, follow: false } };

export default function CartPage() {
  return <CartPageView />;
}
