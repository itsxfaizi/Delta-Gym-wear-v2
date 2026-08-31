import type { Metadata } from "next";

import { CatalogView } from "@/components/storefront/catalog-view";

export const dynamic = "force-dynamic";
import { queryPublishedProducts } from "@/features/catalog/queries";
import { parseCatalogSearchParams } from "@/features/catalog/schema";

export const metadata: Metadata = { title: "Shop", description: "Browse the Delta Gym Wear catalog." };

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseCatalogSearchParams(await searchParams);
  return <CatalogView products={await queryPublishedProducts(filters)} filters={filters} />;
}
