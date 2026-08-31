import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/features/catalog/types";
import { formatMoney } from "@/features/catalog/money";

export function ProductCard({ product }: { product: CatalogProduct }) {
  const image = product.images[0];
  return (
    <article className="product-card">
      <Link href={`/products/${product.handle}`} className="product-image-link" aria-label={`${product.title}, ${formatMoney(product.priceAmount, product.currency)}`}>
        <Image src={image?.src ?? ""} alt={`${image?.alt || product.title} — development seed image`} fill sizes="(max-width: 31rem) 92vw, (max-width: 64rem) 46vw, 30vw" loading="eager" />
      </Link>
      <div className="product-card-info">
        <h2><Link href={`/products/${product.handle}`}>{product.title}</Link></h2>
        <p>{formatMoney(product.priceAmount, product.currency)}</p>
      </div>
    </article>
  );
}
