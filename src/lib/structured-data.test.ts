import type { CatalogProduct } from "@/features/catalog/types";
import { breadcrumbJsonLd, organizationJsonLd, productJsonLd } from "./structured-data";

const product: CatalogProduct = {
  id: "prod-1",
  handle: "ease-fit-tee",
  title: "Ease Fit Tee",
  description: "Everyday training tee.",
  status: "published",
  priceAmount: 599_900,
  compareAtPriceAmount: null,
  currency: "PKR",
  rating: 4.5,
  reviewCount: 12,
  source: "development-seed",
  images: [{ src: "/design-reference/assets/tee.avif", alt: "Ease Fit Tee" }],
  variants: [
    { id: "v1", sku: "S1", color: "Black", size: "S", priceAmount: 599_900, compareAtPriceAmount: null, currency: "PKR", isAvailable: false },
    { id: "v2", sku: "S2", color: "Black", size: "M", priceAmount: 599_900, compareAtPriceAmount: null, currency: "PKR", isAvailable: true },
  ],
};

describe("productJsonLd", () => {
  it("builds a Product with a PKR offer priced in major units", () => {
    expect(productJsonLd(product)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Ease Fit Tee",
      url: "http://localhost:3000/products/ease-fit-tee",
      image: ["http://localhost:3000/design-reference/assets/tee.avif"],
      brand: { "@type": "Brand", name: "Delta Gym Wear" },
      offers: {
        "@type": "Offer",
        priceCurrency: "PKR",
        price: "5999.00",
        availability: "https://schema.org/InStock",
      },
      aggregateRating: { "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 12 },
    });
  });

  it("marks a product out of stock when no variant is available", () => {
    const soldOut = { ...product, variants: product.variants.map((v) => ({ ...v, isAvailable: false })) };
    expect(productJsonLd(soldOut).offers).toMatchObject({ availability: "https://schema.org/OutOfStock" });
  });

  it("omits optional fields that have no value", () => {
    const bare = { ...product, description: null, images: [], rating: null, reviewCount: 0 };
    const json = productJsonLd(bare);
    expect(json).not.toHaveProperty("description");
    expect(json).not.toHaveProperty("image");
    expect(json).not.toHaveProperty("aggregateRating");
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers positions from one and absolutizes paths", () => {
    expect(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }])).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "http://localhost:3000/" },
        { "@type": "ListItem", position: 2, name: "Shop", item: "http://localhost:3000/shop" },
      ],
    });
  });

  it("returns an empty list for an empty trail", () => {
    expect(breadcrumbJsonLd([]).itemListElement).toEqual([]);
  });
});

describe("organizationJsonLd", () => {
  it("names the store and links its logo", () => {
    expect(organizationJsonLd()).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Delta Gym Wear",
      url: "http://localhost:3000",
      logo: "http://localhost:3000/design-reference/assets/delta-logo.svg",
    });
  });
});
