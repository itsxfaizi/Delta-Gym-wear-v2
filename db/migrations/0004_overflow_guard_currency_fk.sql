-- ============================================================================
-- Overflow guard and cross-table currency integrity for the COD order tables.
--
-- WHY THE MONEY COLUMNS ARE WIDENED, NOT BOUNDED IN PLACE
-- They were int4. The approved input contract already permits a cart of 100
-- lines x 99 units (cartLineInputSchema in src/features/catalog/cart.ts), and
-- at the seeded price of 599900 minor units that is 5,939,010,000 - past
-- int4's 2,147,483,647 ceiling by construction, not by abuse. A bounded int4
-- would have had to refuse orders the system already promises to accept, so
-- the column type is what changes, not the promise.
--
-- WHY WIDENING ALONE WOULD NOT HAVE BEEN ENOUGH
-- int8 does not wrap either; it raises 22003 numeric_value_out_of_range, just
-- further out. unit_price * quantity with an unbounded unit_price still
-- overflows. The two new CHECKs close the arithmetic: with unit_price <= 1e12
-- and quantity <= 99 a line total cannot exceed 9.9e13, and with subtotal
-- <= 1e15 and shipping <= 1e12 a total cannot exceed ~1.0e15, against int8's
-- 9.2e18. These are headroom, not a business ceiling - nobody decides here
-- what an order may cost. quantity <= 99 is not invented either: it is
-- cartLineInputSchema's own limit, pinned in the database the way 0003 pinned
-- payment_method and country.
--
-- WHY THE TWO ARITHMETIC CHECKS ARE REBUILT WITH ::numeric
-- PostgreSQL promises no evaluation order between CHECK constraints on a row.
-- Left in int8, `total = subtotal + shipping` and
-- `line_total = unit_price * quantity` could each raise 22003 from inside the
-- constraint before the named bound got to refuse the row - the insert still
-- fails closed, but with an arithmetic error the application cannot tell from
-- a bug. numeric is arbitrary-precision and cannot overflow, so the named
-- constraint is always what decides. Measured: without this, an insert of
-- unit_price 1e17 returned 22003; with it, 23514.
--
-- MIXED CURRENCY
-- A CHECK cannot see another table, but a composite FOREIGN KEY can.
-- order_items(order_id, currency) -> orders(id, currency) makes "every line
-- carries its order's currency" a database fact; until now it lived only in
-- src/features/orders/actions.ts. orders_id_currency_unique is redundant as a
-- uniqueness statement - id is already the primary key - and exists only
-- because a composite FK needs a unique target.
--
-- ONE HAND EDIT to the generated file: drizzle-kit emitted
-- order_items_order_currency_fk before orders_id_currency_unique, and a
-- composite FOREIGN KEY cannot be created before its unique target exists.
-- The two statements are swapped. Nothing else was changed, and the snapshot
-- is unaffected because statement order is not part of it.
--
-- PRIVILEGES ARE DELIBERATELY UNTOUCHED. 0003 revoked everything on these two
-- tables from anon and authenticated and granted service_role only; ALTER
-- COLUMN does not reset table privileges, RLS stays enabled, and
-- db/tests/rls.test.mjs re-asserts the whole matrix with this migration
-- applied. No audit trigger is added: contract D (docs/pass-2-contracts.md)
-- deliberately does not audit anonymous callers, because a row-per-request
-- write on an unauthenticated endpoint is a denial-of-service amplifier.
-- ============================================================================

ALTER TABLE "order_items" DROP CONSTRAINT "order_items_amounts_nonnegative";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_amounts_nonnegative";--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "line_total_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "subtotal_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shipping_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "total_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_id_currency_unique" UNIQUE("id","currency");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_currency_fk" FOREIGN KEY ("order_id","currency") REFERENCES "public"."orders"("id","currency") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_line_bounded" CHECK ("order_items"."unit_price_amount" <= 1000000000000 and "order_items"."quantity" <= 99);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_amounts_nonnegative" CHECK ("order_items"."unit_price_amount" >= 0 and "order_items"."line_total_amount"::numeric = "order_items"."unit_price_amount"::numeric * "order_items"."quantity"::numeric);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_bounded" CHECK ("orders"."subtotal_amount" <= 1000000000000000 and "orders"."shipping_amount" <= 1000000000000);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_nonnegative" CHECK ("orders"."subtotal_amount" >= 0 and "orders"."shipping_amount" >= 0 and "orders"."total_amount"::numeric = "orders"."subtotal_amount"::numeric + "orders"."shipping_amount"::numeric);