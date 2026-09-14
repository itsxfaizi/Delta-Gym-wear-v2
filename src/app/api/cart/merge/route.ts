import { NextResponse } from "next/server";

import { cartLinesRequestSchema } from "@/features/cart/schemas";
import { CartDatabaseUnavailableError } from "@/server/cart/queries";
import { mergeCartOnSignIn } from "@/server/cart/mutations";
import { resolveAuthenticatedCustomerId } from "@/server/cart/identity";
import { getOrCreateCartToken } from "@/server/cart/token";

/**
 * Called once the storefront shell mounts signed in. Combines the shopper's
 * local (localStorage) cart, sent in the body, with whatever this cart token
 * already holds server-side, then attaches the cart to the customer. See
 * src/features/cart/merge.ts for the tested combine/clamp rules.
 */
export async function POST(request: Request) {
  const parsed = cartLinesRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart payload." }, { status: 400 });

  const customerId = await resolveAuthenticatedCustomerId();
  if (!customerId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    const token = await getOrCreateCartToken();
    const lines = await mergeCartOnSignIn(token, customerId, parsed.data.lines);
    return NextResponse.json({ lines });
  } catch (error) {
    // No database: nothing to merge with, so the local lines are already the full cart.
    if (error instanceof CartDatabaseUnavailableError) return NextResponse.json({ lines: parsed.data.lines });
    console.error("POST /api/cart/merge failed", error);
    return NextResponse.json({ lines: parsed.data.lines });
  }
}
