-- Track the moment an app-uploaded image becomes unreferenced. An upload that
-- never reaches a product form starts its retention window at token issuance.
CREATE TABLE product_image_objects (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  object_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  unreferenced_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_image_objects_pkey PRIMARY KEY (tenant_id, object_path),
  CONSTRAINT product_image_objects_tenant_public_url_unique UNIQUE (tenant_id, public_url),
  CONSTRAINT product_image_objects_tenant_path_check CHECK (object_path LIKE tenant_id::text || '/%')
);

CREATE INDEX product_image_objects_due_idx ON product_image_objects (unreferenced_at);

ALTER TABLE product_image_objects ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: the service-side database connection alone
-- creates, updates, and cleans up lifecycle rows.
