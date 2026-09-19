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

import type { ShippingAddress } from "@/features/orders/types";

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

export const stockPolicy = pgEnum("stock_policy", ["deny", "continue"]);

export const orderStatus = pgEnum("order_status", [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
]);

export const paymentMethod = pgEnum("payment_method", ["cod"]);

export const paymentStatus = pgEnum("payment_status", ["unpaid", "paid", "refunded"]);

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
    stockQuantity: integer("stock_quantity").notNull().default(0),
    stockPolicy: stockPolicy("stock_policy").notNull().default("deny"),
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

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    authUserId: uuid("auth_user_id"),
    email: text("email").notNull(),
    fullName: text("full_name"),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("customers_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("customers_tenant_auth_user_unique").on(table.tenantId, table.authUserId),
    unique("customers_tenant_email_unique").on(table.tenantId, table.email),
    index("customers_tenant_idx").on(table.tenantId),
  ],
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id"),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    province: text("province").notNull(),
    postalCode: text("postal_code"),
    country: text("country").notNull().default("PK"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("addresses_tenant_customer_idx").on(table.tenantId, table.customerId),
    foreignKey({
      name: "addresses_tenant_customer_fk",
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
  ],
);

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    token: text("token").notNull(),
    customerId: uuid("customer_id"),
    currency: text("currency").notNull().default("PKR"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("carts_token_unique").on(table.token),
    unique("carts_tenant_id_id_unique").on(table.tenantId, table.id),
    index("carts_tenant_customer_idx").on(table.tenantId, table.customerId),
    foreignKey({
      name: "carts_tenant_customer_fk",
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    cartId: uuid("cart_id").notNull(),
    productVariantId: uuid("product_variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPriceAmount: integer("unit_price_amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("cart_items_cart_variant_unique").on(table.cartId, table.productVariantId),
    index("cart_items_cart_id_idx").on(table.cartId),
    foreignKey({
      name: "cart_items_tenant_cart_fk",
      columns: [table.tenantId, table.cartId],
      foreignColumns: [carts.tenantId, carts.id],
    }),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    orderNumber: text("order_number").notNull(),
    customerId: uuid("customer_id"),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone").notNull(),
    shippingAddress: jsonb("shipping_address").$type<ShippingAddress>().notNull(),
    status: orderStatus("status").notNull().default("pending"),
    paymentMethod: paymentMethod("payment_method").notNull().default("cod"),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    subtotalAmount: integer("subtotal_amount").notNull(),
    shippingAmount: integer("shipping_amount").notNull().default(0),
    totalAmount: integer("total_amount").notNull(),
    currency: text("currency").notNull().default("PKR"),
    notes: text("notes"),
    placedAt: timestamp("placed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("orders_order_number_unique").on(table.orderNumber),
    unique("orders_tenant_id_id_unique").on(table.tenantId, table.id),
    index("orders_tenant_status_idx").on(table.tenantId, table.status),
    index("orders_tenant_placed_at_idx").on(table.tenantId, table.placedAt),
    foreignKey({
      name: "orders_tenant_customer_fk",
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    orderId: uuid("order_id").notNull(),
    productVariantId: uuid("product_variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    productTitle: text("product_title").notNull(),
    variantLabel: text("variant_label"),
    sku: text("sku").notNull(),
    unitPriceAmount: integer("unit_price_amount").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalAmount: integer("line_total_amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    foreignKey({
      name: "order_items_tenant_order_fk",
      columns: [table.tenantId, table.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }),
  ],
);

/** Timestamps are ISO strings in JSONB; the repository revives them as Dates. */
export type StoredCallAttempt = {
  id: string;
  outcome: string;
  notedAt: string;
  note?: string;
};

export type StoredInternalNote = {
  id: string;
  body: string;
  authorUserId: string;
  notedAt: string;
};

/**
 * Cash-on-delivery working state: call attempts, courier/tracking, internal
 * notes and the COD overlay status. These have no home on `orders` because the
 * order_status enum is the customer-facing lifecycle, while a COD order also
 * moves through states the buyer never sees (awaiting confirmation, refused,
 * returned to sender).
 *
 * Call attempts and notes are JSONB rather than child tables: they are only
 * ever read and written whole, with one row per order, and nothing queries
 * across them.
 */
export const orderOps = pgTable(
  "order_ops",
  {
    orderId: uuid("order_id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    callAttempts: jsonb("call_attempts").$type<StoredCallAttempt[]>().notNull().default([]),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    internalNotes: jsonb("internal_notes").$type<StoredInternalNote[]>().notNull().default([]),
    courier: text("courier"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    opsStatus: text("ops_status"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("order_ops_tenant_id_idx").on(table.tenantId),
    foreignKey({
      name: "order_ops_tenant_order_fk",
      columns: [table.tenantId, table.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }).onDelete("cascade"),
  ],
);

export type Tenant = typeof tenants.$inferSelect;
export type OrderOpsRow = typeof orderOps.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type MediaReference = typeof mediaReferences.$inferSelect;
export type ProductRevision = typeof productRevisions.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type OrderRow = typeof orders.$inferSelect;
export type NewOrderRow = typeof orders.$inferInsert;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type NewOrderItemRow = typeof orderItems.$inferInsert;

export const schema = {
  tenants,
  memberships,
  products,
  productVariants,
  mediaReferences,
  productRevisions,
  auditEvents,
  customers,
  addresses,
  carts,
  cartItems,
  orders,
  orderItems,
};
