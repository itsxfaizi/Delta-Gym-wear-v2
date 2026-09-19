-- Cash-on-delivery working state.
--
-- Call attempts, courier/tracking, internal notes and the COD overlay status
-- previously lived in a module-level Map in the server process: lost on every
-- restart, and invisible to any other instance. This gives them a home.
--
-- The overlay status is deliberately NOT the `orders.status` enum. That enum is
-- the customer-facing lifecycle and is guarded by the transition trigger from
-- 0001; a COD order also passes through states the buyer never sees
-- (confirmation_required, refused, returned_to_sender).

CREATE TABLE IF NOT EXISTS order_ops (
  order_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  call_attempts jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_attempt_at timestamptz,
  next_follow_up_at timestamptz,
  internal_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  courier text,
  tracking_number text,
  tracking_url text,
  dispatched_at timestamptz,
  ops_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_ops_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES orders (tenant_id, id)
    ON DELETE CASCADE,
  -- Both are arrays of objects; a stray object or scalar would break the reader.
  CONSTRAINT order_ops_call_attempts_is_array CHECK (jsonb_typeof(call_attempts) = 'array'),
  CONSTRAINT order_ops_internal_notes_is_array CHECK (jsonb_typeof(internal_notes) = 'array'),
  CONSTRAINT order_ops_ops_status_known CHECK (
    ops_status IS NULL OR ops_status IN (
      'confirmation_required',
      'pending',
      'confirmed',
      'packed',
      'shipped',
      'delivered',
      'refused',
      'returned_to_sender',
      'cancelled'
    )
  )
);

CREATE INDEX IF NOT EXISTS order_ops_tenant_id_idx ON order_ops (tenant_id);

-- Row level security: this table carries operator notes and customer call
-- history, so it is never readable by the anon key. Server access goes through
-- the service role / postgres connection, which bypasses RLS.
ALTER TABLE order_ops ENABLE ROW LEVEL SECURITY;
