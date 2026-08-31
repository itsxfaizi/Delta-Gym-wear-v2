/** Formats the catalog's integer minor-unit amounts for display. */
export function formatMoney(amount: number, currency: string): string {
  const majorAmount = amount / 100;
  const hasFraction = Math.abs(amount % 100) > 0;
  return `${currency} ${majorAmount.toLocaleString("en-PK", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Schema.org Offer prices are decimal major-unit strings. */
export function moneyAmountForStructuredData(amount: number): string {
  return (amount / 100).toFixed(2);
}
