import { expect, test } from "@playwright/test";

import { assertSafeE2eTarget, withDb } from "./db";

test("retention cron endpoints require the secret and dry runs leave records unchanged", async ({ request }) => {
  const target = assertSafeE2eTarget();
  const cronSecret = process.env.CRON_SECRET;
  expect(cronSecret, "CRON_SECRET must be set explicitly for retention endpoint coverage").toBeTruthy();

  const before = await withDb(async (sql) => {
    const [images] = await sql`
      select coalesce(jsonb_agg(to_jsonb(eligible) order by eligible.unreferenced_at, eligible.object_path), '[]'::jsonb) as rows
        from (
          select object_path, unreferenced_at, deleted_at
            from product_image_objects
           where tenant_id = ${target.tenantId} and deleted_at is null
             and unreferenced_at <= now() - interval '30 days'
           order by unreferenced_at, object_path limit 25
        ) eligible
    `;
    const [audit] = await sql`
      select count(*)::int as count, min(created_at) as oldest, max(created_at) as newest
        from audit_events where created_at < now() - interval '1 year'
    `;
    return { images: images.rows, audit };
  });

  const endpoints = [
    { path: "/api/cron/product-image-retention", expectedDeleted: 0 },
    { path: "/api/cron/audit-retention", expectedDeleted: 0 },
  ] as const;

  for (const endpoint of endpoints) {
    const unauthorized = await request.get(endpoint.path);
    expect(unauthorized.status(), `${endpoint.path} must reject requests without a bearer secret`).toBe(401);
  }

  const [imagesResponse, auditResponse] = await Promise.all([
    request.get("/api/cron/product-image-retention?dryRun=1", { headers: { Authorization: `Bearer ${cronSecret}` } }),
    request.get("/api/cron/audit-retention?dryRun=1", { headers: { Authorization: `Bearer ${cronSecret}` } }),
  ]);
  expect(imagesResponse.status()).toBe(200);
  expect(auditResponse.status()).toBe(200);
  expect(imagesResponse.headers()["cache-control"]).toContain("no-store");
  expect(auditResponse.headers()["cache-control"]).toContain("no-store");

  const imagesResult = await imagesResponse.json() as { eligible: number; deleted: number; failed: number; dryRun: boolean };
  const auditResult = await auditResponse.json() as { eligible: number; deleted: number; dryRun: boolean };
  expect(imagesResult).toMatchObject({ deleted: 0, failed: 0, dryRun: true });
  expect(auditResult).toMatchObject({ deleted: 0, dryRun: true });
  expect(imagesResult.eligible).toBeGreaterThanOrEqual(0);
  expect(auditResult.eligible).toBeGreaterThanOrEqual(0);

  const after = await withDb(async (sql) => {
    const [images] = await sql`
      select coalesce(jsonb_agg(to_jsonb(eligible) order by eligible.unreferenced_at, eligible.object_path), '[]'::jsonb) as rows
        from (
          select object_path, unreferenced_at, deleted_at
            from product_image_objects
           where tenant_id = ${target.tenantId} and deleted_at is null
             and unreferenced_at <= now() - interval '30 days'
           order by unreferenced_at, object_path limit 25
        ) eligible
    `;
    const [audit] = await sql`
      select count(*)::int as count, min(created_at) as oldest, max(created_at) as newest
        from audit_events where created_at < now() - interval '1 year'
    `;
    return { images: images.rows, audit };
  });
  expect(after).toEqual(before);
});
