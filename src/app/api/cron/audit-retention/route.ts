import { timingSafeEqual } from "node:crypto";

import { purgeExpiredAuditEvents } from "@/server/admin/audit-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const received = request.headers.get("authorization") ?? "";
  const expectedBytes = Buffer.from(`Bearer ${secret}`);
  const receivedBytes = Buffer.from(received);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const result = await purgeExpiredAuditEvents({ dryRun });
    return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Audit retention run failed", error);
    return Response.json({ error: "Audit retention could not complete" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
