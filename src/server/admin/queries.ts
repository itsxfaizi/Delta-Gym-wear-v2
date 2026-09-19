import "server-only";

import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

import { isRevenue } from "@/features/admin/dashboard";

import {
  countOrdersByStatus,
  DASHBOARD_WINDOW_DAYS,
  LOW_STOCK_THRESHOLD,
  type DashboardOrder,
  type OrderStatusCounts,
} from "@/features/admin/dashboard";
import {
  ADMIN_PAGE_SIZE,
  type AdminProductFilters,
  type ProductFormValues,
  type ProductStatus,
} from "@/features/admin/schemas";
import type { CodStatus } from "@/features/orders/status";
import type { OrderStatus } from "@/features/orders/types";
import { listOrders, type OrderSummary } from "@/server/orders/queries";
import { createDatabase, type Database } from "@/server/db";
import { resolveCodStatus } from "@/server/ops/order-ops";
import { mediaReferences, orderItems, orders, productVariants, products } from "@/server/db/schema";
import { getCatalogTenantId } from "@/server/env";

/** Admin reads degrade to empty exactly like the storefront catalog does. */
function adminDatabase(): { db: Database; tenantId: string } | null {
  if (!process.env.DATABASE_URL) return null;
  return { db: createDatabase(), tenantId: getCatalogTenantId() };
}

export type AdminProductRow = {
  id: string;
  title: string;
  handle: string;
  status: ProductStatus;
  updatedAt: Date;
  variantCount: number;
  lowestPriceAmount: number | null;
  totalStock: number;
};

export async function listAdminProducts(
  filters: AdminProductFilters,
): Promise<{ rows: AdminProductRow[]; total: number; pageCount: number }> {
  const scope = adminDatabase();
  if (!scope) return { rows: [], total: 0, pageCount: 1 };
  const { db, tenantId } = scope;

  const where = and(
    eq(products.tenantId, tenantId),
    filters.status ? eq(products.status, filters.status) : undefined,
    filters.q ? or(ilike(products.title, `%${filters.q}%`), ilike(products.handle, `%${filters.q}%`)) : undefined,
  );

  const [productRows, [counted]] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(desc(products.updatedAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((filters.page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(products).where(where),
  ]);

  const variantRows = productRows.length
    ? await db
        .select({
          productId: productVariants.productId,
          priceAmount: productVariants.priceAmount,
          stockQuantity: productVariants.stockQuantity,
        })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.tenantId, tenantId),
            inArray(
              productVariants.productId,
              productRows.map((row) => row.id),
            ),
          ),
        )
    : [];

  const rows = productRows.map((product) => {
    const variants = variantRows.filter((variant) => variant.productId === product.id);
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      updatedAt: product.updatedAt,
      variantCount: variants.length,
      lowestPriceAmount: variants.length ? Math.min(...variants.map((v) => v.priceAmount)) : null,
      totalStock: variants.reduce((total, variant) => total + variant.stockQuantity, 0),
    };
  });

  const total = counted?.total ?? 0;
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

const toFormText = (value: string | null) => value ?? "";
const toFormNumber = (value: number | null) => (value === null ? "" : String(value));

/** Loads a product already shaped as the form's default values. */
export async function getAdminProductForm(productId: string): Promise<ProductFormValues | null> {
  const scope = adminDatabase();
  if (!scope) return null;
  const { db, tenantId } = scope;

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .limit(1);
  if (!product) return null;

  const [variants, media] = await Promise.all([
    db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.tenantId, tenantId), eq(productVariants.productId, product.id)))
      .orderBy(asc(productVariants.sku)),
    db
      .select()
      .from(mediaReferences)
      .where(and(eq(mediaReferences.tenantId, tenantId), eq(mediaReferences.productId, product.id)))
      .orderBy(asc(mediaReferences.createdAt)),
  ]);

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    description: toFormText(product.description),
    status: product.status,
    variants: variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      size: toFormText(variant.size),
      color: toFormText(variant.color),
      priceAmount: String(variant.priceAmount),
      compareAtPriceAmount: toFormNumber(variant.compareAtPriceAmount),
      stockQuantity: String(variant.stockQuantity),
      stockPolicy: variant.stockPolicy,
      isAvailable: variant.isAvailable,
    })),
    media: media.map((item) => ({ objectKey: item.objectKey, altText: toFormText(item.altText) })),
  };
}

export type LowStockVariant = {
  id: string;
  sku: string;
  productId: string;
  productTitle: string;
  stockQuantity: number;
};

export type AdminDashboard = {
  windowDays: number;
  statusCounts: OrderStatusCounts;
  /** Trailing two windows of orders, effective COD status applied. Everything else is derived from these. */
  windowOrders: DashboardOrder[];
  soldItems: SoldItem[];
  lowStock: LowStockVariant[];
  recentOrders: OrderSummary[];
  awaitingConfirmation: OrderSummary[];
  productCount: number;
  customerCount: number;
};

export type SoldItem = {
  productId: string | null;
  productTitle: string;
  quantity: number;
  lineTotalAmount: number;
};

const EMPTY_DASHBOARD: AdminDashboard = {
  windowDays: DASHBOARD_WINDOW_DAYS,
  statusCounts: countOrdersByStatus([]),
  windowOrders: [],
  soldItems: [],
  lowStock: [],
  recentOrders: [],
  awaitingConfirmation: [],
  productCount: 0,
  customerCount: 0,
};

/**
 * The ops overlay lives outside the drizzle schema, so refused/returned outcomes only
 * exist for orders the console has already touched.
 * ponytail: overlaid for shipped orders only — every other COD status equals the DB column.
 */
async function toCodStatus(order: { id: string; status: OrderStatus }): Promise<CodStatus> {
  return (await resolveCodStatus(order.id, order.status)) as CodStatus;
}

/** `windowDays` is the trailing window the dashboard reports on; twice that is fetched so it has a prior period to compare against. */
export async function getAdminDashboard(windowDays: number = DASHBOARD_WINDOW_DAYS): Promise<AdminDashboard> {
  const scope = adminDatabase();
  if (!scope) return { ...EMPTY_DASHBOARD, windowDays };
  const { db, tenantId } = scope;

  const windowStart = new Date(Date.now() - 2 * windowDays * 86_400_000);

  const [statusRows, windowRows, itemRows, lowStock, recent, pending, [productCount], [customerCount]] =
    await Promise.all([
      db
        .select({ status: orders.status, total: count() })
        .from(orders)
        .where(eq(orders.tenantId, tenantId))
        .groupBy(orders.status),
      db
        .select({
          id: orders.id,
          status: orders.status,
          totalAmount: orders.totalAmount,
          placedAt: orders.placedAt,
        })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), gte(orders.placedAt, windowStart)))
        .orderBy(desc(orders.placedAt)),
      db
        .select({
          productId: productVariants.productId,
          productTitle: orderItems.productTitle,
          quantity: orderItems.quantity,
          lineTotalAmount: orderItems.lineTotalAmount,
          orderStatus: orders.status,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .leftJoin(productVariants, eq(productVariants.id, orderItems.productVariantId))
        .where(and(eq(orderItems.tenantId, tenantId), gte(orders.placedAt, windowStart))),
      db
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          productId: productVariants.productId,
          productTitle: products.title,
          stockQuantity: productVariants.stockQuantity,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            eq(productVariants.tenantId, tenantId),
            eq(productVariants.stockPolicy, "deny"),
            lte(productVariants.stockQuantity, LOW_STOCK_THRESHOLD),
          ),
        )
        .orderBy(asc(productVariants.stockQuantity))
        .limit(10),
      listOrders({ limit: 8 }),
      listOrders({ status: "pending", limit: 8 }),
      db.select({ total: sql<number>`count(*)::int` }).from(products).where(eq(products.tenantId, tenantId)),
      // Everyone who has ordered, not just registered accounts — this KPI links to
      // /admin/customers, which derives its rows from orders and counts guests too.
      // Mirrors customerKeyFor(): account id when there is one, else contact phone.
      db
        .select({
          total: sql<number>`count(distinct coalesce(${orders.customerId}::text, nullif(regexp_replace(${orders.contactPhone}, '\\D', '', 'g'), ''), lower(${orders.contactEmail})))::int`,
        })
        .from(orders)
        .where(eq(orders.tenantId, tenantId)),
    ]);

  const statusCounts = countOrdersByStatus([]);
  for (const row of statusRows) statusCounts[row.status as OrderStatus] = Number(row.total);

  const windowOrders = await Promise.all(
    windowRows.map(async (row) => ({
      status: await toCodStatus(row),
      totalAmount: row.totalAmount,
      placedAt: row.placedAt,
    })),
  );

  return {
    windowDays,
    statusCounts,
    windowOrders,
    // Same revenue rule as the KPI: a refused parcel is not a sale.
    soldItems: itemRows.filter((row) => isRevenue(row.orderStatus)),
    lowStock,
    recentOrders: recent.orders,
    awaitingConfirmation: pending.orders,
    productCount: productCount?.total ?? 0,
    customerCount: customerCount?.total ?? 0,
  };
}
