import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedProduct } from "@/features/catalog/queries";
import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { moneyAmountForStructuredData } from "@/features/catalog/money";
type ProductRouteProps = { params: Promise<{ handle: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  const product = await getPublishedProduct((await params).handle);
  if (!product) return { title: "Product not found" };
  return { title: product.title, description: product.description ?? undefined, openGraph: { title: product.title, description: product.description ?? undefined, images: product.images[0]?.src ? [product.images[0].src] : undefined } };
}

export default async function ProductPage({ params }: ProductRouteProps) {
  const product = await getPublishedProduct((await params).handle);
  if (!product) notFound();
  const hasStock = product.variants.some((variant) => variant.isAvailable);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    image: product.images.map((image) => image.src),
    brand: { "@type": "Brand", name: "Delta Gym Wear" },
    ...(product.source === "database" ? { offers: { "@type": "Offer", priceCurrency: product.currency, price: moneyAmountForStructuredData(product.priceAmount), availability: hasStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } } : {}),
    ...(product.rating !== null && product.reviewCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount } } : {}),
  };
  const serializedStructuredData = JSON.stringify(structuredData).replaceAll("<", "\\u003c");
  // Carries the request nonce so the block stays valid under the strict CSP set
  // in src/middleware.ts. It is not executable, but script-src governs every
  // <script> element, so relying on the CSP2 'unsafe-inline' fallback would mean
  // relying on the token that nonce-aware browsers ignore.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <><ProductDetailView product={product} /><script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: serializedStructuredData }} /></>;
}
