import type { CartLineInput } from "@/features/catalog/cart";
import type { Result } from "@/features/result";

export const ORDER_STATUSES = ["pending_confirmation", "confirmed", "cancelled"] as const;
export const ORDER_PAYMENT_STATUSES = ["cod_pending_collection", "collected", "failed"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];

export type CheckoutField =
  | "fullName"
  | "phone"
  | "email"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "province"
  | "postalCode"
  | "cartLines";

export type CheckoutSuccess = { orderToken: string };

/**
 * Contract B. `null` before the first submission — the form has no result yet,
 * which is not the same thing as a failed one.
 */
export type CheckoutState = Result<CheckoutSuccess> | null;

export type CheckoutOrderInput = {
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province?: string;
  postalCode?: string;
  country: "PK";
  cartLines: CartLineInput[];
};

export type OrderLineSnapshot = {
  productHandle: string;
  productTitle: string;
  variantId: string;
  sku: string;
  color: string | null;
  size: string | null;
  unitPriceAmount: number;
  quantity: number;
  lineTotalAmount: number;
  currency: string;
};

export type PublicOrder = {
  orderToken: string;
  orderReference: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paymentMethod: "cod";
  customerFullName: string;
  customerPhone: string;
  customerEmail: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string | null;
  postalCode: string | null;
  country: "PK";
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  createdAt: Date;
  lines: OrderLineSnapshot[];
};
