import { z } from "zod";

export const STOCK_ADJUSTMENT_MODES = ["set", "add", "subtract"] as const;
export type StockAdjustmentMode = (typeof STOCK_ADJUSTMENT_MODES)[number];

export const stockAdjustmentSchema = z.object({
  mode: z.enum(STOCK_ADJUSTMENT_MODES),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,7}$/, "Enter a whole number of units.")
    .transform(Number),
  reason: z.string().trim().min(1, "A reason is required.").max(200),
});

/** The form edits strings; the schema hands the server numbers. */
export type StockAdjustmentValues = z.input<typeof stockAdjustmentSchema>;
export type StockAdjustmentInput = z.output<typeof stockAdjustmentSchema>;

export class NegativeStockError extends Error {
  public readonly code = "NEGATIVE_STOCK" as const;

  constructor(current: number, mode: StockAdjustmentMode, amount: number) {
    super(
      mode === "set"
        ? "Stock cannot be set to a negative number."
        : `Subtracting ${amount} from ${current} would take stock below zero.`,
    );
    this.name = "NegativeStockError";
  }
}

/**
 * Pure quantity maths: the only place a stock adjustment turns into a new
 * quantity. A result below zero is always a mistake, never a valid state.
 */
export function applyStockAdjustment(current: number, mode: StockAdjustmentMode, amount: number): number {
  const next = mode === "set" ? amount : mode === "add" ? current + amount : current - amount;
  if (next < 0) throw new NegativeStockError(current, mode, amount);
  return next;
}
