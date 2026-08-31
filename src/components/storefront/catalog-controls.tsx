"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { CatalogFilters } from "@/features/catalog/types";

const SIZES = ["S", "M", "L"] as const;
const COLORS = ["Black", "Sand"] as const;

export function CatalogControls({ filters }: { filters: CatalogFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q);

  const navigate = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const toggleValue = (key: "size" | "color", value: string, checked: boolean) => {
    navigate((params) => {
      const current = new Set(params.getAll(key).map((item) => item.toLowerCase()));
      if (checked) current.add(value.toLowerCase()); else current.delete(value.toLowerCase());
      params.delete(key);
      [...current].forEach((item) => params.append(key, item));
    });
  };

  return (
    <div className="catalog-controls">
      <form
        id="catalog-search"
        className="catalog-search"
        role="search"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          navigate((params) => {
            const value = query.trim();
            if (value) params.set("q", value); else params.delete("q");
          });
        }}
      >
        <label htmlFor="product-search">Search the catalog</label>
        <div>
          <input id="product-search" type="search" name="q" value={query} onChange={(event) => setQuery(event.currentTarget.value)} aria-label="Search products" />
          {query ? <button type="button" className="clear-search" aria-label="Clear search" onClick={() => { setQuery(""); navigate((params) => params.delete("q")); }}>Clear</button> : null}
          <button type="submit" className="search-submit">Search</button>
        </div>
      </form>
      <div className="catalog-filter-bar">
        <fieldset>
          <legend>Size</legend>
          {SIZES.map((size) => (
            <label key={`${size}:${filters.sizes.includes(size.toLowerCase())}`}><input type="checkbox" name="size" value={size} defaultChecked={filters.sizes.includes(size.toLowerCase())} onChange={(event) => toggleValue("size", size, event.currentTarget.checked)} /> <span>{size}</span></label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Colour</legend>
          {COLORS.map((color) => (
            <label key={`${color}:${filters.colors.includes(color.toLowerCase())}`}><input type="checkbox" name="color" value={color} defaultChecked={filters.colors.includes(color.toLowerCase())} onChange={(event) => toggleValue("color", color, event.currentTarget.checked)} /> <span className={`swatch swatch-${color.toLowerCase()}`} aria-hidden="true" /> <span>{color}</span></label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
