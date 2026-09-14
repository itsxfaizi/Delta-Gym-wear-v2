/** Shape returned by the alert poll; kept tiny so the check stays cheap. */
export type OrderAlertSnapshot = {
  latestPlacedAt: string | null;
  pendingConfirmation: number;
  total: number;
};

export const ORDER_ALERT_INTERVAL_MS = 30_000;

/**
 * How many orders arrived since the operator last looked. Comparing timestamps
 * rather than counts means a cancelled order cannot mask a new one, and the
 * baseline is whatever the page rendered with, so a refresh always clears it.
 */
export function countNewOrders(
  baseline: OrderAlertSnapshot | null,
  current: OrderAlertSnapshot | null,
): number {
  if (!baseline || !current || !current.latestPlacedAt) return 0;
  if (baseline.latestPlacedAt === current.latestPlacedAt) return 0;
  return Math.max(0, current.total - baseline.total);
}

/** Title prefix so a backgrounded tab still shows the count. */
export function alertTitle(count: number, base: string): string {
  return count > 0 ? `(${count}) ${base}` : base;
}

export function describeAlert(count: number): string {
  if (count <= 0) return "";
  return count === 1 ? "1 new order" : `${count} new orders`;
}
