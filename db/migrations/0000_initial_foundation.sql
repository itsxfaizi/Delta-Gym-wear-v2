CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE membership_role AS ENUM ('owner', 'catalog_editor', 'publisher', 'auditor');
CREATE TYPE product_status AS ENUM ('draft', 'published', 'unpublished', 'archived');

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_unique UNIQUE (slug)
);

CREATE TABLE memberships (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,
  role membership_role NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memberships_pkey PRIMARY KEY (tenant_id, auth_user_id)
);

CREATE INDEX memberships_auth_user_id_idx ON memberships(auth_user_id);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  handle TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status product_status NOT NULL DEFAULT 'draft',
  current_revision_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_tenant_id_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT products_tenant_handle_unique UNIQUE (tenant_id, handle),
  CONSTRAINT products_version_positive CHECK (version > 0)
);

CREATE INDEX products_tenant_status_idx ON products(tenant_id, status);

CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  sku TEXT NOT NULL,
  size TEXT,
  color TEXT,
  price_amount INTEGER NOT NULL,
  compare_at_price_amount INTEGER,
  currency TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_tenant_sku_unique UNIQUE (tenant_id, sku),
  CONSTRAINT product_variants_tenant_product_fk FOREIGN KEY (tenant_id, product_id)
    REFERENCES products(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT product_variants_price_nonnegative CHECK (price_amount >= 0),
  CONSTRAINT product_variants_compare_price_nonnegative CHECK (
    compare_at_price_amount IS NULL OR compare_at_price_amount >= 0
  )
);

CREATE INDEX product_variants_product_id_idx ON product_variants(product_id);

CREATE TABLE media_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  object_key TEXT NOT NULL,
  alt_text TEXT,
  rights_source TEXT,
  width INTEGER,
  height INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_references_tenant_object_key_unique UNIQUE (tenant_id, object_key),
  CONSTRAINT media_references_tenant_product_fk FOREIGN KEY (tenant_id, product_id)
    REFERENCES products(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT media_references_width_positive CHECK (width IS NULL OR width > 0),
  CONSTRAINT media_references_height_positive CHECK (height IS NULL OR height > 0)
);

CREATE INDEX media_references_product_id_idx ON media_references(product_id);

CREATE TABLE product_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  revision_number INTEGER NOT NULL,
  status product_status NOT NULL,
  snapshot JSONB NOT NULL,
  author_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_revisions_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT product_revisions_product_number_unique UNIQUE (product_id, revision_number),
  CONSTRAINT product_revisions_tenant_product_fk FOREIGN KEY (tenant_id, product_id)
    REFERENCES products(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT product_revisions_number_positive CHECK (revision_number > 0)
);

CREATE INDEX product_revisions_tenant_product_idx ON product_revisions(tenant_id, product_id);

ALTER TABLE products
  ADD CONSTRAINT products_current_revision_fk
  FOREIGN KEY (tenant_id, current_revision_id) REFERENCES product_revisions(tenant_id, id) ON DELETE RESTRICT;

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_user_id UUID,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  request_id TEXT,
  correlation_id TEXT,
  outcome TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_tenant_created_at_idx ON audit_events(tenant_id, created_at);
CREATE INDEX audit_events_target_idx ON audit_events(target_type, target_id);

CREATE OR REPLACE FUNCTION prevent_immutable_record_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% records are immutable', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER product_revisions_immutable
  BEFORE UPDATE OR DELETE ON product_revisions
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_record_mutation();

CREATE TRIGGER audit_events_immutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_record_mutation();

CREATE OR REPLACE FUNCTION enforce_product_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'new products must start in draft'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status AND NOT (
    (OLD.status = 'draft' AND NEW.status = 'published') OR
    (OLD.status = 'published' AND NEW.status = 'unpublished') OR
    (OLD.status = 'unpublished' AND NEW.status = 'draft') OR
    (OLD.status = 'unpublished' AND NEW.status = 'archived') OR
    (OLD.status = 'archived' AND NEW.status = 'draft')
  ) THEN
    RAISE EXCEPTION 'invalid product status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER products_status_transition
  BEFORE INSERT OR UPDATE OF status ON products
  FOR EACH ROW EXECUTE FUNCTION enforce_product_status_transition();
