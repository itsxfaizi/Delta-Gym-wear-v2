import type { CatalogProduct } from "@/features/catalog/types";
import { formatMoneyAmount } from "@/lib/money";

/** Absolute origin for canonical URLs; mirrors the metadataBase in app/layout.tsx. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export type JsonLdObject = Record<string, unknown>;

export type BreadcrumbTrailItem = { name: string; path: string };

export const ORGANIZATION_NAME = "Delta Gym Wear";

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORGANIZATION_NAME,
    url: siteUrl(),
    logo: absoluteUrl("/design-reference/assets/delta-logo.svg"),
  };
}

export function breadcrumbJsonLd(trail: readonly BreadcrumbTrailItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function productJsonLd(product: CatalogProduct): JsonLdObject {
  const inStock = product.variants.some((variant) => variant.isAvailable);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    url: absoluteUrl(`/products/${product.handle}`),
    ...(product.description ? { description: product.description } : {}),
    ...(product.images.length > 0 ? { image: product.images.map((image) => absoluteUrl(image.src)) } : {}),
    brand: { "@type": "Brand", name: ORGANIZATION_NAME },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/products/${product.handle}`),
      priceCurrency: product.currency,
      price: formatMoneyAmount(product.priceAmount),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(product.rating !== null && product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };
}
