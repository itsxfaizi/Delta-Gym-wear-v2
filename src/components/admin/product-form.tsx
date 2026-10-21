"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState } from "react";

import { saveProduct } from "@/features/admin/actions";
import {
  EMPTY_PRODUCT,
  EMPTY_VARIANT,
  CREATABLE_STATUSES,
  GARMENT_TYPES,
  PRODUCT_AUDIENCES,
  PRODUCT_STATUSES,
  productFormSchema,
  slugify,
  type ProductFormInput,
  type ProductFormValues,
} from "@/features/admin/schemas";

import { MediaFields } from "./media-fields";
import { StatusSelect } from "./status-select";
import { VariantFields } from "./variant-fields";

export function ProductForm({ product }: { product?: ProductFormValues }) {
  const router = useRouter();
  const [saveError, setSaveError] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const form = useForm<ProductFormValues, unknown, ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product ?? EMPTY_PRODUCT,
  });
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const variants = useFieldArray({ control, name: "variants" });

  async function onSubmit(values: ProductFormInput) {
    setSaveError("");
    let result: Awaited<ReturnType<typeof saveProduct>>;
    try {
      result = await saveProduct(values);
    } catch {
      setSaveError("The save request could not reach the server. Check your connection and try again.");
      return;
    }

    if (!result.ok) {
      setSaveError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success(product?.id ? "Product saved." : "Product created.");
    router.push(`/admin/products/${result.id}`);
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit(onSubmit, () => setSaveError("Check the highlighted fields and try again."))} noValidate>
      <input type="hidden" {...register("id")} />

      <section className="admin-panel">
        <h2>Details</h2>
        <div className="admin-form-row">
          <div className="admin-field admin-field--wide">
            <label htmlFor="product-title">Title</label>
            <input id="product-title" aria-invalid={errors.title ? "true" : "false"} {...register("title")} />
            {errors.title ? (
              <span className="admin-error" role="alert">
                {errors.title.message}
              </span>
            ) : null}
          </div>

          <div className="admin-field admin-field--wide">
            <label htmlFor="product-handle">Handle</label>
            <input id="product-handle" aria-invalid={errors.handle ? "true" : "false"} {...register("handle")} />
            {errors.handle ? (
              <span className="admin-error" role="alert">
                {errors.handle.message}
              </span>
            ) : null}
            <button
              className="admin-button"
              type="button"
              onClick={() => setValue("handle", slugify(getValues("title")), { shouldValidate: true })}
            >
              Generate from title
            </button>
          </div>

          <div className="admin-field">
            <label htmlFor="product-status">Status</label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <StatusSelect
                  id="product-status"
                  value={field.value}
                  // A product is born in draft and can only go straight to
                  // published; the rest of the lifecycle opens up once it exists.
                  options={product?.id ? PRODUCT_STATUSES : CREATABLE_STATUSES}
                  onValueChange={field.onChange}
                />
              )}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="product-audience">Audience</label>
            <select id="product-audience" {...register("audience")}>
              <option value="">Unassigned</option>
              {PRODUCT_AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience[0].toUpperCase() + audience.slice(1)}</option>)}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="product-garment-type">Garment type</label>
            <select id="product-garment-type" {...register("garmentType")}>
              <option value="">Unassigned</option>
              {GARMENT_TYPES.map((garmentType) => <option key={garmentType} value={garmentType}>{garmentType[0].toUpperCase() + garmentType.slice(1)}</option>)}
            </select>
          </div>
        </div>

        <div className="admin-field admin-field--wide">
          <label htmlFor="product-description">Description</label>
          <textarea id="product-description" {...register("description")} />
        </div>
      </section>

      <section className="admin-panel">
        <h2>Variants</h2>
        {errors.variants?.root ? (
          <span className="admin-error" role="alert">
            {errors.variants.root.message}
          </span>
        ) : null}
        <ul className="admin-form" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {variants.fields.map((field, index) => (
            <VariantFields
              key={field.id}
              form={form}
              index={index}
              canRemove={variants.fields.length > 1}
              onRemove={() => variants.remove(index)}
            />
          ))}
        </ul>
        <div className="admin-actions">
          <button className="admin-button" type="button" onClick={() => variants.append({ ...EMPTY_VARIANT })}>
            Add variant
          </button>
        </div>
      </section>

      <MediaFields form={form} onUploadingChange={setImageUploading} />

      <div className="admin-actions">
        {saveError ? <p className="admin-error" role="alert">{saveError}</p> : null}
        <button className="admin-button admin-button--primary" type="submit" disabled={isSubmitting || imageUploading}>
          {isSubmitting ? "Saving…" : "Save product"}
        </button>
      </div>
    </form>
  );
}
