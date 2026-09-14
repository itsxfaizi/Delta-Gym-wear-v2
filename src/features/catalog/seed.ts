import "server-only";

import type { CatalogProduct } from "./types";
import fs from "node:fs";
import path from "node:path";

/**
 * Temporary development-only content mapped from the approved Figma exports.
 * This must be replaced by published Supabase rows before production launch.
 */
export const DEVELOPMENT_SEED_PRODUCTS: readonly CatalogProduct[] = [
  {
    id: "dev-ease-fit-trouser",
    handle: "ease-fit-trouser",
    title: "Ease Fit Trouser",
    description: null,
    status: "published",
    priceAmount: 599900,
    compareAtPriceAmount: null,
    currency: "PKR",
    rating: null,
    reviewCount: 0,
    source: "development-seed",
    images: [
      { src: "/design-reference/assets/product-large-normal.png", alt: "Ease Fit Trouser" },
      { src: "/design-reference/assets/product-large-hover.png", alt: "Ease Fit Trouser detail" },
    ],
    catalogImage: { src: "/design-reference/assets/product-card-normal.png", alt: "Ease Fit Trouser catalog card — development seed crop" },
    catalogHoverImage: { src: "/design-reference/assets/product-card-hover.png", alt: "Ease Fit Trouser catalog card hover — development seed crop" },
    variants: [
      { id: "dev-ease-black-s", sku: "DEV-EFT-BLK-S", color: "Black", size: "S", priceAmount: 599900, compareAtPriceAmount: null, currency: "PKR", isAvailable: true, stockQuantity: 12, stockPolicy: "deny" },
      { id: "dev-ease-black-m", sku: "DEV-EFT-BLK-M", color: "Black", size: "M", priceAmount: 599900, compareAtPriceAmount: null, currency: "PKR", isAvailable: true, stockQuantity: 4, stockPolicy: "deny" },
      { id: "dev-ease-black-l", sku: "DEV-EFT-BLK-L", color: "Black", size: "L", priceAmount: 599900, compareAtPriceAmount: null, currency: "PKR", isAvailable: false, stockQuantity: 0, stockPolicy: "deny" },
      { id: "dev-ease-sand-s", sku: "DEV-EFT-SND-S", color: "Sand", size: "S", priceAmount: 599900, compareAtPriceAmount: null, currency: "PKR", isAvailable: true, stockQuantity: 0, stockPolicy: "continue" },
      { id: "dev-ease-sand-m", sku: "DEV-EFT-SND-M", color: "Sand", size: "M", priceAmount: 599900, compareAtPriceAmount: null, currency: "PKR", isAvailable: true, stockQuantity: 25, stockPolicy: "deny" },
    ],
  },
];

/** Fail fast in development when a seed references an asset that is not served locally. */
export function validateDevelopmentSeedAssets(): void {
  if (process.env.NODE_ENV === "production") return;
  const missing = DEVELOPMENT_SEED_PRODUCTS.flatMap((product) => [
    ...product.images.map((image) => image.src),
    product.catalogImage?.src,
    product.catalogHoverImage?.src,
  ].filter((src): src is string => Boolean(src)))
    .filter((src) => src.startsWith("/design-reference/"))
    .filter((src) => !fs.existsSync(path.join(process.cwd(), "public", src.slice(1))));
  if (missing.length > 0) throw new Error(`Missing development catalog assets: ${missing.join(", ")}`);
}
