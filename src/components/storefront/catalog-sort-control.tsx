"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { CatalogSort } from "@/features/catalog/types";

export function CatalogSortControl({ value }: { value: CatalogSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="sort-control">Sort
      <select aria-label="Sort products" value={value} onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        const nextSort = event.currentTarget.value as CatalogSort;
        if (nextSort === "featured") params.delete("sort"); else params.set("sort", nextSort);
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}>
        <option value="featured">Featured</option>
        <option value="title-asc">Name</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>
    </label>
  );
}
