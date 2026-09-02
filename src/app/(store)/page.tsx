import type { Metadata } from "next";
import { headers } from "next/headers";

import { HomeView, } from "@/components/storefront/home-view";
import { INTRO_BOOTSTRAP } from "@/components/storefront/home-scene";

export const dynamic = "force-dynamic";
import { listPublishedProducts } from "@/features/catalog/queries";

export const metadata: Metadata = {
  title: "Delta Gym Wear",
  description: "Explore the Delta Gym Wear catalog.",
  openGraph: {
    title: "Delta Gym Wear",
    description: "Explore the Delta Gym Wear catalog.",
    images: [{ url: "/design-reference/assets/product-large-normal.png", width: 638, height: 720 }],
  },
};

export default async function HomePage() {
  // Nonced so the strict CSP in src/middleware.ts admits it; see docs/security-headers.md.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: INTRO_BOOTSTRAP }} />
      <HomeView products={await listPublishedProducts()} />
    </>
  );
}
