import "server-only";

import {
  boolean,
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
);

export const memberships = pgTable(
  "memberships",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    authUserId: uuid("auth_user_id").notNull(),
    role: membershipRole("role").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ name: "memberships_pkey", columns: [table.tenantId, table.authUserId] }),
    index("memberships_auth_user_id_idx").on(table.authUserId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
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
  ],
);

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
    foreignKey({
      name: "product_variants_tenant_product_fk",
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }),
  ],
);

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
    foreignKey({
      name: "media_references_tenant_product_fk",
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }),
  ],
);

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
    }),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id"),
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
  ],
);

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
    subtotalAmount: integer("subtotal_amount").notNull(),
    shippingAmount: integer("shipping_amount").notNull(),
    totalAmount: integer("total_amount").notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("orders_order_token_unique").on(table.orderToken),
    unique("orders_order_reference_unique").on(table.orderReference),
    index("orders_tenant_created_at_idx").on(table.tenantId, table.createdAt),
  ],
);

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
    unitPriceAmount: integer("unit_price_amount").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalAmount: integer("line_total_amount").notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
  ],
);

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
