import { formatMoney as formatCatalogMoney, moneyAmountForStructuredData } from "@/features/catalog/money";

export const DEFAULT_CURRENCY = "PKR";

/** Formats integer minor units (see productVariants.priceAmount) for display. */
export function formatMoney(minorUnits: number, currency: string = DEFAULT_CURRENCY): string {
  return formatCatalogMoney(roundMinorUnits(minorUnits), currency);
}

/** Decimal major-unit string, the shape schema.org Offer prices require. */
export function formatMoneyAmount(minorUnits: number): string {
  return moneyAmountForStructuredData(roundMinorUnits(minorUnits));
}

/** Amounts must stay whole minor units; half-up so 0.5 never drifts toward zero. */
export function roundMinorUnits(minorUnits: number): number {
  if (!Number.isFinite(minorUnits)) throw new RangeError(`Not a money amount: ${minorUnits}`);
  return Math.round(minorUnits);
}

