export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ["cod"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const STOCK_POLICIES = ["deny", "continue"] as const;
export type StockPolicy = (typeof STOCK_POLICIES)[number];

/** Allowed forward transitions; terminal statuses map to an empty list. */
export const ORDER_STATUS_FLOW = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_STATUS_FLOW[from] as readonly OrderStatus[]).includes(to);
}

/** Snapshotted onto the order so later address edits never mutate history. */
export type ShippingAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  country: string;
};

/** A cart line resolved against the catalog, priced at add-to-cart time. */
export type CartLineSnapshot = {
  productVariantId: string;
  productTitle: string;
  variantLabel: string | null;
  sku: string;
  unitPriceAmount: number;
  quantity: number;
  lineTotalAmount: number;
};

export type OrderItem = CartLineSnapshot & {
  id: string;
  orderId: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  tenantId: string;
  customerId: string | null;
  contactEmail: string;
  contactPhone: string;
  shippingAddress: ShippingAddress;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  notes: string | null;
  placedAt: Date;
  items: OrderItem[];
};
