import postgres from "postgres";

import { assertSafeE2eTarget, closeDb, e2eFixtureUuid, withDb } from "./db";

/** Read-only proof that the supplied keys and tenant belong to the guarded target. */
export async function verifyE2eTargetConnectivity(): Promise<void> {
  const target = assertSafeE2eTarget();
  const sql = postgres(target.databaseUrl, { max: 1, prepare: false, connect_timeout: 5 });

  try {
    const [tenants, serviceResponse, anonResponse] = await Promise.all([
      sql`select id from tenants where id = ${target.tenantId} limit 1`,
      fetch(`${target.supabaseUrl}/auth/v1/admin/users?per_page=1`, {
        headers: {
          apikey: target.serviceRoleKey,
          Authorization: `Bearer ${target.serviceRoleKey}`,
        },
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`${target.supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: target.anonKey },
        signal: AbortSignal.timeout(10_000),
      }),
    ]);

    if (tenants.length !== 1) {
      throw new Error("E2E safety gate: the declared tenant was not found in the isolated database.");
    }
    if (!serviceResponse.ok) {
      throw new Error("E2E safety gate: the service role key was not accepted by the isolated Auth project.");
    }
    if (!anonResponse.ok) {
      throw new Error("E2E safety gate: the browser key was not accepted by the isolated Auth project.");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function ensureTestOwner(target: ReturnType<typeof assertSafeE2eTarget>): Promise<void> {
  const password = process.env.E2E_ADMIN_PASSWORD?.trim();
  if (!password || password.length < 12) {
    throw new Error("E2E setup requires E2E_ADMIN_PASSWORD with at least 12 characters for the test-only owner account.");
  }

  const headers = {
    apikey: target.serviceRoleKey,
    Authorization: `Bearer ${target.serviceRoleKey}`,
    "Content-Type": "application/json",
  };
  const listed = await fetch(`${target.supabaseUrl}/auth/v1/admin/users?per_page=200&page=1`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!listed.ok) throw new Error(`E2E setup could not inspect isolated Auth users (HTTP ${listed.status}).`);
  const payload = await listed.json() as { users?: { id: string; email?: string; email_confirmed_at?: string | null; confirmed_at?: string | null }[] };
  let owner = payload.users?.find((user) => user.email?.toLowerCase() === target.ownerEmail);

  if (!owner) {
    const created = await fetch(`${target.supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: target.ownerEmail, password, email_confirm: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!created.ok) throw new Error(`E2E setup could not create the isolated owner (HTTP ${created.status}).`);
    owner = await created.json() as { id: string; email?: string; email_confirmed_at?: string | null; confirmed_at?: string | null };
  }

  if (!owner.id || !(owner.email_confirmed_at || owner.confirmed_at)) {
    throw new Error("E2E setup requires the configured test owner to have a confirmed email address.");
  }

  await withDb(async (sql) => {
    await sql`
      insert into memberships (tenant_id, auth_user_id, role, status)
      values (${target.tenantId}, ${owner.id}, 'owner', 'active')
      on conflict (tenant_id, auth_user_id) do update
        set role = 'owner', status = 'active', updated_at = now()
    `;
  });
}

/** The storefront E2E suite relies on one published product with stable variants. */
async function ensureStorefrontFixture(target: ReturnType<typeof assertSafeE2eTarget>): Promise<void> {
  const productId = e2eFixtureUuid(target.tenantId, "product:airflow-stringer-tank");
  const variants = [
    { id: e2eFixtureUuid(target.tenantId, "variant:airflow-stringer-tank:xs"), size: "XS", available: false, stock: 0 },
    { id: e2eFixtureUuid(target.tenantId, "variant:airflow-stringer-tank:s"), size: "S", available: true, stock: 1_000_000 },
    { id: e2eFixtureUuid(target.tenantId, "variant:airflow-stringer-tank:m"), size: "M", available: true, stock: 1_000_000 },
    { id: e2eFixtureUuid(target.tenantId, "variant:airflow-stringer-tank:l"), size: "L", available: true, stock: 1_000_000 },
  ];
  const media = [
    { id: e2eFixtureUuid(target.tenantId, "media:airflow-stringer-tank:front"), key: "/design-reference/assets/product-large-normal.png", alt: "Airflow Stringer Tank, front" },
    { id: e2eFixtureUuid(target.tenantId, "media:airflow-stringer-tank:detail"), key: "/design-reference/assets/product-large-hover.png", alt: "Airflow Stringer Tank, fabric detail" },
  ];

  await withDb((sql) => sql.begin(async (tx) => {
    const [existing] = await tx`
      select id, status from products
       where tenant_id = ${target.tenantId} and handle = 'airflow-stringer-tank'
       for update
    `;
    if (existing) {
      if (existing.id !== productId || existing.status !== "published") {
        throw new Error("E2E setup found an unexpected row at the reserved Airflow storefront fixture handle.");
      }
      const existingVariants = await tx`
        select id, sku, size, color, is_available, stock_quantity, stock_policy from product_variants
         where tenant_id = ${target.tenantId} and product_id = ${productId}
         order by size
      `;
      const existingMedia = await tx`
        select id, object_key, alt_text, sort_order, status from media_references
         where tenant_id = ${target.tenantId} and product_id = ${productId} and status = 'active'
         order by sort_order
      `;
      const variantsMatch = existingVariants.length === variants.length && variants.every((variant) => {
        const row = existingVariants.find((candidate) => candidate.size === variant.size);
        return row?.id === variant.id && row.sku === `E2E-AIRFLOW-${variant.size}` && row.color === "Black" &&
          row.is_available === variant.available && Number(row.stock_quantity) >= 0 && row.stock_policy === "deny";
      });
      const mediaMatch = existingMedia.length === media.length && media.every((image, index) => {
        const row = existingMedia[index];
        return row.id === image.id && row.object_key === image.key && row.alt_text === image.alt && row.sort_order === index;
      });
      if (!variantsMatch || !mediaMatch) {
        throw new Error("E2E setup found an incomplete or modified Airflow fixture; refusing to rewrite existing test data.");
      }
      return;
    }

    await tx`
      insert into products (id, tenant_id, handle, title, description, status, audience, garment_type)
      values (${productId}, ${target.tenantId}, 'airflow-stringer-tank', 'Airflow Stringer Tank',
        'Breathable training tank used as the isolated storefront test fixture.', 'draft', 'male', 'tops')
    `;
    for (const variant of variants) {
      await tx`
        insert into product_variants
          (id, tenant_id, product_id, sku, size, color, price_amount, currency, is_available, stock_quantity, stock_policy)
        values (${variant.id}, ${target.tenantId}, ${productId}, ${`E2E-AIRFLOW-${variant.size}`},
          ${variant.size}, 'Black', 320000, 'PKR', ${variant.available}, ${variant.stock}, 'deny')
      `;
    }
    for (const [index, image] of media.entries()) {
      await tx`
        insert into media_references (id, tenant_id, product_id, object_key, alt_text, sort_order, status)
        values (${image.id}, ${target.tenantId}, ${productId}, ${image.key}, ${image.alt}, ${index}, 'active')
      `;
    }
    await tx`update products set status = 'published', updated_at = now() where tenant_id = ${target.tenantId} and id = ${productId}`;
  }));
}

export default async function globalSetup(): Promise<void> {
  await verifyE2eTargetConnectivity();
  const target = assertSafeE2eTarget();
  try {
    await ensureTestOwner(target);
    await ensureStorefrontFixture(target);
  } finally {
    await closeDb();
  }
}
