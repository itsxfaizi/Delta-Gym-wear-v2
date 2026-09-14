import "server-only";

import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { OutOfStockError, assertSufficientStock, type StockVariant } from "@/features/orders/inventory";
import { buildOrderNumber } from "@/features/orders/order-number";
import { ORDER_PRICING, assertTransition, calculateOrderTotals } from "@/features/orders/orders";
import { buildOrderReceiptEmail } from "@/features/orders/receipt-email";
import { checkoutInputSchema, orderStatusTransitionSchema } from "@/features/orders/schemas";
import type { CartLineSnapshot, Order, OrderStatus } from "@/features/orders/types";
import { getOrderById, requireOrdersDatabase } from "./queries";
import type { AuthenticatedPrincipal } from "@/server/authorization";
import { requireTenantRole } from "@/server/authorization";
import { clearCartByToken } from "@/server/cart/mutations";
import { readCartToken } from "@/server/cart/token";
import { getMailer } from "@/server/mail";
import {
  auditEvents,
  orderItems,
  orders,
  productVariants,
  products,
} from "@/server/db/schema";

/** A confirmation email must never block or roll back an order that already committed. */
async function sendOrderConfirmationEmail(order: Order): Promise<void> {
  try {
    const { subject, text, html } = buildOrderReceiptEmail(order);
    await getMailer().send({ to: order.contactEmail, subject, text, html });
  } catch (error) {
    console.error(`placeCodOrder: failed to send confirmation email for ${order.orderNumber}`, error);
  }
}

/** Best-effort: drops the guest/customer server cart once the order is placed. Never blocks checkout. */
async function clearServerCartAfterOrder(): Promise<void> {
  try {
    const token = await readCartToken();
    if (token) await clearCartByToken(token);
  } catch (error) {
    console.error("placeCodOrder: failed to clear the server cart", error);
  }
}

export class UnknownVariantError extends Error {
  public readonly code = "UNKNOWN_VARIANT" as const;

  constructor(public readonly productVariantIds: readonly string[]) {
    super(`These product variants are not purchasable: ${productVariantIds.join(", ")}.`);
    this.name = "UnknownVariantError";
  }
}

export class OrderNotFoundError extends Error {
  public readonly code = "ORDER_NOT_FOUND" as const;

  constructor(orderId: string) {
    super(`Order ${orderId} was not found.`);
    this.name = "OrderNotFoundError";
  }
}

function variantLabel(size: string | null, color: string | null): string | null {
  return [color, size].filter(Boolean).join(" / ") || null;
}

/**
 * Places a cash-on-delivery order. Variant rows are locked FOR UPDATE and the
 * stock decrement is guarded by `stock_quantity >= quantity`, so two concurrent
 * checkouts for the last unit cannot both succeed.
 */
export async function placeCodOrder(
  input: unknown,
  options: { customerId?: string | null; placedAt?: Date } = {},
): Promise<Order> {
  const parsed = checkoutInputSchema.parse(input);
  const { db, tenantId } = requireOrdersDatabase();
  const placedAt = options.placedAt ?? new Date();
  const variantIds = [...new Set(parsed.lines.map((line) => line.productVariantId))];

  const orderId = await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        size: productVariants.size,
        color: productVariants.color,
        priceAmount: productVariants.priceAmount,
        isAvailable: productVariants.isAvailable,
        stockQuantity: productVariants.stockQuantity,
        stockPolicy: productVariants.stockPolicy,
        productTitle: products.title,
      })
      .from(productVariants)
      .innerJoin(
        products,
        and(eq(products.id, productVariants.productId), eq(products.tenantId, productVariants.tenantId)),
      )
      .where(
        and(
          eq(productVariants.tenantId, tenantId),
          inArray(productVariants.id, variantIds),
          eq(productVariants.isAvailable, true),
          eq(products.status, "published"),
        ),
      )
      .for("update", { of: productVariants });

    const missing = variantIds.filter((id) => !rows.some((row) => row.id === id));
    if (missing.length > 0) throw new UnknownVariantError(missing);

    const stock: StockVariant[] = rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      stockQuantity: row.stockQuantity,
      stockPolicy: row.stockPolicy,
    }));
    assertSufficientStock(parsed.lines, stock);

    const lines: CartLineSnapshot[] = parsed.lines.map((line) => {
      const row = rows.find((candidate) => candidate.id === line.productVariantId)!;
      return {
        productVariantId: row.id,
        productTitle: row.productTitle,
        variantLabel: variantLabel(row.size, row.color),
        sku: row.sku,
        unitPriceAmount: row.priceAmount,
        quantity: line.quantity,
        lineTotalAmount: row.priceAmount * line.quantity,
      };
    });

    const totals = calculateOrderTotals(lines);

    // ponytail: per-day count is the sequence source. The unique order_number
    // constraint is the real guard; swap in a Postgres sequence if it ever collides.
    const [counted] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), sql`(${orders.placedAt} AT TIME ZONE 'UTC')::date = (${placedAt.toISOString()}::timestamptz AT TIME ZONE 'UTC')::date`));

    const [order] = await tx
      .insert(orders)
      .values({
        tenantId,
        orderNumber: buildOrderNumber(placedAt, (counted?.total ?? 0) + 1),
        customerId: options.customerId ?? null,
        contactEmail: parsed.contactEmail,
        contactPhone: parsed.contactPhone,
        shippingAddress: parsed.shippingAddress,
        status: "pending",
        paymentMethod: "cod",
        paymentStatus: "unpaid",
        subtotalAmount: totals.subtotalAmount,
        shippingAmount: totals.shippingAmount,
        totalAmount: totals.totalAmount,
        currency: ORDER_PRICING.currency,
        notes: parsed.notes,
        placedAt,
      })
      .returning({ id: orders.id });

    await tx.insert(orderItems).values(
      lines.map((line) => ({ tenantId, orderId: order.id, ...line })),
    );

    for (const line of parsed.lines) {
      const variant = stock.find((candidate) => candidate.id === line.productVariantId)!;
      // 'continue' sells past zero but still counts down, so the admin low-stock view
      // and a later switch back to 'deny' both see real inventory. The column's
      // non-negative CHECK is why the backorder path clamps at zero.
      const isBackorderable = variant.stockPolicy === "continue";
      const decremented = await tx
        .update(productVariants)
        .set({
          stockQuantity: isBackorderable
            ? sql`GREATEST(${productVariants.stockQuantity} - ${line.quantity}, 0)`
            : sql`${productVariants.stockQuantity} - ${line.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productVariants.tenantId, tenantId),
            eq(productVariants.id, line.productVariantId),
            ...(isBackorderable ? [] : [gte(productVariants.stockQuantity, line.quantity)]),
          ),
        )
        .returning({ id: productVariants.id });

      // Lost the race for the last unit: roll the whole order back.
      if (decremented.length === 0) {
        throw new OutOfStockError([
          {
            productVariantId: variant.id,
            sku: variant.sku,
            requested: line.quantity,
            available: variant.stockQuantity,
          },
        ]);
      }
    }

    return order.id;
  });

  const placed = await getOrderById(orderId);
  if (!placed) throw new OrderNotFoundError(orderId);

  await sendOrderConfirmationEmail(placed);
  await clearServerCartAfterOrder();

  return placed;
}

const STATUS_WRITER_ROLES = ["owner", "publisher"] as const;

/** Moves an order along the fulfilment flow and records the change as an audit event. */
export async function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  principal: AuthenticatedPrincipal | null,
): Promise<Order> {
  const actor = requireTenantRole(principal, STATUS_WRITER_ROLES);
  const transition = orderStatusTransitionSchema.parse({ orderId, nextStatus });
  const { db, tenantId } = requireOrdersDatabase();

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, transition.orderId)))
      .limit(1)
      .for("update");

    if (!current) throw new OrderNotFoundError(transition.orderId);
    assertTransition(current.status, transition.nextStatus);

    await tx
      .update(orders)
      .set({ status: transition.nextStatus, updatedAt: new Date() })
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, transition.orderId)));

    await tx.insert(auditEvents).values({
      tenantId,
      actorUserId: actor.userId,
      action: "order.status_changed",
      targetType: "order",
      targetId: transition.orderId,
      outcome: "success",
      before: { status: current.status },
      after: { status: transition.nextStatus },
    });
  });

  const updated = await getOrderById(transition.orderId);
  if (!updated) throw new OrderNotFoundError(transition.orderId);
  return updated;
}
