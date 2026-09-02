CREATE TYPE "public"."order_payment_status" AS ENUM('cod_pending_collection', 'collected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_confirmation', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_handle" text NOT NULL,
	"product_title" text NOT NULL,
	"variant_id" text NOT NULL,
	"sku" text NOT NULL,
	"color" text,
	"size" text,
	"unit_price_amount" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_amounts_nonnegative" CHECK ("order_items"."unit_price_amount" >= 0 and "order_items"."line_total_amount" = "order_items"."unit_price_amount" * "order_items"."quantity")
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_token" text NOT NULL,
	"order_reference" text NOT NULL,
	"status" "order_status" DEFAULT 'pending_confirmation' NOT NULL,
	"payment_status" "order_payment_status" DEFAULT 'cod_pending_collection' NOT NULL,
	"payment_method" text DEFAULT 'cod' NOT NULL,
	"customer_full_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"province" text,
	"postal_code" text,
	"country" text DEFAULT 'PK' NOT NULL,
	"subtotal_amount" integer NOT NULL,
	"shipping_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_token_unique" UNIQUE("order_token"),
	CONSTRAINT "orders_order_reference_unique" UNIQUE("order_reference"),
	CONSTRAINT "orders_payment_method_cod" CHECK ("orders"."payment_method" = 'cod'),
	CONSTRAINT "orders_country_pk" CHECK ("orders"."country" = 'PK'),
	CONSTRAINT "orders_amounts_nonnegative" CHECK ("orders"."subtotal_amount" >= 0 and "orders"."shipping_amount" >= 0 and "orders"."total_amount" = "orders"."subtotal_amount" + "orders"."shipping_amount")
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_created_at_idx" ON "orders" USING btree ("tenant_id","created_at");--> statement-breakpoint
-- ============================================================================
-- Hand-written section, in the same arrangement as 0001 and 0002: drizzle-kit
-- generates the tables, constraints and the ENABLE ROW LEVEL SECURITY half
-- above from src/server/db/schema.ts, but cannot generate privileges.
--
-- Threat model: Supabase publishes every table in `public` over PostgREST using
-- the anon key, which ships to every browser. `orders` holds a customer's name,
-- Pakistani mobile number and home address; `order_items` holds what they
-- bought. RLS is enabled above, but RLS only filters rows a role already has
-- privileges on, so the privileges are narrowed here to nothing.
--
-- No policy is defined for anon or authenticated, deliberately. The application
-- reaches these tables only through the Drizzle/postgres-js connection, which
-- is the table owner and therefore bypasses RLS; no browser client and no
-- PostgREST path reads an order. A role with no grant needs no policy, and a
-- policy without a grant would be dead text implying access that does not
-- exist. Order status is read by opaque 256-bit token through the server, not
-- by a database role.
--
-- If an admin surface ever needs to read orders through PostgREST, add the
-- grant AND its tenant-scoped policy together, and extend db/tests/rls.test.mjs
-- in the same commit.
-- ============================================================================

REVOKE ALL ON orders, order_items FROM anon;
--> statement-breakpoint
REVOKE ALL ON orders, order_items FROM authenticated;
--> statement-breakpoint
GRANT ALL ON orders, order_items TO service_role;
