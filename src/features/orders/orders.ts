import { canTransitionOrderStatus, type CartLineSnapshot, type OrderStatus } from "./types";

/** Flat-rate COD shipping in PKR minor units; free once the subtotal clears the threshold. */
export const ORDER_PRICING = {
  currency: "PKR",
  flatShippingAmount: 25_000,
  freeShippingThresholdAmount: 500_000,
} as const;

export type ShippingRule = {
  flatShippingAmount: number;
  freeShippingThresholdAmount: number;
};

export type OrderTotals = {
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
};

export type PricedLine = Pick<CartLineSnapshot, "unitPriceAmount" | "quantity">;

export function calculateOrderTotals(
  lines: readonly PricedLine[],
  shippingRule: ShippingRule = ORDER_PRICING,
): OrderTotals {
  const subtotalAmount = lines.reduce((total, line) => total + line.unitPriceAmount * line.quantity, 0);
  const shippingAmount =
    subtotalAmount === 0 || subtotalAmount >= shippingRule.freeShippingThresholdAmount
      ? 0
      : shippingRule.flatShippingAmount;

  return { subtotalAmount, shippingAmount, totalAmount: subtotalAmount + shippingAmount };
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return canTransitionOrderStatus(from, to);
}

export class InvalidOrderTransitionError extends Error {
  public readonly code = "INVALID_ORDER_TRANSITION" as const;

  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`An order cannot move from ${from} to ${to}.`);
    this.name = "InvalidOrderTransitionError";
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidOrderTransitionError(from, to);
}
