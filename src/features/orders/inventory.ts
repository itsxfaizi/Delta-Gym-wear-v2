import type { StockPolicy } from "./types";

/** The stock facts an order needs; a subset of the product_variants row. */
export type StockVariant = {
  id: string;
  sku: string;
  stockQuantity: number;
  stockPolicy: StockPolicy;
};

export type RequestedLine = {
  productVariantId: string;
  quantity: number;
};

export type StockShortfall = {
  productVariantId: string;
  sku: string | null;
  requested: number;
  available: number;
};

export class OutOfStockError extends Error {
  public readonly code = "OUT_OF_STOCK" as const;

  constructor(public readonly shortfalls: readonly StockShortfall[]) {
    super(
      `Not enough stock for: ${shortfalls
        .map((item) => `${item.sku ?? item.productVariantId} (requested ${item.requested}, available ${item.available})`)
        .join(", ")}.`,
    );
    this.name = "OutOfStockError";
  }
}

/** Duplicate lines for one variant are a single claim against that variant's stock. */
function aggregateByVariant(lines: readonly RequestedLine[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(line.productVariantId, (totals.get(line.productVariantId) ?? 0) + line.quantity);
  }
  return totals;
}

function findShortfalls(
  lines: readonly RequestedLine[],
  variants: readonly StockVariant[],
): StockShortfall[] {
  return [...aggregateByVariant(lines)].flatMap<StockShortfall>(([productVariantId, requested]) => {
    const variant = variants.find((candidate) => candidate.id === productVariantId);
    if (!variant) return [{ productVariantId, sku: null, requested, available: 0 }];
    // "continue" variants are backorderable by policy, so they never block an order.
    if (variant.stockPolicy === "continue" || variant.stockQuantity >= requested) return [];
    return [{ productVariantId, sku: variant.sku, requested, available: variant.stockQuantity }];
  });
}

export function assertSufficientStock(
  lines: readonly RequestedLine[],
  variants: readonly StockVariant[],
): void {
  const shortfalls = findShortfalls(lines, variants);
  if (shortfalls.length > 0) throw new OutOfStockError(shortfalls);
}
