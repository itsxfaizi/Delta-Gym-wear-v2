import { NextResponse } from "next/server";

import { cartLinesRequestSchema } from "@/features/cart/schemas";
import { CartDatabaseUnavailableError, getCartLines } from "@/server/cart/queries";
import { setCartLines, clearCartByToken } from "@/server/cart/mutations";
import { resolveAuthenticatedCustomerId } from "@/server/cart/identity";
import { getOrCreateCartToken, readCartToken } from "@/server/cart/token";

/** Current server cart for this visitor's cart-token cookie. `{ lines: [] }` when there is none or no database. */
export async function GET() {
  try {
    const token = await getOrCreateCartToken();
    const lines = await getCartLines(token);
    return NextResponse.json({ lines });
  } catch (error) {
    if (error instanceof CartDatabaseUnavailableError) return NextResponse.json({ lines: [] });
    console.error("GET /api/cart failed", error);
    return NextResponse.json({ lines: [] }, { status: 200 });
  }
}

/** Replaces the server cart with the given lines (resolved and clamped against the live catalog). */
export async function PUT(request: Request) {
  const parsed = cartLinesRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart payload." }, { status: 400 });

  try {
    const token = await getOrCreateCartToken();
    const customerId = await resolveAuthenticatedCustomerId();
    const lines = await setCartLines(token, parsed.data.lines, customerId);
    return NextResponse.json({ lines });
  } catch (error) {
    // No database configured: the local cart stays the source of truth, so echo the request back.
    if (error instanceof CartDatabaseUnavailableError) return NextResponse.json({ lines: parsed.data.lines });
    console.error("PUT /api/cart failed", error);
    return NextResponse.json({ lines: parsed.data.lines });
  }
}

/** Clears the server cart for this visitor (used once an order is placed). */
export async function DELETE() {
  try {
    const token = await readCartToken();
    if (token) await clearCartByToken(token);
  } catch (error) {
    if (!(error instanceof CartDatabaseUnavailableError)) console.error("DELETE /api/cart failed", error);
  }
  return NextResponse.json({ ok: true });
}
