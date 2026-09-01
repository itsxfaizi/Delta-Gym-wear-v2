import "server-only";

/**
 * Source of truth for `drizzle-kit generate`. Every column, default, unique,
 * check, index and foreign key below is reproduced byte-for-byte by the SQL in
 * db/migrations/0000_initial_foundation.sql, 0001_rls_tenant_isolation.sql and
 * 0002_audit_media_constraints.sql.
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
 *      the anon/authenticated/service_role GRANTs (0001, amended in 0002). Only
 *      the `ENABLE ROW LEVEL SECURITY` half is generated, from `.enableRLS()`.
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

export type Tenant = typeof tenants.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type MediaReference = typeof mediaReferences.$inferSelect;
export type ProductRevision = typeof productRevisions.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;

export const schema = {
  tenants,
  memberships,
  products,
  productVariants,
  mediaReferences,
  productRevisions,
  auditEvents,
};
