import { z } from "zod";

import type { CatalogProduct, CatalogVariant } from "./types";

export const cartLineInputSchema = z.object({
  productHandle: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  variantId: z.string().min(1).max(128),
  quantity: z.number().int().min(1).max(99),
});

export type CartLineInput = z.infer<typeof cartLineInputSchema>;

export type ResolvedCartLine = {
  key: string;
  product: CatalogProduct;
  variant: CatalogVariant;
  quantity: number;
};

export function validateCartLine(input: unknown): CartLineInput {
  return cartLineInputSchema.parse(input);
}

const storedCartSchema = z.array(cartLineInputSchema).max(100);

/** Resolves untrusted browser storage against the current published catalog. */
export function restoreCartLines(
  storedValue: unknown,
  catalog: readonly CatalogProduct[],
): ResolvedCartLine[] {
  const parsed = storedCartSchema.safeParse(storedValue);
  if (!parsed.success) return [];

  return parsed.data.flatMap((input) => {
    const product = catalog.find((candidate) => candidate.handle === input.productHandle);
    const variant = product?.variants.find((candidate) => candidate.id === input.variantId && candidate.isAvailable);
    if (!product || !variant) return [];
    return [{ key: `${product.handle}:${variant.id}`, product, variant, quantity: input.quantity }];
  });
}

export function serializeCartLines(lines: readonly ResolvedCartLine[]): CartLineInput[] {
  return lines.map((line) => ({
    productHandle: line.product.handle,
    variantId: line.variant.id,
    quantity: line.quantity,
  }));
}

/** Cart is intentionally browser-persistent for launch; no customer/order data is stored server-side. */
export function cartStorageKey(scope = "public"): string {
  return `delta-cart:${scope}`;
}
