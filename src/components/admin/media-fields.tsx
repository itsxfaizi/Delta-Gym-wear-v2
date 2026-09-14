"use client";

import { ImageOff, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useFieldArray } from "react-hook-form";

import type { ProductForm } from "./variant-fields";

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

/**
 * Media is referenced by URL. Once a Supabase Storage bucket exists these
 * inputs become an upload widget that writes the same objectKey column.
 * ponytail follow-up: no Storage bucket exists yet, so there is no upload here —
 * only pasting a URL that already exists somewhere else.
 */
export function MediaFields({ form }: { form: ProductForm }) {
  const { register, control, watch, formState } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "media" });

  return (
    <section className="admin-panel">
      <h2>Images</h2>
      <p className="admin-hint">
        Paste a full image URL. Direct uploads land once a Supabase Storage bucket exists.
      </p>

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
                <MediaThumbnail src={url ?? ""} />
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
                  <input id={`media-${index}-altText`} {...register(`media.${index}.altText`)} />
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
