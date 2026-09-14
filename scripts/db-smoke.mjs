/**
 * Read-path smoke test + catalog integrity check against the live v2 tables.
 * Read-only. Never touches PascalCase v1 tables.
 * Run: DB_URL=... DELTA_TENANT_ID=... node scripts/db-smoke.mjs
 */
import postgres from "postgres";

const DB_URL = process.env.DB_URL;
const TENANT_ID = process.env.DELTA_TENANT_ID;
if (!DB_URL || !TENANT_ID) {
  console.error("DB_URL and DELTA_TENANT_ID are required");
  process.exit(1);
}

const sql = postgres(DB_URL, { ssl: "require", max: 1, connect_timeout: 30 });

async function section(title, fn) {
  console.log(`\n=== ${title} ===`);
  try {
    await fn();
  } catch (err) {
    console.error("FAIL:", err.message);
  }
}

await section("products count / status", async () => {
  const rows = await sql`select status, count(*)::int from products where tenant_id = ${TENANT_ID} group by status`;
  console.log(rows);
});

await section("zero-variant products", async () => {
  const rows = await sql`
    select p.id, p.handle, p.title
    from products p
    left join product_variants v on v.product_id = p.id and v.tenant_id = p.tenant_id
    where p.tenant_id = ${TENANT_ID}
    group by p.id
    having count(v.id) = 0`;
  console.log(rows);
});

await section("variants price <= 0", async () => {
  const rows = await sql`
    select id, sku, price_amount from product_variants
    where tenant_id = ${TENANT_ID} and price_amount <= 0`;
  console.log(rows);
});

await section("duplicate handles", async () => {
  const rows = await sql`
    select handle, count(*)::int from products where tenant_id = ${TENANT_ID}
    group by handle having count(*) > 1`;
  console.log(rows);
});

await section("duplicate skus", async () => {
  const rows = await sql`
    select sku, count(*)::int from product_variants where tenant_id = ${TENANT_ID}
    group by sku having count(*) > 1`;
  console.log(rows);
});

await section("media pointing at products that don't exist / wrong tenant", async () => {
  const rows = await sql`
    select m.id, m.object_key, m.product_id
    from media_references m
    left join products p on p.id = m.product_id and p.tenant_id = m.tenant_id
    where m.tenant_id = ${TENANT_ID} and p.id is null`;
  console.log(rows);
});

await section("media count / products count / variants count", async () => {
  const [p] = await sql`select count(*)::int from products where tenant_id = ${TENANT_ID}`;
  const [v] = await sql`select count(*)::int from product_variants where tenant_id = ${TENANT_ID}`;
  const [m] = await sql`select count(*)::int from media_references where tenant_id = ${TENANT_ID}`;
  console.log({ products: p.count, variants: v.count, media: m.count });
});

await section("sample getPublishedProduct handle", async () => {
  const [product] = await sql`select * from products where tenant_id = ${TENANT_ID} and status = 'published' limit 1`;
  console.log("product:", product?.handle);
  if (product) {
    const variants = await sql`select * from product_variants where tenant_id = ${TENANT_ID} and product_id = ${product.id}`;
    console.log("variants:", variants.length);
  }
});

await section("orders table state", async () => {
  const rows = await sql`select status, count(*)::int from orders where tenant_id = ${TENANT_ID} group by status`;
  console.log(rows);
});

await section("customers count", async () => {
  const [c] = await sql`select count(*)::int from customers where tenant_id = ${TENANT_ID}`;
  console.log(c);
});

await sql.end();
