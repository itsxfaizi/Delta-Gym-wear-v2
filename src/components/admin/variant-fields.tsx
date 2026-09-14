"use client";

import type { UseFormReturn } from "react-hook-form";

import { STOCK_POLICIES } from "@/features/catalog/types";
import type { ProductFormInput, ProductFormValues } from "@/features/admin/schemas";

import { StockAdjustControl } from "./stock-adjust-control";

export type ProductForm = UseFormReturn<ProductFormValues, unknown, ProductFormInput>;

const TEXT_FIELDS = [
  { name: "sku", label: "SKU", required: true },
  { name: "size", label: "Size", required: false },
  { name: "color", label: "Colour", required: false },
] as const;

const NUMBER_FIELDS = [
  { name: "priceAmount", label: "Price (paisa)" },
  { name: "compareAtPriceAmount", label: "Compare at (paisa)" },
  { name: "stockQuantity", label: "Stock" },
] as const;

/** One variant row of the product form; prices are entered in PKR minor units. */
export function VariantFields({
  form,
  index,
  onRemove,
  canRemove,
}: {
  form: ProductForm;
  index: number;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { register, formState, watch, setValue } = form;
  const errors = formState.errors.variants?.[index];
  const variantId = watch(`variants.${index}.id`);
  const currentStock = watch(`variants.${index}.stockQuantity`);

  return (
    <li className="admin-repeat-item">
      <div className="admin-repeat-head">
        <span>Variant {index + 1}</span>
        {canRemove ? (
          <button className="admin-button admin-button--danger" type="button" onClick={onRemove}>
            Remove
          </button>
        ) : null}
      </div>

      <input type="hidden" {...register(`variants.${index}.id`)} />

      <div className="admin-form-row">
        {TEXT_FIELDS.map((field) => (
          <div className="admin-field" key={field.name}>
            <label htmlFor={`variant-${index}-${field.name}`}>{field.label}</label>
            <input
              id={`variant-${index}-${field.name}`}
              aria-invalid={errors?.[field.name] ? "true" : "false"}
              {...register(`variants.${index}.${field.name}`)}
            />
            {errors?.[field.name] ? (
              <span className="admin-error" role="alert">
                {errors[field.name]?.message}
              </span>
            ) : null}
          </div>
        ))}

        {NUMBER_FIELDS.map((field) => (
          <div className="admin-field" key={field.name}>
            <label htmlFor={`variant-${index}-${field.name}`}>{field.label}</label>
            <input
              id={`variant-${index}-${field.name}`}
              inputMode="numeric"
              aria-invalid={errors?.[field.name] ? "true" : "false"}
              {...register(`variants.${index}.${field.name}`)}
            />
            {errors?.[field.name] ? (
              <span className="admin-error" role="alert">
                {errors[field.name]?.message}
              </span>
            ) : null}
          </div>
        ))}

        <div className="admin-field">
          <label htmlFor={`variant-${index}-stockPolicy`}>Stock policy</label>
          <select id={`variant-${index}-stockPolicy`} {...register(`variants.${index}.stockPolicy`)}>
            {STOCK_POLICIES.map((policy) => (
              <option key={policy} value={policy}>
                {policy === "deny" ? "Deny when out of stock" : "Continue selling (backorder)"}
              </option>
            ))}
          </select>
        </div>

        <label className="admin-checkbox">
          <input type="checkbox" {...register(`variants.${index}.isAvailable`)} />
          Available
        </label>

        <StockAdjustControl
          variantId={variantId || null}
          sku={String(form.getValues(`variants.${index}.sku`) || "this variant")}
          stockQuantity={Number(currentStock) || 0}
          onAdjusted={(next) => setValue(`variants.${index}.stockQuantity`, String(next))}
        />
      </div>
    </li>
  );
}
