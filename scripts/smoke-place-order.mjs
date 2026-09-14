/**
 * Places one COD order via raw SQL mirroring placeCodOrder exactly (same
 * transaction shape, same guarded stock decrement, same order_number format),
 * then attempts an illegal status transition (pending -> delivered) to prove
 * the DB trigger rejects it. Read/write only to v2 snake_case tables, tenant-scoped.
 * Run: DB_URL=... DELTA_TENANT_ID=... node scripts/smoke-place-order.mjs
 */
import postgres from "postgres";

const DB_URL = process.env.DB_URL;
const TENANT_ID = process.env.DELTA_TENANT_ID;
if (!DB_URL || !TENANT_ID) {
  console.error("DB_URL and DELTA_TENANT_ID are required");
  process.exit(1);
}

const sql = postgres(DB_URL, { ssl: "require", max: 1, connect_timeout: 30 });

function buildOrderNumber(placedAt, sequence) {
  const datePart = placedAt.toISOString().slice(2, 10).replace(/-/g, "");
  return `DG-${datePart}-${String(sequence).padStart(4, "0")}`;
}

const placedAt = new Date();
const contactEmail = "smoke.test@deltagymwear.com";
const quantity = 1;

const [variant] = await sql`
  select v.id, v.sku, v.size, v.color, v.price_amount, v.stock_quantity, v.stock_policy, p.title as product_title
  from product_variants v
  join products p on p.id = v.product_id and p.tenant_id = v.tenant_id
  where v.tenant_id = ${TENANT_ID} and v.is_available = true and p.status = 'published' and v.stock_quantity >= ${quantity}
  order by v.stock_quantity desc
  limit 1`;

if (!variant) {
  console.error("No purchasable variant with stock found.");
  process.exit(1);
}
console.log("Using variant:", variant.sku, "stock before:", variant.stock_quantity);

let orderId, orderNumber;
try {
  await sql.begin(async (tx) => {
    const [locked] = await tx`
      select id, stock_quantity, stock_policy from product_variants
      where tenant_id = ${TENANT_ID} and id = ${variant.id}
      for update`;

    const unitPrice = variant.price_amount;
    const lineTotal = unitPrice * quantity;
    const subtotal = lineTotal;
    const shipping = 0;
    const total = subtotal + shipping;
    const variantLabel = [variant.color, variant.size].filter(Boolean).join(" / ") || null;

    const [counted] = await tx`
      select count(*)::int as total from orders
      where tenant_id = ${TENANT_ID}
        and (placed_at at time zone 'UTC')::date = (${placedAt.toISOString()}::timestamptz at time zone 'UTC')::date`;

    orderNumber = buildOrderNumber(placedAt, (counted?.total ?? 0) + 1);

    const [order] = await tx`
      insert into orders (
        tenant_id, order_number, customer_id, contact_email, contact_phone,
        shipping_address, status, payment_method, payment_status,
        subtotal_amount, shipping_amount, total_amount, currency, notes, placed_at
      ) values (
        ${TENANT_ID}, ${orderNumber}, null, ${contactEmail}, '03001234567',
        ${sql.json({ fullName: "Smoke Test", phone: "03001234567", line1: "1 Test Street", city: "Lahore", province: "Punjab", country: "PK" })},
        'pending', 'cod', 'unpaid',
        ${subtotal}, ${shipping}, ${total}, 'PKR', 'db-smoke-test order', ${placedAt.toISOString()}
      ) returning id, order_number`;

    orderId = order.id;

    await tx`
      insert into order_items (
        tenant_id, order_id, product_variant_id, product_title, variant_label, sku,
        unit_price_amount, quantity, line_total_amount
      ) values (
        ${TENANT_ID}, ${orderId}, ${variant.id}, ${variant.product_title}, ${variantLabel}, ${variant.sku},
        ${unitPrice}, ${quantity}, ${lineTotal}
      )`;

    const isBackorderable = locked.stock_policy === "continue";
    const decremented = isBackorderable
      ? await tx`
          update product_variants set stock_quantity = GREATEST(stock_quantity - ${quantity}, 0), updated_at = now()
          where tenant_id = ${TENANT_ID} and id = ${variant.id}
          returning id`
      : await tx`
          update product_variants set stock_quantity = stock_quantity - ${quantity}, updated_at = now()
          where tenant_id = ${TENANT_ID} and id = ${variant.id} and stock_quantity >= ${quantity}
          returning id`;

    if (decremented.length === 0) {
      throw new Error("OUT_OF_STOCK: lost race for last unit");
    }
  });
} catch (err) {
  console.error("Order placement FAILED:", err.message);
  await sql.end();
  process.exit(1);
}

console.log("Order placed:", orderNumber, orderId);

const [afterVariant] = await sql`select stock_quantity from product_variants where tenant_id = ${TENANT_ID} and id = ${variant.id}`;
console.log("stock after:", afterVariant.stock_quantity, "(expected", variant.stock_quantity - quantity, ")");

// Now prove the trigger rejects an illegal transition: pending -> delivered.
console.log("\n--- Illegal transition test: pending -> delivered ---");
try {
  await sql`update orders set status = 'delivered' where tenant_id = ${TENANT_ID} and id = ${orderId}`;
  console.error("FAIL: illegal transition was NOT rejected!");
} catch (err) {
  console.log("PASS (expected failure):", err.message);
}

const [finalOrder] = await sql`select status from orders where tenant_id = ${TENANT_ID} and id = ${orderId}`;
console.log("order status still:", finalOrder.status);

await sql.end();
