import type { Metadata } from "next";

import { HomeView } from "@/components/storefront/home-view";

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
  return <HomeView products={await listPublishedProducts()} />;
}
