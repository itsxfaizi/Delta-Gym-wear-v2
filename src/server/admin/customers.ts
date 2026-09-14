import "server-only";

import {
  deriveCustomers,
  searchCustomers,
  type CustomerOrderInput,
  type CustomerRecord,
} from "@/features/admin/customers";
import { resolveCodStatuses } from "@/server/ops/order-ops";
import { OrdersDatabaseUnavailableError, listOrders } from "@/server/orders/queries";

/**
 * ponytail: customers are derived from the most recent orders, not a customers
 * table, because the schema has none. One page of history is enough to read a
 * delivery pattern; a real `customers` table replaces this whole function.
 */
const CUSTOMER_ORDER_WINDOW = 100;

/** Admin reads degrade to empty without a database, like the rest of /admin. */
async function recentOrders(): Promise<CustomerOrderInput[]> {
  try {
    const { orders } = await listOrders({ limit: CUSTOMER_ORDER_WINDOW });
    // Without the overlay every refused/returned count is permanently zero, which
    // silently disables the COD risk signal this screen exists for.
    return resolveCodStatuses(orders) as Promise<CustomerOrderInput[]>;
  } catch (error) {
    if (error instanceof OrdersDatabaseUnavailableError) return [];
    throw error;
  }
}

export async function listCustomerRecords(search = ""): Promise<{ records: CustomerRecord[]; windowSize: number }> {
  const records = deriveCustomers(await recentOrders());
  return { records: searchCustomers(records, search), windowSize: CUSTOMER_ORDER_WINDOW };
}

export async function getCustomerRecord(key: string): Promise<CustomerRecord | null> {
  const records = deriveCustomers(await recentOrders());
  return records.find((record) => record.key === key) ?? null;
}
