import { expect, test } from "@playwright/test";

import { withDb } from "./db";
import { OWNER_PASSWORD, e2eContact, placeOrder, signInAsOwner } from "./helpers";

/** The order number is what the UI shows; its id is what order_ops keys on. */
async function orderIdFor(orderNumber: string): Promise<string> {
  return withDb(async (sql) => {
    const [row] = await sql`select id from orders where order_number = ${orderNumber}`;
    return row.id as string;
  });
}

/**
 * Cash-on-delivery working state used to live in a module-level Map: a call
 * attempt logged before a restart was simply gone afterwards, and no page ever
 * said so — the status quietly reverted to the database value. This spec exists
 * to keep that from coming back, so it asserts against the `order_ops` table
 * rather than against what the page happens to be showing.
 */

test.skip(!OWNER_PASSWORD, "E2E_ADMIN_PASSWORD is required to sign in as the owner");

test("a logged call, a courier and a COD status all survive in the database", async ({ page }) => {
  const contact = e2eContact("ops");
  const orderNumber = await placeOrder(page, contact);

  await signInAsOwner(page, "/admin/orders");
  await page.getByRole("link", { name: orderNumber }).first().click();
  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}/);
  const orderId = await orderIdFor(orderNumber);

  // Log a confirmation call.
  await page.getByLabel("Outcome").selectOption("confirmed");
  await page.getByLabel("Note (optional)").fill("Confirmed on the first call, asked for evening delivery.");
  await page.getByRole("button", { name: "Record attempt" }).click();
  await expect(page.getByText(/asked for evening delivery/).first()).toBeVisible({ timeout: 20_000 });

  // It is in the table, not just on the screen. Polled rather than read once:
  // the note becomes visible as soon as the action returns, which is not
  // necessarily after the commit has landed for a separate connection.
  await expect
    .poll(
      async () =>
        withDb(async (sql) => {
          const [row] = await sql`select call_attempts from order_ops where order_id = ${orderId}`;
          return row ? (row.call_attempts as unknown[]).length : 0;
        }),
      { timeout: 20_000 },
    )
    .toBe(1);

  const afterCall = await withDb(async (sql) => {
    const [row] = await sql`select call_attempts, last_attempt_at from order_ops where order_id = ${orderId}`;
    return row;
  });

  expect(afterCall.call_attempts[0].outcome).toBe("confirmed");
  expect(afterCall.call_attempts[0].note).toContain("evening delivery");
  expect(afterCall.last_attempt_at).not.toBeNull();

  // A fresh page load reads it back from the database, not from a warm process.
  await page.reload();
  await expect(page.getByText(/asked for evening delivery/).first()).toBeVisible();

  // Advance far enough to record a courier.
  await page.getByRole("button", { name: "Confirmed", exact: true }).click();
  await expect(page.getByRole("button", { name: "Packed", exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Packed", exact: true }).click();
  await expect(page.getByRole("button", { name: "Shipped", exact: true })).toBeVisible({ timeout: 20_000 });

  await expect
    .poll(
      async () =>
        withDb(async (sql) => {
          const [row] = await sql`select ops_status from order_ops where order_id = ${orderId}`;
          return row?.ops_status ?? null;
        }),
      { timeout: 20_000 },
    )
    .toBe("packed");
});

test("the database refuses a COD status the app does not define", async ({ page }) => {
  const contact = e2eContact("guard");
  const orderNumber = await placeOrder(page, contact);

  await signInAsOwner(page, "/admin/orders");
  await page.getByRole("link", { name: orderNumber }).first().click();
  const orderId = await orderIdFor(orderNumber);

  // order_ops.ops_status is a free text column guarded by a check constraint
  // listing COD_STATUSES. Without it a typo in application code would persist
  // a status no screen knows how to render.
  await expect(
    withDb(
      (sql) => sql`
        insert into order_ops (order_id, tenant_id, ops_status)
        select ${orderId}, tenant_id, 'not_a_real_status' from orders where id = ${orderId}
        on conflict (order_id) do update set ops_status = 'not_a_real_status'
      `,
    ),
  ).rejects.toThrow(/order_ops_ops_status_known|violates check constraint/);
});
