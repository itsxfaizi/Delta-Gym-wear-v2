import type { Metadata } from "next";

import { CheckoutView } from "@/components/storefront/checkout-view";
import { getCodShippingFeeAmount } from "@/server/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutView shippingAmount={getCodShippingFeeAmount()} />;
}
