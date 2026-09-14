import { z } from "zod";

import { STOCK_POLICIES } from "@/features/catalog/types";

export const PRODUCT_STATUSES = ["draft", "published", "unpublished", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** Roles that may open the admin console at all; write roles are narrower. */
export const ADMIN_ROLES = ["owner", "catalog_editor", "publisher", "auditor"] as const;
export const PRODUCT_EDITOR_ROLES = ["owner", "catalog_editor"] as const;
export const PRODUCT_PUBLISHER_ROLES = ["owner", "publisher"] as const;

export const ADMIN_PAGE_SIZE = 20;

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Form inputs are strings; the schema is the single string -> minor-units boundary. */
const requiredMinorUnits = z
  .string()
  .trim()
  .regex(/^\d{1,9}$/, "Enter a whole amount in paisa.")
  .transform(Number);

const optionalMinorUnits = z
  .string()
  .trim()
  .regex(/^\d{0,9}$/, "Enter a whole amount in paisa.")
  .transform((value) => (value === "" ? null : Number(value)));

const quantity = z
  .string()
  .trim()
  .regex(/^\d{1,7}$/, "Enter a whole number of units.")
  .transform(Number);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((value) => value || null);

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const productVariantFormSchema = z
  .object({
    id: z.string().transform((value) => value || null),
    sku: z.string().trim().min(1, "A SKU is required.").max(64),
    size: optionalText(32),
    color: optionalText(32),
    priceAmount: requiredMinorUnits,
    compareAtPriceAmount: optionalMinorUnits,
    stockQuantity: quantity,
    stockPolicy: z.enum(STOCK_POLICIES),
    isAvailable: z.boolean(),
  })
  .refine(
    (variant) =>
      variant.compareAtPriceAmount === null || variant.compareAtPriceAmount > variant.priceAmount,
    { message: "The compare-at price must be above the selling price.", path: ["compareAtPriceAmount"] },
  );

/**
 * Media is stored as a URL until a Supabase Storage bucket exists; objectKey
 * already holds an arbitrary string, so no schema change is needed later.
 */
export const productMediaFormSchema = z.object({
  objectKey: z.string().trim().url("Enter a full image URL."),
  altText: optionalText(160),
});

export const productFormSchema = z
  .object({
    id: z.string().transform((value) => value || null),
    title: z.string().trim().min(1, "A title is required.").max(120),
    handle: z
      .string()
      .trim()
      .min(1, "A handle is required.")
      .max(80)
      .regex(HANDLE_PATTERN, "Use lowercase words separated by single hyphens."),
    description: optionalText(4000),
    status: z.enum(PRODUCT_STATUSES),
    variants: z.array(productVariantFormSchema).min(1, "Add at least one variant."),
    media: z.array(productMediaFormSchema),
  })
  .superRefine((product, context) => {
    const seen = new Set<string>();
    product.variants.forEach((variant, index) => {
      const sku = variant.sku.toLowerCase();
      if (seen.has(sku)) {
        context.addIssue({
          code: "custom",
          message: "SKUs must be unique within a product.",
          path: ["variants", index, "sku"],
        });
      }
      seen.add(sku);
    });
  });

export type ProductFormValues = z.input<typeof productFormSchema>;
export type ProductFormInput = z.output<typeof productFormSchema>;
export type VariantFormValues = z.input<typeof productVariantFormSchema>;

export const EMPTY_VARIANT: VariantFormValues = {
  id: "",
  sku: "",
  size: "",
  color: "",
  priceAmount: "",
  compareAtPriceAmount: "",
  stockQuantity: "0",
  stockPolicy: "deny",
  isAvailable: true,
};

export const EMPTY_PRODUCT: ProductFormValues = {
  id: "",
  title: "",
  handle: "",
  description: "",
  status: "draft",
  variants: [EMPTY_VARIANT],
  media: [],
};

export type ActionResult = { ok: true; id: string } | { ok: false; message: string };

export type AdminProductFilters = {
  q: string;
  status: ProductStatus | null;
  page: number;
};

/** Normalizes untrusted `searchParams` into a filter the list query can trust. */
export function parseProductFilters(params: Record<string, string | string[] | undefined>): AdminProductFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const status = first(params.status);
  const page = Number.parseInt(first(params.page), 10);

  return {
    q: first(params.q).trim().slice(0, 80),
    status: (PRODUCT_STATUSES as readonly string[]).includes(status) ? (status as ProductStatus) : null,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}
