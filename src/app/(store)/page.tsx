import type { Metadata } from "next";

import { HomeView } from "@/components/storefront/home-view";

export const metadata: Metadata = {
  title: "Delta Gym Wear",
  description: "Explore the Delta Gym Wear catalog.",
  openGraph: {
    title: "Delta Gym Wear",
    description: "Explore the Delta Gym Wear catalog.",
    images: [{ url: "/design-reference/assets/product-large-normal.png", width: 638, height: 720 }],
  },
};

/** The landing route renders no catalog data, so it stays static: nothing blocks the hero. */
export default function HomePage() {
  return <HomeView />;
}
