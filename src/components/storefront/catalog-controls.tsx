"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { formatMoney } from "@/features/catalog/money";
import type { CatalogFacets, CatalogFilters } from "@/features/catalog/types";

const SEARCH_DEBOUNCE_MS = 300;

export function CatalogControls({
  filters,
  facets,
  currency,
}: {
  filters: CatalogFilters;
  facets: CatalogFacets;
  currency: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q);
  const bounds = facets.priceBounds;
  // Slider position is local so dragging stays smooth; the URL is written on release.
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice ?? bounds?.max ?? 0);

  const navigate = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const commitQuery = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === filters.q) return;
    navigate((params) => {
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
    });
  };

  // Typing writes to the URL on a pause rather than on a button press, so the
  // results follow the field. Debouncing in the handler rather than an effect
  // keeps a keystroke from scheduling a render just to schedule a timer.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleQuery = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => commitQuery(value), SEARCH_DEBOUNCE_MS);
  };

  const commitQueryNow = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    commitQuery(value);
  };

  // A pending keystroke must not navigate after the shopper has left the page.
  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const toggleValue = (key: "size" | "color", value: string, checked: boolean) => {
    navigate((params) => {
      const current = new Set(params.getAll(key).map((item) => item.toLowerCase()));
      if (checked) current.add(value.toLowerCase());
      else current.delete(value.toLowerCase());
      params.delete(key);
      [...current].forEach((item) => params.append(key, item));
    });
  };

  const commitMaxPrice = () => {
    if (!bounds) return;
    navigate((params) => {
      if (maxPrice >= bounds.max) params.delete("maxPrice");
      else params.set("maxPrice", String(maxPrice));
    });
  };

  const hasActiveFilters = Boolean(
    filters.q || filters.sizes.length || filters.colors.length || filters.maxPrice || filters.sort !== "featured",
  );

  return (
    <div className="catalog-controls">
      <form
        id="catalog-search"
        className="catalog-search"
        role="search"
        noValidate
        onSubmit={(event) => {
          // The query is already debounced into the URL; Enter just commits it now.
          event.preventDefault();
          commitQueryNow(query);
        }}
      >
        <label htmlFor="product-search">Search the catalog</label>
        <div>
          {/* No aria-label: it would override the visible label and break WCAG 2.5.3 (Label in Name). */}
          <input
            id="product-search"
            type="search"
            name="q"
            value={query}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setQuery(value);
              scheduleQuery(value);
            }}
          />
          {query ? (
            <button
              type="button"
              className="clear-search"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                commitQueryNow("");
              }}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          ) : null}
        </div>
      </form>
      <div className="catalog-filter-bar">
        {facets.sizes.length ? (
          <fieldset>
            <legend>Size</legend>
            {facets.sizes.map((size) => (
              <label key={size}>
                <input
                  type="checkbox"
                  name="size"
                  value={size}
                  checked={filters.sizes.includes(size.toLowerCase())}
                  onChange={(event) => toggleValue("size", size, event.currentTarget.checked)}
                />{" "}
                <span>{size}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        {facets.colors.length ? (
          <fieldset>
            <legend>Colour</legend>
            {facets.colors.map((color) => (
              <label key={color}>
                <input
                  type="checkbox"
                  name="color"
                  value={color}
                  checked={filters.colors.includes(color.toLowerCase())}
                  onChange={(event) => toggleValue("color", color, event.currentTarget.checked)}
                />{" "}
                {/* The swatch is decoration: the visible colour name is the accessible name. */}
                <span className={`swatch swatch-${color.toLowerCase()}`} aria-hidden="true" /> <span>{color}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        {bounds ? (
          <fieldset className="price-filter">
            <legend>Price</legend>
            <label htmlFor="max-price">Maximum price</label>
            <input
              id="max-price"
              type="range"
              name="maxPrice"
              min={bounds.min}
              max={bounds.max}
              step={Math.max(1, Math.round((bounds.max - bounds.min) / 50))}
              value={Math.min(Math.max(maxPrice, bounds.min), bounds.max)}
              aria-valuetext={formatMoney(maxPrice, currency)}
              onChange={(event) => setMaxPrice(Number(event.currentTarget.value))}
              onPointerUp={commitMaxPrice}
              onKeyUp={commitMaxPrice}
              onBlur={commitMaxPrice}
            />
            <output htmlFor="max-price">
              {formatMoney(bounds.min, currency)} — {formatMoney(Math.min(Math.max(maxPrice, bounds.min), bounds.max), currency)}
            </output>
          </fieldset>
        ) : null}
        {hasActiveFilters ? (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              if (searchTimer.current) clearTimeout(searchTimer.current);
              setQuery("");
              setMaxPrice(bounds?.max ?? 0);
              router.push(pathname, { scroll: false });
            }}
          >
            Clear all filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
