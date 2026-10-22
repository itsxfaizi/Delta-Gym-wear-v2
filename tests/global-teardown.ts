import { cleanupE2eData, closeDb, deleteE2eUsers } from "./db";
import { verifyE2eTargetConnectivity } from "./global-setup";

/**
 * The suite writes only to the explicitly guarded isolated project. This clears
 * its footprint afterwards so a second run starts where the first did.
 *
 * Nothing is deleted: order_items and product_revisions are both immutable by
 * design. Orders are cancelled and products archived instead, which every admin
 * figure and the storefront already exclude. Only records carrying the suite's
 * markers are touched.
 */
export default async function globalTeardown(): Promise<void> {
  // Playwright can run teardown after a setup failure. Verify again before any
  // cancellation, archive, deletion, or Auth admin call.
  await verifyE2eTargetConnectivity();
  try {
    const result = await cleanupE2eData();
    const users = await deleteE2eUsers();
    console.log(
      `e2e cleanup: cancelled ${result.ordersCancelled} orders, detached ${result.customers} customer accounts, removed ${result.memberships} memberships, archived ${result.productsArchived} products, deleted ${users} auth users; kept the configured owner`,
    );

    if (result.ordersLeft > 0) {
      console.log(`e2e cleanup: ${result.ordersLeft} order(s) were past packed and cannot be cancelled; left as they are`);
    }
  } finally {
    await closeDb();
  }
}
