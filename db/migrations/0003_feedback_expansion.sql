-- Existing catalog rows remain visible in the All view until classified.
ALTER TABLE products
  ADD COLUMN audience TEXT,
  ADD COLUMN garment_type TEXT,
  ADD CONSTRAINT products_audience_known CHECK (audience IS NULL OR audience IN ('male', 'female', 'unisex')),
  ADD CONSTRAINT products_garment_type_known CHECK (garment_type IS NULL OR garment_type IN ('tops', 'bottoms'));

CREATE INDEX products_tenant_audience_idx ON products (tenant_id, audience);
CREATE INDEX products_tenant_garment_type_idx ON products (tenant_id, garment_type);

CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  kind TEXT NOT NULL,
  value INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  usage_limit INTEGER NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_tenant_id_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT promo_codes_tenant_code_unique UNIQUE (tenant_id, code),
  CONSTRAINT promo_codes_code_normalized CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  CONSTRAINT promo_codes_kind_known CHECK (kind IN ('percentage', 'fixed')),
  CONSTRAINT promo_codes_value_valid CHECK (
    (kind = 'percentage' AND value BETWEEN 1 AND 100) OR
    (kind = 'fixed' AND value > 0)
  ),
  CONSTRAINT promo_codes_usage_valid CHECK (usage_limit > 0 AND usage_count >= 0 AND usage_count <= usage_limit)
);

CREATE INDEX promo_codes_tenant_active_idx ON promo_codes (tenant_id, active);

-- Application writes use a server-only Postgres connection and always constrain tenant_id.
-- No direct anon or authenticated API policy exposes promotion management or redemption.
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON promo_codes FROM anon, authenticated;

ALTER TABLE orders
  ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN promo_code_id UUID,
  ADD COLUMN promo_code TEXT,
  ADD CONSTRAINT orders_tenant_promo_fk FOREIGN KEY (tenant_id, promo_code_id)
    REFERENCES promo_codes (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT orders_discount_valid CHECK (
    discount_amount >= 0 AND discount_amount <= subtotal_amount AND
    ((promo_code_id IS NULL AND promo_code IS NULL AND discount_amount = 0) OR
      (promo_code_id IS NOT NULL AND promo_code IS NOT NULL AND discount_amount > 0))
  );

ALTER TABLE orders DROP CONSTRAINT orders_total_matches;
ALTER TABLE orders ADD CONSTRAINT orders_total_matches
  CHECK (total_amount = subtotal_amount - discount_amount + shipping_amount);
