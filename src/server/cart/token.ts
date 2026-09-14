import "server-only";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

const CART_COOKIE = "delta-cart-token";
const CART_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/** Reads the visitor's cart token without minting one. */
export async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

/** Reads the cart token cookie, minting and setting an opaque, unguessable one if absent. */
export async function getOrCreateCartToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CART_COOKIE)?.value;
  if (existing) return existing;

  const token = randomBytes(24).toString("base64url");
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
  return token;
}
