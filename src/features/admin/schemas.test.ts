import {
  EMPTY_PRODUCT,
  EMPTY_VARIANT,
  parseProductFilters,
  productFormSchema,
  slugify,
} from "./schemas";

const validVariant = { ...EMPTY_VARIANT, sku: "DG-1", priceAmount: "450000", stockQuantity: "12" };
const validProduct = {
  ...EMPTY_PRODUCT,
  title: "Delta Tee",
  handle: "delta-tee",
  variants: [validVariant],
};

describe("productFormSchema", () => {
  it("parses money and quantity strings into integer minor units", () => {
    const parsed = productFormSchema.parse(validProduct);

    expect(parsed.variants[0].priceAmount).toBe(450000);
    expect(parsed.variants[0].stockQuantity).toBe(12);
    expect(parsed.variants[0].compareAtPriceAmount).toBeNull();
    expect(parsed.id).toBeNull();
    expect(parsed.description).toBeNull();
  });

  it("rejects fractional or non-numeric prices", () => {
    const result = productFormSchema.safeParse({
      ...validProduct,
      variants: [{ ...validVariant, priceAmount: "4500.50" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a compare-at price that is not above the selling price", () => {
    const result = productFormSchema.safeParse({
      ...validProduct,
      variants: [{ ...validVariant, compareAtPriceAmount: "450000" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate SKUs within one product", () => {
    const result = productFormSchema.safeParse({
      ...validProduct,
      variants: [validVariant, { ...validVariant, sku: "dg-1" }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["variants", 1, "sku"]);
  });

  it("rejects handles that are not lowercase hyphenated slugs", () => {
    expect(productFormSchema.safeParse({ ...validProduct, handle: "Delta Tee" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...validProduct, handle: "delta--tee" }).success).toBe(false);
  });

  it("requires at least one variant", () => {
    expect(productFormSchema.safeParse({ ...validProduct, variants: [] }).success).toBe(false);
  });

  it("requires media entries to be full URLs", () => {
    expect(
      productFormSchema.safeParse({ ...validProduct, media: [{ objectKey: "shirt.png", altText: "" }] }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({
        ...validProduct,
        media: [{ objectKey: "https://cdn.example.com/shirt.png", altText: "" }],
      }).success,
    ).toBe(true);
  });
});

describe("slugify", () => {
  it("builds a handle from a title", () => {
    expect(slugify("Delta  Heavyweight Tee!")).toBe("delta-heavyweight-tee");
  });
});

describe("parseProductFilters", () => {
  it("defaults unknown values instead of trusting the query string", () => {
    expect(parseProductFilters({ status: "deleted", page: "-3", q: "  tee  " })).toEqual({
      q: "tee",
      status: null,
      page: 1,
    });
  });

  it("keeps a known status and page", () => {
    expect(parseProductFilters({ status: "published", page: "4" })).toEqual({
      q: "",
      status: "published",
      page: 4,
    });
  });
});
