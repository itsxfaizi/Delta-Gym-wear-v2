import "server-only";

/**
 * Source of truth for `drizzle-kit generate`. Every column, default, unique,
 * check, index and foreign key below is reproduced byte-for-byte by the SQL in
 * db/migrations/0000_initial_foundation.sql, 0001_rls_tenant_isolation.sql,
 * 0002_audit_media_constraints.sql, 0003_cod_orders.sql and
 * 0004_overflow_guard_currency_fk.sql.
 *
 * Four classes of object live ONLY in the SQL migrations because drizzle-kit
 * cannot generate them, and are therefore absent from db/migrations/meta/*.json:
 *   1. `CREATE EXTENSION pgcrypto` (0000).
 *   2. `products_current_revision_fk` (0000) - the composite FK from
 *      products(tenant_id, current_revision_id) to product_revisions. Drizzle
 *      has no lazy form of `foreignKey()`, and products and product_revisions
 *      reference each other, so one direction cannot be declared here.
 *   3. The plpgsql triggers: append-only enforcement on product_revisions and
 *      audit_events and the product status-transition guard (0000); the
 *      BEFORE TRUNCATE statement triggers, the products hard-delete refusal and
 *      the publisher column-scope guard (0002).
 *   4. The RLS policies, the `current_tenant_role()` SECURITY DEFINER helper and
 *      the anon/authenticated/service_role GRANTs (0001, amended in 0002, and
 *      the orders/order_items REVOKEs in 0003). Only the `ENABLE ROW LEVEL
 *      SECURITY` half is generated, from `.enableRLS()`.
 *
 * One further thing drizzle-kit gets right but in the wrong order: a composite
 * FOREIGN KEY and the UNIQUE it points at are emitted FK-first, which will not
 * execute. 0004 swaps those two statements by hand; the snapshot is unaffected
 * because statement order is not part of it. Check the generated SQL, do not
 * assume it runs.
 *
 * Because 3 and 4 are invisible to drizzle-kit, `npm run db:check` is what
 * guards them: it verifies every journal entry against its `.sql` file, its
 * recorded SHA-256 in db/migrations.lock, and its snapshot, then re-runs
 * `drizzle-kit generate` against a scratch copy and requires "No schema
 * changes". Editing a migration by hand without `node db/check.mjs --write`
 * fails the build.
 *
 * Hard delete is not a launch operation (docs/phase-3-foundation-plan.md).
 * 0002 withdraws the DELETE policy and privilege on `products` and adds a
 * trigger that refuses the statement by name; the ON DELETE CASCADE below on
 * product_variants / media_references / product_revisions is retained but
 * unreachable. Archiving is the supported end-of-life path.
 *
 * Regenerating requires stripping the `server-only` import first, because
 * `server-only` is supplied by the Next compiler and is not resolvable by
 * drizzle-kit's CommonJS loader:
 *   sed '/server-only/d' src/server/db/schema.ts > /tmp/schema.ts
 *   npx drizzle-kit generate --dialect postgresql --schema /tmp/schema.ts \
 *     --out db/migrations --name <name>
 * A hand-written tail is then appended to the generated file (see 0001 and
 * 0002), and `node db/check.mjs --write` re-records the checksum.
 */

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  foreignKey,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const membershipRole = pgEnum("membership_role", [
  "owner",
  "catalog_editor",
  "publisher",
  "auditor",
]);

export const productStatus = pgEnum("product_status", [
  "draft",
  "published",
  "unpublished",
  "archived",
]);

export const orderStatus = pgEnum("order_status", [
  "pending_confirmation",
  "confirmed",
  "cancelled",
]);

export const orderPaymentStatus = pgEnum("order_payment_status", [
  "cod_pending_collection",
  "collected",
  "failed",
]);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("tenants_slug_unique").on(table.slug)],
).enableRLS();

export const memberships = pgTable(
  "memberships",
  {
    tenantId: uuid("tenant_id").notNull(),
    authUserId: uuid("auth_user_id").notNull(),
    role: membershipRole("role").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ name: "memberships_pkey", columns: [table.tenantId, table.authUserId] }),
    index("memberships_auth_user_id_idx").on(table.authUserId),
    foreignKey({
      name: "memberships_tenant_id_fkey",
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete("cascade"),
    // RLS compares status to the literal 'active'. No status vocabulary beyond
    // 'active' is approved, so this constrains the SHAPE (lower-cased, trimmed,
    // non-empty) rather than inventing an enum: it stops 'Active' / ' active '
    // rows that would read as enabled in the UI but fail every policy.
    check(
      "memberships_status_check",
      sql`${table.status} <> '' and ${table.status} = lower(btrim(${table.status}))`,
    ),
  ],
).enableRLS();

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    handle: text("handle").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: productStatus("status").notNull().default("draft"),
    currentRevisionId: uuid("current_revision_id"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("products_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("products_tenant_handle_unique").on(table.tenantId, table.handle),
    index("products_tenant_status_idx").on(table.tenantId, table.status),
    check("products_version_positive", sql`${table.version} > 0`),
    index("products_current_revision_idx").on(table.tenantId, table.currentRevisionId),
    foreignKey({
      name: "products_tenant_id_fkey",
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete("restrict"),
  ],
).enableRLS();

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    productId: uuid("product_id").notNull(),
    sku: text("sku").notNull(),
    size: text("size"),
    color: text("color"),
    priceAmount: integer("price_amount").notNull(),
    compareAtPriceAmount: integer("compare_at_price_amount"),
    currency: text("currency").notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("product_variants_tenant_sku_unique").on(table.tenantId, table.sku),
    index("product_variants_product_id_idx").on(table.productId),
    index("product_variants_tenant_product_idx").on(table.tenantId, table.productId),
    foreignKey({
      name: "product_variants_tenant_product_fk",
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("cascade"),
    check("product_variants_price_nonnegative", sql`${table.priceAmount} >= 0`),
    check(
      "product_variants_compare_price_nonnegative",
      sql`${table.compareAtPriceAmount} is null or ${table.compareAtPriceAmount} >= 0`,
    ),
  ],
).enableRLS();

export const mediaReferences = pgTable(
  "media_references",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    productId: uuid("product_id").notNull(),
    objectKey: text("object_key").notNull(),
    altText: text("alt_text"),
    rightsSource: text("rights_source"),
    width: integer("width"),
    height: integer("height"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("media_references_tenant_object_key_unique").on(table.tenantId, table.objectKey),
    index("media_references_product_id_idx").on(table.productId),
    index("media_references_tenant_product_status_idx").on(
      table.tenantId,
      table.productId,
      table.status,
    ),
    foreignKey({
      name: "media_references_tenant_product_fk",
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("cascade"),
    // Mirrors memberships_status_check from 0001. RLS compares this column to
    // the literal 'active'; a row written 'Active' would satisfy the column type
    // and then silently vanish from the storefront. No status vocabulary beyond
    // 'active' is approved, so this constrains the SHAPE, not the value set.
    check(
      "media_references_status_check",
      sql`${table.status} <> '' and ${table.status} = lower(btrim(${table.status}))`,
    ),
    check("media_references_width_positive", sql`${table.width} is null or ${table.width} > 0`),
    check("media_references_height_positive", sql`${table.height} is null or ${table.height} > 0`),
  ],
).enableRLS();

export const productRevisions = pgTable(
  "product_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    productId: uuid("product_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    status: productStatus("status").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    authorUserId: uuid("author_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("product_revisions_tenant_id_unique").on(table.tenantId, table.id),
    unique("product_revisions_product_number_unique").on(table.productId, table.revisionNumber),
    index("product_revisions_tenant_product_idx").on(table.tenantId, table.productId),
    foreignKey({
      name: "product_revisions_tenant_product_fk",
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("cascade"),
    check("product_revisions_number_positive", sql`${table.revisionNumber} > 0`),
  ],
).enableRLS();

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    actorUserId: uuid("actor_user_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    requestId: text("request_id"),
    correlationId: text("correlation_id"),
    outcome: text("outcome").notNull(),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_events_tenant_created_at_idx").on(table.tenantId, table.createdAt),
    index("audit_events_target_idx").on(table.targetType, table.targetId),
    foreignKey({
      name: "audit_events_tenant_id_fkey",
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete("restrict"),
    // The audit contract (docs/pass-2-contracts.md section D) fixes this
    // vocabulary. Nothing else is an outcome.
    check("audit_events_outcome_check", sql`${table.outcome} in ('success', 'denied', 'conflict')`),
    // Section D: before/after carry the status and nothing else. Enforced here
    // so a future caller cannot widen an audit row into a PII snapshot.
    check(
      "audit_events_before_shape_check",
      sql`${table.before} is null or (jsonb_typeof(${table.before}) = 'object' and jsonb_exists(${table.before}, 'status') and (${table.before} - 'status'::text) = '{}'::jsonb)`,
    ),
    check(
      "audit_events_after_shape_check",
      sql`${table.after} is null or (jsonb_typeof(${table.after}) = 'object' and jsonb_exists(${table.after}, 'status') and (${table.after} - 'status'::text) = '{}'::jsonb)`,
    ),
  ],
).enableRLS();

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    orderToken: text("order_token").notNull(),
    orderReference: text("order_reference").notNull(),
    status: orderStatus("status").notNull().default("pending_confirmation"),
    paymentStatus: orderPaymentStatus("payment_status").notNull().default("cod_pending_collection"),
    paymentMethod: text("payment_method").notNull().default("cod"),
    customerFullName: text("customer_full_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    city: text("city").notNull(),
    province: text("province"),
    postalCode: text("postal_code"),
    country: text("country").notNull().default("PK"),
    subtotalAmount: bigint("subtotal_amount", { mode: "number" }).notNull(),
    shippingAmount: bigint("shipping_amount", { mode: "number" }).notNull(),
    totalAmount: bigint("total_amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("orders_order_token_unique").on(table.orderToken),
    unique("orders_order_reference_unique").on(table.orderReference),
    // Redundant as a uniqueness statement (id is already the primary key) and
    // present only because a composite FOREIGN KEY needs a unique target: it is
    // what lets order_items.currency point at its own order's currency. See
    // order_items_order_currency_fk below.
    unique("orders_id_currency_unique").on(table.id, table.currency),
    index("orders_tenant_created_at_idx").on(table.tenantId, table.createdAt),
    // D-007 approves a COD-only, PK-only flow; both are pinned in the database
    // rather than trusted from the application. The arithmetic invariant is the
    // second line of defence behind the server-side recomputation in
    // src/features/orders/actions.ts - a total that disagrees with its parts
    // cannot be stored at all.
    check("orders_payment_method_cod", sql`${table.paymentMethod} = 'cod'`),
    check("orders_country_pk", sql`${table.country} = 'PK'`),
    // The `::numeric` is load-bearing, not decoration. PostgreSQL does not
    // promise an evaluation order between CHECK constraints, so an int8 sum
    // here could raise 22003 numeric_value_out_of_range before
    // orders_amounts_bounded below ever got to refuse the row by name. numeric
    // is arbitrary-precision and cannot overflow, which makes the bound - not
    // an unhandled arithmetic error - the thing that always decides.
    check(
      "orders_amounts_nonnegative",
      sql`${table.subtotalAmount} >= 0 and ${table.shippingAmount} >= 0 and ${table.totalAmount}::numeric = ${table.subtotalAmount}::numeric + ${table.shippingAmount}::numeric`,
    ),
    // Overflow guard, 0004. These are NOT business ceilings - no one decides
    // what an order may cost here. They are the loosest round numbers that make
    // every product and sum this schema computes provably closed under int8:
    // with unit_price <= 1e12 and quantity <= 99, a line total cannot exceed
    // 9.9e13; with subtotal <= 1e15 and shipping <= 1e12, a total cannot exceed
    // ~1.0e15. int8 tops out at 9.2e18, so no CHECK expression here can raise
    // 22003 numeric_value_out_of_range - the named constraint always decides.
    check(
      "orders_amounts_bounded",
      sql`${table.subtotalAmount} <= 1000000000000000 and ${table.shippingAmount} <= 1000000000000`,
    ),
  ],
).enableRLS();

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productHandle: text("product_handle").notNull(),
    productTitle: text("product_title").notNull(),
    variantId: text("variant_id").notNull(),
    sku: text("sku").notNull(),
    color: text("color"),
    size: text("size"),
    unitPriceAmount: bigint("unit_price_amount", { mode: "number" }).notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalAmount: bigint("line_total_amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    // A CHECK cannot see another table, but a composite FOREIGN KEY can: this
    // makes "every line of an order carries that order's currency" a
    // declarative database fact rather than an application convention. It is a
    // second edge to the same parent as order_items_order_id_orders_id_fk and
    // carries the same ON DELETE CASCADE so the two never disagree.
    foreignKey({
      columns: [table.orderId, table.currency],
      foreignColumns: [orders.id, orders.currency],
      name: "order_items_order_currency_fk",
    }).onDelete("cascade"),
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    // `::numeric` for the same reason as orders_amounts_nonnegative: an int8
    // product can overflow, and a CHECK that can raise 22003 is a CHECK that
    // can pre-empt the named bound below.
    check(
      "order_items_amounts_nonnegative",
      sql`${table.unitPriceAmount} >= 0 and ${table.lineTotalAmount}::numeric = ${table.unitPriceAmount}::numeric * ${table.quantity}::numeric`,
    ),
    // Overflow guard, 0004 - see orders_amounts_bounded. The quantity ceiling
    // is not invented either: it is cartLineInputSchema's own `.max(99)`,
    // pinned in the database the way 0003 pinned payment_method and country.
    check(
      "order_items_line_bounded",
      sql`${table.unitPriceAmount} <= 1000000000000 and ${table.quantity} <= 99`,
    ),
  ],
).enableRLS();

export type Tenant = typeof tenants.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type MediaReference = typeof mediaReferences.$inferSelect;
export type ProductRevision = typeof productRevisions.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

export const schema = {
  tenants,
  memberships,
  products,
  productVariants,
  mediaReferences,
  productRevisions,
  auditEvents,
  orders,
  orderItems,
};
