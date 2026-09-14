"use server";

import type { OrderAlertSnapshot } from "./order-alerts";
import { readOrderAlertSnapshot } from "@/server/admin/alerts";

/**
 * Client boundary for the order poll. Authorization happens server-side inside
 * readOrderAlertSnapshot — the browser cannot reach the database module directly.
 */
export async function fetchOrderAlertSnapshot(): Promise<OrderAlertSnapshot> {
  return readOrderAlertSnapshot();
}
