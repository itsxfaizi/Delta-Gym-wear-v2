ALTER TABLE "audit_events" ALTER COLUMN "actor_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_outcome_check" CHECK ("audit_events"."outcome" in ('success', 'denied', 'conflict'));--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_before_shape_check" CHECK ("audit_events"."before" is null or (jsonb_typeof("audit_events"."before") = 'object' and jsonb_exists("audit_events"."before", 'status') and ("audit_events"."before" - 'status'::text) = '{}'::jsonb));--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_after_shape_check" CHECK ("audit_events"."after" is null or (jsonb_typeof("audit_events"."after") = 'object' and jsonb_exists("audit_events"."after", 'status') and ("audit_events"."after" - 'status'::text) = '{}'::jsonb));--> statement-breakpoint
ALTER TABLE "media_references" ADD CONSTRAINT "media_references_status_check" CHECK ("media_references"."status" <> '' and "media_references"."status" = lower(btrim("media_references"."status")));--> statement-breakpoint
-- ============================================================================
-- Hand-written section, same arrangement as 0001: drizzle-kit generated the
-- ALTER TABLE statements above from src/server/db/schema.ts, but it cannot
-- generate policies, grants or triggers. Those objects are maintained here by
-- hand and are NOT represented in db/migrations/meta/0002_snapshot.json.
--
-- Threat model unchanged from 0001: every table in `public` is published over
-- PostgREST with the anon key, so RLS + GRANTs are the boundary. The server
-- path connects as the table OWNER and bypasses RLS; FORCE ROW LEVEL SECURITY
-- remains deliberately unset, because which role the application connects as
-- is a deployment decision and not a migration.
-- ============================================================================

-- --------------------------------------------- 1. the DELETE contradiction ---
-- 0000 gave product_revisions and audit_events an unconditional
-- BEFORE UPDATE OR DELETE ... FOR EACH ROW trigger, and gave product_revisions
-- an ON DELETE CASCADE foreign key from products. Those two facts contradict:
-- DELETE FROM products cascaded into the immutable child and raised
-- "product_revisions records are immutable" - an error naming a table the
-- caller never mentioned - for any product that had ever been edited. The
-- capability products_owner_delete advertised therefore never existed.
--
-- Resolved in favour of the approved plan rather than the policy:
-- docs/phase-3-foundation-plan.md states "hard delete is not a launch
-- operation", and docs/pass-2-contracts.md forbids inventing a deletion
-- policy. So the capability is withdrawn everywhere instead of being made to
-- work: no policy, no privilege for any role, and an explicit trigger so the
-- refusal names `products` and says why. Archiving (published -> unpublished
-- -> archived) remains the supported end-of-life path.
--
-- The ON DELETE CASCADE on the child tables is deliberately LEFT IN PLACE. It
-- is now unreachable, and it states the intent a future, approved deletion
-- migration would need: revisions and media go with the product.
DROP POLICY IF EXISTS products_owner_delete ON products;
--> statement-breakpoint
REVOKE DELETE ON products FROM authenticated;
--> statement-breakpoint
REVOKE DELETE ON products FROM service_role;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.prevent_product_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'products cannot be hard deleted; archive the product instead'
    USING ERRCODE = 'restrict_violation',
          HINT = 'hard delete is not a launch operation (docs/phase-3-foundation-plan.md)';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER products_no_hard_delete
  BEFORE DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION public.prevent_product_hard_delete();
--> statement-breakpoint

-- ------------------------------------------------ 2. TRUNCATE protection ---
-- Row-level triggers do not fire on TRUNCATE, and GRANT ALL to service_role
-- includes TRUNCATE, so the append-only guarantee on these two tables was one
-- statement away from being gone. Statement-level triggers close it; the
-- privilege is withdrawn as well so the grant and the trigger agree.
-- `TRUNCATE products CASCADE` is covered too: the cascade reaches
-- product_revisions, whose trigger aborts the whole statement.
CREATE TRIGGER product_revisions_no_truncate
  BEFORE TRUNCATE ON product_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_immutable_record_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_immutable_record_mutation();
--> statement-breakpoint
REVOKE TRUNCATE ON product_revisions, audit_events FROM service_role;
--> statement-breakpoint

-- ------------------------------------------- 3. publisher column scoping ---
-- products_editor_update admitted owner, catalog_editor AND publisher with no
-- column restriction, so a publisher could rewrite title, handle and
-- description instead of only moving status through the approved workflow.
--
-- A policy cannot restrict columns and a column-level GRANT cannot distinguish
-- tenant roles (every member connects as the same database role,
-- `authenticated`), so neither mechanism suffices alone. The policy is split so
-- the privilege matrix reads truthfully per role, and a BEFORE UPDATE trigger
-- supplies the column restriction the policy layer cannot express.
--
-- current_revision_id, version and updated_at stay writable by a publisher:
-- the status-transition mutation writes them in the same statement.
DROP POLICY IF EXISTS products_editor_update ON products;
--> statement-breakpoint
CREATE POLICY products_editor_update ON products
  FOR UPDATE TO authenticated
  USING (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor'))
  WITH CHECK (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor'));
--> statement-breakpoint
CREATE POLICY products_publisher_status_update ON products
  FOR UPDATE TO authenticated
  USING (public.current_tenant_role(tenant_id) = 'publisher')
  WITH CHECK (public.current_tenant_role(tenant_id) = 'publisher');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_publisher_column_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.current_tenant_role(OLD.tenant_id) = 'publisher' AND (
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR
    NEW.handle IS DISTINCT FROM OLD.handle OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'publisher may only change a product status'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER products_publisher_column_scope
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_publisher_column_scope();
