"use client";

import Image from "next/image";
import { useState } from "react";

import { formatMoney } from "@/features/catalog/money";
import { isVariantPurchasable, lowStockLabel, maxPurchasableQuantity } from "@/features/catalog/stock";
import type { CatalogProduct } from "@/features/catalog/types";

import { useCart } from "./storefront-shell";
import { Reveal } from "./motion";

const MAX_LINE_QUANTITY = 99;

function moveRadioSelection(event: React.KeyboardEvent<HTMLButtonElement>) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const radios = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([aria-disabled="true"])') ?? [])];
  const currentIndex = radios.indexOf(event.currentTarget);
  const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const next = radios[(currentIndex + direction + radios.length) % radios.length];
  next?.focus();
  next?.click();
}

export function ProductDetailView({ product }: { product: CatalogProduct }) {
  const [color, setColor] = useState(
    product.variants.find((candidate) => candidate.color && isVariantPurchasable(candidate))?.color ??
      product.variants.find((candidate) => candidate.color)?.color ??
      "",
  );
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const { add, update, lines } = useCart();

  const colors = [...new Set(product.variants.map((candidate) => candidate.color).filter(Boolean))] as string[];
  const sizes = [...new Set(product.variants.map((candidate) => candidate.size).filter(Boolean))] as string[];
  const variant = product.variants.find((candidate) => candidate.color === color && candidate.size === size);
  const displayedPrice = variant ?? product;
  const seedNote = product.source === "development-seed" ? " — development seed image" : "";

  const isColorPurchasable = (candidateColor: string) =>
    product.variants.some((candidate) => candidate.color === candidateColor && isVariantPurchasable(candidate));
  const isSizePurchasable = (candidateSize: string) =>
    product.variants.some((candidate) => candidate.color === color && candidate.size === candidateSize && isVariantPurchasable(candidate));

  const availableColors = colors.filter(isColorPurchasable);
  const availableSizes = sizes.filter(isSizePurchasable);
  const hasAnyPurchasableVariant = product.variants.some(isVariantPurchasable);
  // Clamp against tracked stock so the stepper can never offer more than is sellable.
  const quantityCeiling = variant
    ? Math.max(1, maxPurchasableQuantity(variant, MAX_LINE_QUANTITY) || 1)
    : MAX_LINE_QUANTITY;

  const changeQuantity = (next: number) => {
    setQuantity(Math.min(Math.max(1, next), quantityCeiling));
    setConfirmation("");
  };

  const submit = () => {
    setConfirmation("");
    if (!size) return setError("Select a size to continue.");
    if (!variant || !isVariantPurchasable(variant)) return setError("That colour and size combination is currently unavailable.");

    // ponytail: the shared cart `add` has no quantity argument, so a multi-unit
    // add is add-one-then-set-total. Collapse to a single call if `add` ever
    // takes a quantity (requested from the shell owner).
    const key = `${product.handle}:${variant.id}`;
    const existingQuantity = lines.find((line) => line.key === key)?.quantity ?? 0;
    if (!add(product, variant)) return setError("We couldn’t add this item. Please try again.");
    if (quantity > 1) update(key, existingQuantity + quantity);

    setError("");
    setConfirmation(`Added ${quantity} ${quantity === 1 ? "item" : "items"} to your cart.`);
  };

  return (
    <main className="pdp-page">
      <Reveal variant="pdp-gallery" className="pdp-gallery-motion"><div className="pdp-gallery">
        <Image className="pdp-main-image" style={{ width: "100%", height: "auto" }} src={product.images[selectedImage]?.src ?? product.images[0]?.src ?? ""} width={638} height={720} alt={`${product.images[selectedImage]?.alt ?? product.title}${seedNote}`} priority />
        {product.images.length > 1 ? (
          <div className="thumbnail-row" role="group" aria-label={`${product.title} images`}>
            {product.images.map((image, index) => (
              <button
                type="button"
                key={image.src}
                // Selection is exposed programmatically, not only through the border.
                aria-pressed={selectedImage === index}
                aria-label={image.alt || `${product.title}, image ${index + 1}`}
                className={`thumbnail ${selectedImage === index ? "selected" : ""}`}
                onClick={() => setSelectedImage(index)}
              >
                <Image src={image.src} width={76} height={86} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div></Reveal>
      <Reveal variant="pdp-details" className="pdp-details-motion"><section className="pdp-details">
        <p className="section-label">Delta / Product</p>
        <h1>{product.title}</h1>
        {product.rating !== null && product.reviewCount > 0 ? <div className="rating" aria-label={`${product.rating} out of 5 stars, ${product.reviewCount} reviews`}>★★★★★ <span>({product.reviewCount})</span></div> : null}
        <p className="price">{formatMoney(displayedPrice.priceAmount, displayedPrice.currency)}</p>
        {variant && lowStockLabel(variant) ? <p className="stock-note" role="status">{lowStockLabel(variant)}</p> : null}
        {product.description ? <p className="description">{product.description}</p> : null}
        <fieldset className="variant-fieldset">
          <legend id="colour-options-label">COLOUR <span>{color}</span></legend>
          <div className="color-options" role="radiogroup" aria-labelledby="colour-options-label">
            {colors.map((item) => {
              const available = isColorPurchasable(item);
              const isTabStop = item === color || (!isColorPurchasable(color) && availableColors[0] === item);
              return (
                <button
                  type="button"
                  role="radio"
                  key={item}
                  tabIndex={isTabStop ? 0 : -1}
                  aria-disabled={!available}
                  className={`color-option ${item === color ? "selected" : ""}`}
                  aria-label={`Colour ${item}${available ? "" : " unavailable"}`}
                  aria-checked={item === color}
                  onKeyDown={moveRadioSelection}
                  onClick={() => { if (!available) return; setColor(item); setSize(""); setQuantity(1); setError(""); setConfirmation(""); }}
                >
                  <span className={`swatch swatch-${item.toLowerCase()}`} />
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="variant-fieldset">
          <legend id="size-options-label">SIZE {size && <span>{size}</span>}</legend>
          <div className="size-options" role="radiogroup" aria-labelledby="size-options-label">
            {sizes.map((item) => {
              const available = isSizePurchasable(item);
              const isTabStop = item === size || (!size && availableSizes[0] === item);
              return (
                <button
                  type="button"
                  role="radio"
                  key={item}
                  tabIndex={isTabStop ? 0 : -1}
                  aria-disabled={!available}
                  className={`size-option ${item === size ? "selected" : ""}`}
                  aria-label={`${item}${available ? "" : " unavailable"}`}
                  aria-checked={item === size}
                  onKeyDown={moveRadioSelection}
                  onClick={() => { if (!available) return; setSize(item); setQuantity(1); setError(""); setConfirmation(""); }}
                >
                  {item}
                </button>
              );
            })}
          </div>
          {colors.length && !availableSizes.length ? (
            <p className="stock-note" role="status">Every size in {color} is sold out. Choose another colour.</p>
          ) : null}
        </fieldset>
        <div className="pdp-purchase">
          <div className="quantity">
            <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => changeQuantity(quantity - 1)}><span aria-hidden="true">−</span></button>
            <label className="sr-only" htmlFor="pdp-quantity">Quantity</label>
            {/* One native control: typeable, arrow-key steppable, and announced. */}
            <input
              id="pdp-quantity"
              className="quantity-input"
              type="number"
              min={1}
              max={quantityCeiling}
              step={1}
              value={quantity}
              onChange={(event) => changeQuantity(Number.parseInt(event.currentTarget.value, 10) || 1)}
            />
            <button type="button" aria-label="Increase quantity" disabled={quantity >= quantityCeiling} onClick={() => changeQuantity(quantity + 1)}><span aria-hidden="true">+</span></button>
          </div>
          <button type="button" className="primary-cta" disabled={!hasAnyPurchasableVariant} onClick={submit}>ADD TO CART</button>
        </div>
        {!hasAnyPurchasableVariant ? <p className="stock-note" role="status">This product is currently sold out.</p> : null}
        {error ? <p role="alert" className="form-error">{error}</p> : null}
        {/* The shell's cart live region already announces the add; this is its visible twin. */}
        {confirmation ? <p className="form-success" aria-hidden="true">{confirmation}</p> : null}
        {product.description ? <details><summary>PRODUCT DETAILS</summary><p>{product.description}</p></details> : null}
      </section></Reveal>
    </main>
  );
}
