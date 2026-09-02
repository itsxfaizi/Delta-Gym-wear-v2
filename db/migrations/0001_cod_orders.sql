CREATE TYPE order_status AS ENUM ('pending_confirmation', 'confirmed', 'cancelled');
CREATE TYPE order_payment_status AS ENUM ('cod_pending_collection', 'collected', 'failed');

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_token TEXT NOT NULL,
  order_reference TEXT NOT NULL,
  status order_status NOT NULL DEFAULT 'pending_confirmation',
  payment_status order_payment_status NOT NULL DEFAULT 'cod_pending_collection',
  payment_method TEXT NOT NULL DEFAULT 'cod',
  customer_full_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  province TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'PK',
  subtotal_amount INTEGER NOT NULL,
  shipping_amount INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_order_token_unique UNIQUE (order_token),
  CONSTRAINT orders_order_reference_unique UNIQUE (order_reference),
  CONSTRAINT orders_payment_method_cod CHECK (payment_method = 'cod'),
  CONSTRAINT orders_country_pk CHECK (country = 'PK'),
  CONSTRAINT orders_amounts_nonnegative CHECK (
    subtotal_amount >= 0
    AND shipping_amount >= 0
    AND total_amount = subtotal_amount + shipping_amount
  )
);

CREATE INDEX orders_tenant_created_at_idx ON orders(tenant_id, created_at);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_handle TEXT NOT NULL,
  product_title TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  color TEXT,
  size TEXT,
  unit_price_amount INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_total_amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_items_amounts_nonnegative CHECK (
    unit_price_amount >= 0
    AND line_total_amount = unit_price_amount * quantity
  )
);

CREATE INDEX order_items_order_id_idx ON order_items(order_id);
