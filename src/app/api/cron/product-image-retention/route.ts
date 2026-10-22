import { timingSafeEqual } from "node:crypto";

import { cleanupUnreferencedProductImages } from "@/server/media/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const received = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const actualBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const result = await cleanupUnreferencedProductImages({ dryRun });
    return Response.json(result, { status: result.failed ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Product image retention run failed", error);
    return Response.json({ error: "Product image retention could not complete" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
