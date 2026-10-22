import { checkoutInputSchema } from "./schemas";

// Browser form values before the resolver runs: optional text inputs submit "".
const checkoutFormInput = {
  contactEmail: "shopper@example.com",
  contactPhone: "03001234567",
  shippingAddress: {
    fullName: "Test Shopper", phone: "03001234567", line1: "123 Main Road",
    line2: "", city: "Lahore", province: "Punjab", postalCode: "", country: "PK",
  },
  notes: "",
  promoCode: "",
  lines: [{ productVariantId: "airflow-stringer-tank-black-m", quantity: 1 }],
};

describe("checkout optional promo input", () => {
  it.each(["", "  \t\n", null, undefined])("accepts a normal checkout with a blank or absent promo code", (promoCode) => {
    const parsed = checkoutInputSchema.parse({ ...checkoutFormInput, promoCode });
    expect(parsed.promoCode).toBeNull();
    expect(checkoutInputSchema.parse(parsed)).toEqual(parsed);
  });

  it("normalizes a real code while retaining it for server validation", () => {
    expect(checkoutInputSchema.parse({ ...checkoutFormInput, promoCode: " delta_10 " }).promoCode).toBe("DELTA_10");
  });

  it.each(["ab", "CODE WITH SPACE", "<script>", 123])("rejects invalid nonempty promo input", (promoCode) => {
    const parsed = checkoutInputSchema.safeParse({ ...checkoutFormInput, promoCode });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].path).toEqual(["promoCode"]);
  });
});
