/**
 * One-way copy of the v1 (Prisma) catalog into the v2 (drizzle) tables.
 *
 * v1's PascalCase tables are READ-ONLY here — this script never writes to them.
 * It is idempotent: re-running updates the same rows rather than duplicating,
 * keyed on (tenant_id, handle) for products, (tenant_id, sku) for variants and
 * (tenant_id, object_key) for media.
 *
 * Run: DB_URL=... DELTA_TENANT_ID=... node scripts/copy-v1-catalog.mjs
 */
import postgres from "postgres";

const DB_URL = process.env.DB_URL;
const TENANT_ID = process.env.DELTA_TENANT_ID;
if (!DB_URL || !TENANT_ID) {
  console.error("DB_URL and DELTA_TENANT_ID are required");
  process.exit(1);
}

const sql = postgres(DB_URL, { ssl: "require", max: 1, connect_timeout: 30 });

/** v1 stores price as numeric "3200.00"; v2 stores integer minor units. */
function toMinorUnits(value) {
  if (value === null || value === undefined) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error(`Not a price: ${value}`);
  return Math.round(amount * 100);
}

/** v2 handles must be lowercase dash-separated alphanumerics. */
function toHandle(slug, fallback) {
  const handle = String(slug || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!handle) throw new Error(`Cannot derive a handle from ${slug}`);
  return handle;
}

const before = await sql`
  select
    (select count(*)::int from products where tenant_id = ${TENANT_ID}) as products,
    (select count(*)::int from product_variants where tenant_id = ${TENANT_ID}) as variants,
    (select count(*)::int from media_references where tenant_id = ${TENANT_ID}) as media`;
console.log("before:", before[0]);

const v1Products = await sql`
  select p.id, p.name, p.slug, p.subtitle, p.description, p.status, c.name as category
  from "Product" p left join "Category" c on c.id = p."categoryId"
  order by p."createdAt"`;
console.log(`read ${v1Products.length} v1 products (read-only)`);

let variantCount = 0;
let mediaCount = 0;
const skipped = [];

for (const product of v1Products) {
  const handle = toHandle(product.slug, product.name);
  // The description keeps v1's subtitle, which v2 has no column for.
  const description = [product.subtitle, product.description].filter(Boolean).join("\n\n") || null;

  // enforce_product_status_transition() requires every insert to start as draft.
  const [row] = await sql`
    insert into products (tenant_id, handle, title, description, status)
    values (${TENANT_ID}, ${handle}, ${product.name}, ${description}, 'draft')
    on conflict (tenant_id, handle)
      do update set title = excluded.title, description = excluded.description, updated_at = now()
    returning id, status`;

  // v1 ACTIVE means live; the trigger only allows draft -> published.
  if (product.status === "ACTIVE" && row.status === "draft") {
    await sql`update products set status = 'published', updated_at = now() where id = ${row.id}`;
  }

  const v1Variants = await sql`
    select sku, size, color, price, "compareAt", stock, "isActive"
    from "ProductVariant" where "productId" = ${product.id} order by sku`;

  for (const variant of v1Variants) {
    const price = toMinorUnits(variant.price);
    if (price === null || price <= 0) {
      skipped.push(`${product.name} / ${variant.sku}: unusable price ${variant.price}`);
      continue;
    }
    await sql`
      insert into product_variants
        (tenant_id, product_id, sku, size, color, price_amount, compare_at_price_amount,
         currency, is_available, stock_quantity, stock_policy)
      values
        (${TENANT_ID}, ${row.id}, ${variant.sku}, ${variant.size ?? null}, ${variant.color ?? null},
         ${price}, ${toMinorUnits(variant.compareAt)}, 'PKR', ${variant.isActive},
         ${Math.max(0, variant.stock ?? 0)}, 'deny')
      on conflict (tenant_id, sku) do update set
        product_id = excluded.product_id, size = excluded.size, color = excluded.color,
        price_amount = excluded.price_amount, compare_at_price_amount = excluded.compare_at_price_amount,
        is_available = excluded.is_available, stock_quantity = excluded.stock_quantity, updated_at = now()`;
    variantCount += 1;
  }

  const v1Images = await sql`
    select url, "altText" from "ProductImage"
    where "productId" = ${product.id} order by "isPrimary" desc, "sortOrder"`;

  for (const image of v1Images) {
    await sql`
      insert into media_references (tenant_id, product_id, object_key, alt_text, rights_source, status)
      values (${TENANT_ID}, ${row.id}, ${image.url}, ${image.altText ?? product.name}, 'v1-catalog', 'active')
      on conflict (tenant_id, object_key) do update set
        product_id = excluded.product_id, alt_text = excluded.alt_text, updated_at = now()`;
    mediaCount += 1;
  }
}

const after = await sql`
  select
    (select count(*)::int from products where tenant_id = ${TENANT_ID}) as products,
    (select count(*)::int from products where tenant_id = ${TENANT_ID} and status = 'published') as published,
    (select count(*)::int from product_variants where tenant_id = ${TENANT_ID}) as variants,
    (select count(*)::int from media_references where tenant_id = ${TENANT_ID}) as media`;
console.log("after: ", after[0]);
console.log(`wrote ${variantCount} variants, ${mediaCount} media rows`);
if (skipped.length) console.log("skipped:\n  " + skipped.join("\n  "));

const v1After = await sql`
  select (select count(*)::int from "Product") as products,
         (select count(*)::int from "ProductVariant") as variants`;
console.log("v1 untouched:", v1After[0]);

await sql.end();
