-- Product photography is public-read by owner decision (ADR-002). Only a
-- server-authorized, short-lived signed URL can upload a new object.
ALTER TABLE media_references
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT media_references_sort_order_nonnegative CHECK (sort_order >= 0);

CREATE INDEX media_references_tenant_product_sort_idx
  ON media_references (tenant_id, product_id, sort_order, created_at);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 'product-images', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
