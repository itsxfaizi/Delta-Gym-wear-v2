"use client";

import Image from "next/image";
import { useState } from "react";

import { formatMoney } from "@/features/catalog/money";
import type { CatalogProduct } from "@/features/catalog/types";

import { useCart } from "./storefront-shell";
import { Reveal } from "./motion";

function moveRadioSelection(event: React.KeyboardEvent<HTMLButtonElement>) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const radios = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)') ?? [])];
  const currentIndex = radios.indexOf(event.currentTarget);
  const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const next = radios[(currentIndex + direction + radios.length) % radios.length];
  next?.focus();
  next?.click();
}

export function ProductDetailView({ product }: { product: CatalogProduct }) {
  const [color, setColor] = useState(product.variants.find((candidate) => candidate.color)?.color ?? "");
  const [size, setSize] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [error, setError] = useState("");
  const { add } = useCart();
  const colors = [...new Set(product.variants.map((candidate) => candidate.color).filter(Boolean))] as string[];
  const sizes = [...new Set(product.variants.map((candidate) => candidate.size).filter(Boolean))] as string[];
  const variant = product.variants.find((candidate) => candidate.color === color && candidate.size === size);
  const displayedPrice = variant ?? product;

  const submit = () => {
    if (!size) return setError("Select a size to continue.");
    if (!variant?.isAvailable) return setError("That colour and size combination is currently unavailable.");
    if (!add(product, variant)) return setError("We couldn’t add this item. Please try again.");
    setError("");
  };

  return (
    <main className="pdp-page">
      <Reveal variant="pdp-gallery" className="pdp-gallery-motion"><div className="pdp-gallery">
        <Image className="pdp-main-image" style={{ width: "100%", height: "auto" }} src={product.images[selectedImage]?.src ?? product.images[0]?.src ?? ""} width={638} height={720} alt={`${product.images[selectedImage]?.alt ?? product.title}${product.source === "development-seed" ? " — development seed image" : ""}`} priority />
        <div className="thumbnail-row">
          {product.images.map((image, index) => (
            <button type="button" key={image.src} aria-label={`Show product image ${index + 1}`} className={`thumbnail ${selectedImage === index ? "selected" : ""}`} onClick={() => setSelectedImage(index)}>
              <Image src={image.src} width={76} height={86} alt="" />
            </button>
          ))}
        </div>
      </div></Reveal>
      <Reveal variant="pdp-details" className="pdp-details-motion"><section className="pdp-details">
        <p className="section-label">Delta / Product</p>
        <h1>{product.title}</h1>
        {product.rating !== null && product.reviewCount > 0 ? <div className="rating" aria-label={`${product.rating} out of 5 stars, ${product.reviewCount} reviews`}>★★★★★ <span>({product.reviewCount})</span></div> : null}
        <p className="price">{formatMoney(displayedPrice.priceAmount, displayedPrice.currency)}</p>
        {product.description ? <p className="description">{product.description}</p> : null}
        <fieldset className="variant-fieldset">
          <legend id="colour-options-label">COLOUR <span>{color}</span></legend>
          <div className="color-options" role="radiogroup" aria-labelledby="colour-options-label">
            {colors.map((item) => <button type="button" role="radio" key={item} tabIndex={item === color ? 0 : -1} className={`color-option ${item === color ? "selected" : ""}`} aria-label={`Colour ${item}`} aria-checked={item === color} onKeyDown={moveRadioSelection} onClick={() => { setColor(item); setSize(""); setError(""); }}><span className={`swatch swatch-${item.toLowerCase()}`} /></button>)}
          </div>
        </fieldset>
        <fieldset className="variant-fieldset">
          <legend id="size-options-label">SIZE {size && <span>{size}</span>}</legend>
          <div className="size-options" role="radiogroup" aria-labelledby="size-options-label">
            {sizes.map((item) => {
              const available = product.variants.some((candidate) => candidate.color === color && candidate.size === item && candidate.isAvailable);
              const isTabStop = item === size || (!size && available && sizes.find((candidate) => product.variants.some((productVariant) => productVariant.color === color && productVariant.size === candidate && productVariant.isAvailable)) === item);
              return <button type="button" role="radio" key={item} tabIndex={isTabStop ? 0 : -1} disabled={!available} className={`size-option ${item === size ? "selected" : ""}`} aria-label={`${item}${available ? "" : " unavailable"}`} aria-checked={item === size} onKeyDown={moveRadioSelection} onClick={() => { setSize(item); setError(""); }}>{item}</button>;
            })}
          </div>
        </fieldset>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button type="button" className="primary-cta" onClick={submit}>ADD TO CART</button>
        {product.description ? <details><summary>PRODUCT DETAILS</summary><p>{product.description}</p></details> : null}
      </section></Reveal>
    </main>
  );
}
