import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/features/catalog/types";
import { formatMoney } from "@/features/catalog/money";

/** First grid row is eager so the catalog's LCP image is not deferred. */
const EAGER_CARD_COUNT = 3;

export function ProductCard({ product, index = 0 }: { product: CatalogProduct; index?: number }) {
  const image = product.images[0];
  const price = formatMoney(product.priceAmount, product.currency);
  // The seed disclaimer belongs only to development seed content, never to a
  // real published product's alt text.
  const seedNote = product.source === "development-seed" ? " — development seed image" : "";

  return (
    <article className="product-card">
      <Link href={`/products/${product.handle}`} className="product-image-link" aria-label={`${product.title}, ${price}`}>
        <Image
          src={image?.src ?? ""}
          alt={`${image?.alt || product.title}${seedNote}`}
          fill
          sizes="(max-width: 31rem) 92vw, (max-width: 64rem) 46vw, 30vw"
          loading={index < EAGER_CARD_COUNT ? "eager" : "lazy"}
        />
      </Link>
      <div className="product-card-info">
        <h2><Link href={`/products/${product.handle}`}>{product.title}</Link></h2>
        <p>{price}</p>
      </div>
    </article>
  );
}
