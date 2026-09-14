"use client";

import { useEffect } from "react";

import { useCart } from "@/components/storefront/storefront-shell";

/** Empties the local cart once the order receipt renders; renders nothing. */
export function ClearCart() {
  const { lines, update } = useCart();

  useEffect(() => {
    for (const line of lines) update(line.key, 0);
  }, [lines, update]);

  return null;
}
