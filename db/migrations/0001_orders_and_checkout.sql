CREATE TYPE stock_policy AS ENUM ('deny', 'continue');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled');
CREATE TYPE payment_method AS ENUM ('cod');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');

ALTER TABLE product_variants
  ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN stock_policy stock_policy NOT NULL DEFAULT 'deny',
  ADD CONSTRAINT product_variants_stock_nonnegative CHECK (stock_quantity >= 0);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  auth_user_id UUID,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customers_tenant_id_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT customers_tenant_auth_user_unique UNIQUE (tenant_id, auth_user_id),
  CONSTRAINT customers_tenant_email_unique UNIQUE (tenant_id, email)
);

CREATE INDEX customers_tenant_idx ON customers(tenant_id);

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  customer_id UUID,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'PK',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT addresses_tenant_customer_fk FOREIGN KEY (tenant_id, customer_id)
    REFERENCES customers(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX addresses_tenant_customer_idx ON addresses(tenant_id, customer_id);

CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  token TEXT NOT NULL,
  customer_id UUID,
  currency TEXT NOT NULL DEFAULT 'PKR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT carts_token_unique UNIQUE (token),
  CONSTRAINT carts_tenant_id_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT carts_tenant_customer_fk FOREIGN KEY (tenant_id, customer_id)
    REFERENCES customers(tenant_id, id) ON DELETE SET NULL
);

CREATE INDEX carts_tenant_customer_idx ON carts(tenant_id, customer_id);

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cart_id UUID NOT NULL,
  product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_cart_variant_unique UNIQUE (cart_id, product_variant_id),
  CONSTRAINT cart_items_tenant_cart_fk FOREIGN KEY (tenant_id, cart_id)
    REFERENCES carts(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT cart_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT cart_items_unit_price_nonnegative CHECK (unit_price_amount >= 0)
);

CREATE INDEX cart_items_cart_id_idx ON cart_items(cart_id);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  customer_id UUID,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  shipping_address JSONB NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  payment_method payment_method NOT NULL DEFAULT 'cod',
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  subtotal_amount INTEGER NOT NULL,
  shipping_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PKR',
  notes TEXT,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_order_number_unique UNIQUE (order_number),
  CONSTRAINT orders_tenant_id_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT orders_tenant_customer_fk FOREIGN KEY (tenant_id, customer_id)
    REFERENCES customers(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT orders_amounts_nonnegative CHECK (
    subtotal_amount >= 0 AND shipping_amount >= 0 AND total_amount >= 0
  ),
  CONSTRAINT orders_total_matches CHECK (total_amount = subtotal_amount + shipping_amount)
);

CREATE INDEX orders_tenant_status_idx ON orders(tenant_id, status);
CREATE INDEX orders_tenant_placed_at_idx ON orders(tenant_id, placed_at);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_title TEXT NOT NULL,
  variant_label TEXT,
  sku TEXT NOT NULL,
  unit_price_amount INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_total_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_items_tenant_order_fk FOREIGN KEY (tenant_id, order_id)
    REFERENCES orders(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_items_amounts_nonnegative CHECK (
    unit_price_amount >= 0 AND line_total_amount >= 0
  ),
  CONSTRAINT order_items_line_total_matches CHECK (line_total_amount = unit_price_amount * quantity)
);

CREATE INDEX order_items_order_id_idx ON order_items(order_id);

CREATE TRIGGER order_items_immutable
  BEFORE UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_record_mutation();

CREATE OR REPLACE FUNCTION enforce_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'new orders must start as pending'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status AND NOT (
    (OLD.status = 'pending' AND NEW.status IN ('confirmed', 'cancelled')) OR
    (OLD.status = 'confirmed' AND NEW.status IN ('packed', 'cancelled')) OR
    (OLD.status = 'packed' AND NEW.status IN ('shipped', 'cancelled')) OR
    (OLD.status = 'shipped' AND NEW.status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'invalid order status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_status_transition
  BEFORE INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION enforce_order_status_transition();
