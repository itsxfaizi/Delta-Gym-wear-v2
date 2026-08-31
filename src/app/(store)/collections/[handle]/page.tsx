import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogView } from "@/components/storefront/catalog-view";

export const dynamic = "force-dynamic";
import { getPublishedCollection } from "@/features/catalog/queries";
import { parseCatalogSearchParams } from "@/features/catalog/schema";

type CollectionPageProps = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { handle } = await params;
  if (handle !== "all") return { title: "Collection not found" };
  return { title: "All Products", description: "Browse the complete Delta Gym Wear catalog." };
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const [{ handle }, rawSearchParams] = await Promise.all([params, searchParams]);
  const filters = parseCatalogSearchParams(rawSearchParams);
  const collection = await getPublishedCollection(handle, filters);
  if (!collection) notFound();
  return <CatalogView title={collection.title} products={collection.products} filters={filters} />;
}
