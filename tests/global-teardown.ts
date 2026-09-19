import { cleanupE2eData, closeDb, deleteE2eUsers } from "./db";

/**
 * The suite writes to the real development database — placing orders and
 * creating products is the only way to test them honestly. This clears its
 * footprint afterwards so a second run starts where the first did.
 *
 * Nothing is deleted: order_items and product_revisions are both immutable by
 * design. Orders are cancelled and products archived instead, which every admin
 * figure and the storefront already exclude. Only records carrying the suite's
 * markers are touched.
 */
export default async function globalTeardown(): Promise<void> {
  const result = await cleanupE2eData();
  const users = await deleteE2eUsers();
  console.log(
    `e2e cleanup: cancelled ${result.ordersCancelled} orders, removed ${result.customers} customers and archived ${result.productsArchived} products, deleted ${users} auth users`,
  );
  await closeDb();

  if (result.ordersLeft > 0) {
    console.log(`e2e cleanup: ${result.ordersLeft} order(s) were past packed and cannot be cancelled; left as they are`);
  }
}
