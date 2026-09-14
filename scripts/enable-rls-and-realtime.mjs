/**
 * Secures the v2 tables and turns on Supabase Realtime for them.
 *
 * Why RLS matters here: a table in the `public` schema with RLS disabled is
 * readable through the publishable (anon) key, and that key ships in the browser
 * bundle. Enabling RLS with no policy is deny-by-default for PostgREST and
 * Realtime, while the app's own drizzle connection authenticates as the table
 * owner and is unaffected.
 *
 * Realtime then needs an explicit SELECT policy, because a subscriber only
 * receives rows it is allowed to read. Admin surfaces get one scoped to active
 * memberships, so a signed-in staff member streams their tenant's orders and
 * nobody else does.
 *
 * v1's PascalCase tables are never touched — they carry their own RLS already.
 *
 * Run: DB_URL=... node scripts/enable-rls-and-realtime.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DB_URL, { ssl: "require", max: 1, connect_timeout: 30 });

const V2_TABLES = [
  "tenants", "memberships", "products", "product_variants", "media_references",
  "product_revisions", "audit_events", "customers", "addresses", "carts",
  "cart_items", "orders", "order_items",
];

// Realtime is only useful where the UI reacts to changes.
const REALTIME_TABLES = ["orders", "order_items", "products", "product_variants", "customers"];

for (const table of V2_TABLES) {
  await sql.unsafe(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
}
console.log(`RLS enabled on ${V2_TABLES.length} v2 tables (deny-by-default for the anon key)`);

// One helper instead of repeating the membership lookup in every policy.
await sql.unsafe(`
  CREATE OR REPLACE FUNCTION public.is_active_tenant_member(target_tenant uuid)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = target_tenant
        AND m.auth_user_id = auth.uid()
        AND m.status = 'active'
    );
  $$;
`);
console.log("helper is_active_tenant_member() created");

// Staff read access, so Realtime can deliver rows to a signed-in admin.
for (const table of ["orders", "order_items", "customers", "products", "product_variants"]) {
  await sql.unsafe(`DROP POLICY IF EXISTS ${table}_staff_read ON public.${table}`);
  await sql.unsafe(`
    CREATE POLICY ${table}_staff_read ON public.${table}
    FOR SELECT TO authenticated
    USING (public.is_active_tenant_member(tenant_id));
  `);
}
console.log("staff SELECT policies created (authenticated + active membership only)");

// Realtime sends the full old row on UPDATE/DELETE only with replica identity full;
// without it an UPDATE event carries just the primary key.
for (const table of REALTIME_TABLES) {
  await sql.unsafe(`ALTER TABLE public.${table} REPLICA IDENTITY FULL`);
  const [already] = await sql`
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = ${table}`;
  if (!already) {
    await sql.unsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE public.${table}`);
  }
}
console.log(`realtime enabled for: ${REALTIME_TABLES.join(", ")}`);

const state = await sql`
  select c.relname as table, c.relrowsecurity as rls,
         (select count(*)::int from pg_policies p where p.tablename = c.relname) as policies,
         exists (select 1 from pg_publication_tables t
                 where t.pubname = 'supabase_realtime' and t.tablename = c.relname) as realtime
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname = lower(c.relname)
    and c.relname <> '_prisma_migrations'
  order by 1`;
console.log("\nfinal state:");
for (const r of state) {
  console.log(`  ${r.table.padEnd(20)} rls=${r.rls} policies=${r.policies} realtime=${r.realtime}`);
}

await sql.end();
