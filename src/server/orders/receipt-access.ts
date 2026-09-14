import "server-only";

import { cookies } from "next/headers";

/**
 * Order numbers are a readable per-day sequence, so they are NOT a capability:
 * anyone could walk DG-YYMMDD-0001.. and read every customer's address. A guest
 * proves they placed an order with this httpOnly cookie; a signed-in customer is
 * matched on the order's customerId instead.
 */
const RECEIPT_COOKIE = "delta-orders";
const REMEMBERED_LIMIT = 10;
const REMEMBERED_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function readRemembered(value: string | undefined): string[] {
  return (value ?? "").split(",").filter(Boolean);
}

export async function rememberPlacedOrder(orderNumber: string): Promise<void> {
  const store = await cookies();
  const remembered = readRemembered(store.get(RECEIPT_COOKIE)?.value)
    .filter((remembers) => remembers !== orderNumber);

  store.set(RECEIPT_COOKIE, [...remembered, orderNumber].slice(-REMEMBERED_LIMIT).join(","), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: REMEMBERED_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function hasPlacedOrder(orderNumber: string): Promise<boolean> {
  const store = await cookies();
  return readRemembered(store.get(RECEIPT_COOKIE)?.value).includes(orderNumber);
}
