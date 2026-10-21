"use client";

import { ImageOff, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useState } from "react";
import { useFieldArray } from "react-hook-form";

import type { ProductForm } from "./variant-fields";
import { prepareProductImageUpload } from "@/features/admin/media-actions";
import { MAX_PRODUCT_IMAGE_BYTES, PRODUCT_IMAGE_BUCKET } from "@/features/admin/media-upload";

/** Live preview with a broken-image fallback; falls back the moment the URL 404s or is unreachable. */
function MediaThumbnail({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="admin-media-thumb admin-media-thumb--broken" role="img" aria-label="No preview available">
        <ImageOff aria-hidden size={20} />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URLs, no Storage loader configured yet.
  return <img className="admin-media-thumb" src={src} alt="" onError={() => setBroken(true)} />;
}

export function MediaFields({ form, onUploadingChange }: { form: ProductForm; onUploadingChange: (uploading: boolean) => void }) {
  const { register, control, watch, formState } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "media" });
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  async function uploadImage(file: File) {
    if (file.size > MAX_PRODUCT_IMAGE_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadMessage("Choose a JPG, PNG, or WebP image under 5 MB.");
      return;
    }

    setUploading(true);
    onUploadingChange(true);
    setUploadMessage("Uploading image…");
    try {
      const prepared = await prepareProductImageUpload({ fileName: file.name, contentType: file.type, size: file.size });
      if (!prepared.ok) throw new Error(prepared.message);
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET)
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (error) throw error;
      append({ objectKey: prepared.publicUrl, altText: "" });
      setUploadMessage("Image uploaded. Add alt text, then save the product.");
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "The upload failed. Please try again.");
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  }

  return (
    <section className="admin-panel">
      <h2>Images</h2>
      <p className="admin-hint">
        Upload JPG, PNG, or WebP files up to 5 MB. Add descriptive alt text and save the product to publish the image.
      </p>
      <div className="admin-field admin-field--wide">
        <label htmlFor="product-image-upload">Upload image</label>
        <input id="product-image-upload" type="file" accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void uploadImage(file);
            event.currentTarget.value = "";
          }} />
        <p className="admin-hint" role="status" aria-live="polite">{uploadMessage}</p>
      </div>

      <ul className="admin-form" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {fields.map((field, index) => {
          const errors = formState.errors.media?.[index];
          const url = watch(`media.${index}.objectKey`);
          return (
            <li className="admin-repeat-item" key={field.id}>
              <div className="admin-repeat-head">
                <span>Image {index + 1}</span>
                <div className="admin-actions">
                  <button
                    className="admin-icon-button"
                    type="button"
                    aria-label={`Move image ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ChevronUp aria-hidden size={16} />
                  </button>
                  <button
                    className="admin-icon-button"
                    type="button"
                    aria-label={`Move image ${index + 1} down`}
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ChevronDown aria-hidden size={16} />
                  </button>
                  <button className="admin-button admin-button--danger" type="button" onClick={() => remove(index)}>
                    Remove
                  </button>
                </div>
              </div>
              <div className="admin-form-row admin-media-row">
                <MediaThumbnail key={url} src={url ?? ""} />
                <div className="admin-field admin-field--wide">
                  <label htmlFor={`media-${index}-objectKey`}>Image URL</label>
                  <input
                    id={`media-${index}-objectKey`}
                    inputMode="url"
                    aria-invalid={errors?.objectKey ? "true" : "false"}
                    {...register(`media.${index}.objectKey`)}
                  />
                  {errors?.objectKey ? (
                    <span className="admin-error" role="alert">
                      {errors.objectKey.message}
                    </span>
                  ) : null}
                </div>
                <div className="admin-field admin-field--wide">
                  <label htmlFor={`media-${index}-altText`}>Alt text</label>
                  <input id={`media-${index}-altText`} aria-invalid={errors?.altText ? "true" : "false"} {...register(`media.${index}.altText`)} />
                  {errors?.altText ? <span className="admin-error" role="alert">{errors.altText.message}</span> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="admin-actions">
        <button className="admin-button" type="button" onClick={() => append({ objectKey: "", altText: "" })}>
          Add image
        </button>
      </div>
    </section>
  );
}
