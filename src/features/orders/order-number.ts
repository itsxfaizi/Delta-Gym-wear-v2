/**
 * Deterministic, human-readable order number: DG-YYMMDD-0001.
 * Both the date and the sequence are arguments so this stays pure and testable.
 */
export function buildOrderNumber(placedAt: Date, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError("Order sequence must be a positive integer.");
  }

  const datePart = placedAt.toISOString().slice(2, 10).replace(/-/g, "");
  return `DG-${datePart}-${String(sequence).padStart(4, "0")}`;
}
