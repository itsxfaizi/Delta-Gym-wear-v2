import type { Metadata } from "next";

import { CatalogView } from "@/components/storefront/catalog-view";

export const dynamic = "force-dynamic";
import { catalogFacets, filterPublishedProducts, listPublishedProducts } from "@/features/catalog/queries";
import { parseCatalogSearchParams } from "@/features/catalog/schema";

export const metadata: Metadata = { title: "Shop", description: "Browse the Delta Gym Wear catalog." };

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseCatalogSearchParams(await searchParams);
  // One read of the published catalog serves both the filtered grid and the
  // filter rail's options, so a narrow filter never hides its own controls.
  const published = await listPublishedProducts();
  return <CatalogView products={filterPublishedProducts(published, filters)} filters={filters} facets={catalogFacets(published)} />;
}
