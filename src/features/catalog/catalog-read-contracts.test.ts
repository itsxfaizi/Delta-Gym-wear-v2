import { parseCatalogSearchParams } from "./schema";
import {
  catalogFacets,
  filterPublishedProducts,
  getPublishedCollection,
} from "./queries";
import type { CatalogProduct } from "./types";

const products: readonly CatalogProduct[] = [
  {
    id: "product-alpha",
    handle: "alpha-training-top",
    title: "Alpha Training Top",
    description: "A lightweight top.",
    status: "published",
    priceAmount: 4000,
    compareAtPriceAmount: null,
    currency: "PKR",
    rating: null,
    reviewCount: 0,
    source: "database",
    images: [],
    variants: [
      { id: "alpha-black-s", sku: "ALPHA-BLK-S", color: "Black", size: "S", priceAmount: 4000, compareAtPriceAmount: null, currency: "PKR", isAvailable: true },
      { id: "alpha-sand-m", sku: "ALPHA-SND-M", color: "Sand", size: "M", priceAmount: 4000, compareAtPriceAmount: null, currency: "PKR", isAvailable: true },
    ],
  },
  {
    id: "product-bravo",
    handle: "bravo-training-short",
    title: "Bravo Training Short",
    description: "A durable short.",
    status: "published",
    priceAmount: 4000,
    compareAtPriceAmount: null,
    currency: "PKR",
    rating: null,
    reviewCount: 0,
    source: "database",
    images: [],
    variants: [
      { id: "bravo-black-m", sku: "BRAVO-BLK-M", color: "Black", size: "M", priceAmount: 4000, compareAtPriceAmount: null, currency: "PKR", isAvailable: true },
    ],
  },
  {
    id: "product-core",
    handle: "core-training-trouser",
    title: "Core Training Trouser",
    description: "A relaxed trouser.",
    status: "published",
    priceAmount: 6000,
    compareAtPriceAmount: null,
    currency: "PKR",
    rating: null,
    reviewCount: 0,
    source: "database",
    images: [],
    variants: [
      { id: "core-black-l", sku: "CORE-BLK-L", color: "Black", size: "L", priceAmount: 6000, compareAtPriceAmount: null, currency: "PKR", isAvailable: false },
    ],
  },
];

describe("catalog read contracts", () => {
  it("normalizes supported URL filters and safely defaults unknown input", () => {
    expect(
      parseCatalogSearchParams({
        q: "  TRAINING  ",
        size: [" M ", "s", "m"],
        color: [" Black", "sand", "black"],
        sort: "price-desc",
      }),
    ).toEqual({
      q: "training",
      audiences: [],
      garmentTypes: [],
      sizes: ["m", "s"],
      colors: ["black", "sand"],
      sort: "price-desc",
      maxPrice: null,
    });

    expect(
      parseCatalogSearchParams({
        q: ["first", "second"],
        size: 42 as never,
        color: " ",
        sort: "newest",
      }),
    ).toEqual({
      q: "first",
      audiences: [],
      garmentTypes: [],
      sizes: [],
      colors: [],
      sort: "featured",
      maxPrice: null,
    });
  });

  it("matches selected size and color on the same variant", () => {
    const filters = parseCatalogSearchParams({ size: "m", color: "black" });

    expect(filterPublishedProducts(products, filters).map((product) => product.handle)).toEqual([
      "bravo-training-short",
    ]);
  });

  it("keeps audience and garment type as independent filters", () => {
    const classified = products.map((product, index) => ({
      ...product,
      audience: index === 0 ? "male" as const : index === 1 ? "unisex" as const : null,
      garmentType: index === 0 ? "tops" as const : index === 1 ? "bottoms" as const : null,
    }));
    expect(filterPublishedProducts(classified, parseCatalogSearchParams({ audience: "male", garmentType: "tops" })).map((item) => item.handle))
      .toEqual(["alpha-training-top"]);
    expect(filterPublishedProducts(classified, parseCatalogSearchParams({ audience: "unisex", garmentType: "tops" }))).toEqual([]);
    expect(parseCatalogSearchParams({ audience: "unknown", garmentType: "hats" })).toMatchObject({ audiences: [], garmentTypes: [] });
  });

  it("filters query text and applies deterministic sort tie breakers", () => {
    expect(
      filterPublishedProducts(products, parseCatalogSearchParams({ q: "training", sort: "price-desc" })).map(
        (product) => product.handle,
      ),
    ).toEqual(["core-training-trouser", "alpha-training-top", "bravo-training-short"]);

    expect(
      filterPublishedProducts(products, parseCatalogSearchParams({ sort: "featured" })).map(
        (product) => product.handle,
      ),
    ).toEqual(["alpha-training-top", "bravo-training-short", "core-training-trouser"]);

    expect(
      filterPublishedProducts(products, parseCatalogSearchParams({ sort: "title-asc" })).map(
        (product) => product.handle,
      ),
    ).toEqual(["alpha-training-top", "bravo-training-short", "core-training-trouser"]);

    expect(
      filterPublishedProducts(products, parseCatalogSearchParams({ sort: "price-asc" })).map(
        (product) => product.handle,
      ),
    ).toEqual(["alpha-training-top", "bravo-training-short", "core-training-trouser"]);
  });

  it("derives the all collection from published products and returns null for unknown handles", async () => {
    await expect(getPublishedCollection("unknown", parseCatalogSearchParams({}))).resolves.toBeNull();

    await expect(
      getPublishedCollection(" ALL ", parseCatalogSearchParams({ q: "not-a-product" })),
    ).resolves.toMatchObject({
      handle: "all",
      title: "All Products",
      products: [],
    });
  });

  it("bounds the price filter to published prices and rejects junk values", () => {
    expect(parseCatalogSearchParams({ maxPrice: "5000" }).maxPrice).toBe(5000);
    expect(parseCatalogSearchParams({ maxPrice: "-1" }).maxPrice).toBeNull();
    expect(parseCatalogSearchParams({ maxPrice: "abc" }).maxPrice).toBeNull();

    expect(
      filterPublishedProducts(products, parseCatalogSearchParams({ maxPrice: "5000" })).map(
        (product) => product.handle,
      ),
    ).toEqual(["alpha-training-top", "bravo-training-short"]);
  });

  it("shows fixed category filters and derives size, colour and price facets from the catalog", () => {
    expect(catalogFacets(products)).toEqual({
      audiences: ["male", "female", "unisex"],
      garmentTypes: ["tops", "bottoms"],
      sizes: ["S", "M", "L"],
      colors: ["Black", "Sand"],
      priceBounds: { min: 4000, max: 6000 },
    });

    // A single-price catalog gets no range control rather than an inert one.
    expect(catalogFacets(products.slice(0, 1)).priceBounds).toBeNull();
  });
});
