import type { MetadataRoute } from "next";

import { listPublishedProducts } from "@/features/catalog/queries";
import { siteUrl } from "@/lib/structured-data";

const STATIC_PATHS = ["/", "/shop", "/collections/all"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const lastModified = new Date();

  // The catalog read falls back to seed content without DATABASE_URL and is
  // disabled outright in the production runtime, so a failure must not take
  // the sitemap down with it.
  const products = await listPublishedProducts().catch(() => []);

  return [
    ...STATIC_PATHS.map((path) => ({
      url: `${base}${path}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: path === "/" ? 1 : 0.8,
    })),
    ...products.map((product) => ({
      url: `${base}/products/${product.handle}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
