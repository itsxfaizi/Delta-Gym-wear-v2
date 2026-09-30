-- Online payment through Safepay's hosted checkout, alongside cash on delivery.
--
-- A Safepay order is placed exactly like a COD order (stock reserved, status
-- pending, payment_status unpaid). It becomes payment_status = 'paid' only after
-- the server re-fetches the Safepay tracker and it has ended with the order's
-- amount; payment_reference records that tracker for reconciliation and refunds.
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction that adds it,
-- so apply this file on its own, not batched with a later migration.

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'safepay';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text;

-- One Safepay tracker settles at most one order.
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_unique
  ON orders (payment_reference)
  WHERE payment_reference IS NOT NULL;
