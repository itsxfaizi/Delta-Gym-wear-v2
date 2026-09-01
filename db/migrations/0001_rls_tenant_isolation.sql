ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_references" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "media_references_tenant_product_status_idx" ON "media_references" USING btree ("tenant_id","product_id","status");--> statement-breakpoint
CREATE INDEX "product_variants_tenant_product_idx" ON "product_variants" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE INDEX "products_current_revision_idx" ON "products" USING btree ("tenant_id","current_revision_id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_status_check" CHECK ("memberships"."status" <> '' and "memberships"."status" = lower(btrim("memberships"."status")));--> statement-breakpoint
-- ============================================================================
-- Hand-written section. drizzle-kit generates the ENABLE ROW LEVEL SECURITY,
-- index and CHECK statements above from src/server/db/schema.ts, but it cannot
-- generate SECURITY DEFINER functions, policies or privilege grants, exactly as
-- it cannot generate the append-only / status-transition triggers in 0000.
-- Those objects are maintained here by hand and are NOT represented in
-- db/migrations/meta/0001_snapshot.json.
--
-- Threat model: Supabase publishes every table in `public` over PostgREST using
-- the anon key. RLS + GRANTs are the only thing standing between that key and
-- these tables. The server-side Drizzle/postgres-js path connects as the table
-- OWNER, which bypasses RLS, so the storefront read path is unaffected. FORCE
-- ROW LEVEL SECURITY is deliberately NOT set for that reason.
--
-- Role capabilities below are read off the membership_role enum defined in
-- 0000 (owner / catalog_editor / publisher / auditor). No new role, status or
-- lifecycle vocabulary is introduced here.
-- ============================================================================

-- Resolves the calling JWT's ACTIVE role in one tenant, or NULL when the caller
-- is not an active member. SECURITY DEFINER so that policies on other tables can
-- read memberships without recursing into the memberships policies.
CREATE OR REPLACE FUNCTION public.current_tenant_role(p_tenant_id uuid)
RETURNS membership_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.role
  FROM public.memberships m
  WHERE m.tenant_id = p_tenant_id
    AND m.auth_user_id = auth.uid()
    AND m.status = 'active'
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.current_tenant_role(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_tenant_role(uuid) TO authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------- tenants ---
CREATE POLICY tenants_member_select ON tenants
  FOR SELECT TO authenticated
  USING (public.current_tenant_role(id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY tenants_owner_update ON tenants
  FOR UPDATE TO authenticated
  USING (public.current_tenant_role(id) = 'owner')
  WITH CHECK (public.current_tenant_role(id) = 'owner');
--> statement-breakpoint

-- ------------------------------------------------------------ memberships ---
-- No anon policy exists on this table by design. Creating the FIRST owner of a
-- tenant is therefore only possible through the service role; every policy here
-- requires the caller to ALREADY be an active owner of the same tenant, which is
-- what blocks a self-granting INSERT.
CREATE POLICY memberships_self_or_owner_select ON memberships
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.current_tenant_role(tenant_id) = 'owner');
--> statement-breakpoint
CREATE POLICY memberships_owner_insert ON memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.current_tenant_role(tenant_id) = 'owner');
--> statement-breakpoint
CREATE POLICY memberships_owner_update ON memberships
  FOR UPDATE TO authenticated
  USING (public.current_tenant_role(tenant_id) = 'owner')
  WITH CHECK (public.current_tenant_role(tenant_id) = 'owner');
--> statement-breakpoint
CREATE POLICY memberships_owner_delete ON memberships
  FOR DELETE TO authenticated
  USING (public.current_tenant_role(tenant_id) = 'owner');
--> statement-breakpoint

-- --------------------------------------------------------------- products ---
CREATE POLICY products_public_select ON products
  FOR SELECT TO anon, authenticated
  USING (status = 'published');
--> statement-breakpoint
CREATE POLICY products_member_select ON products
  FOR SELECT TO authenticated
  USING (public.current_tenant_role(tenant_id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY products_editor_insert ON products
  FOR INSERT TO authenticated
  WITH CHECK (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor'));
--> statement-breakpoint
CREATE POLICY products_editor_update ON products
  FOR UPDATE TO authenticated
  USING (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor', 'publisher'))
  WITH CHECK (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor', 'publisher'));
--> statement-breakpoint
CREATE POLICY products_owner_delete ON products
  FOR DELETE TO authenticated
  USING (public.current_tenant_role(tenant_id) = 'owner');
--> statement-breakpoint

-- ------------------------------------------------------- product_variants ---
CREATE POLICY product_variants_public_select ON product_variants
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.tenant_id = product_variants.tenant_id
      AND p.id = product_variants.product_id
      AND p.status = 'published'
  ));
--> statement-breakpoint
CREATE POLICY product_variants_member_select ON product_variants
  FOR SELECT TO authenticated
  USING (public.current_tenant_role(tenant_id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY product_variants_editor_insert ON product_variants
  FOR INSERT TO authenticated
  WITH CHECK (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor'));
--> statement-breakpoint
CREATE POLICY product_variants_editor_update ON product_variants
  FOR UPDATE TO authenticated
  USING (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor'))
  WITH CHECK (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor'));
--> statement-breakpoint
CREATE POLICY product_variants_editor_delete ON product_variants
  FOR DELETE TO authenticated
  USING (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor'));
--> statement-breakpoint

-- ------------------------------------------------------- media_references ---
CREATE POLICY media_references_public_select ON media_references
  FOR SELECT TO anon, authenticated
  USING (status = 'active' AND EXISTS (
    SELECT 1 FROM products p
    WHERE p.tenant_id = media_references.tenant_id
      AND p.id = media_references.product_id
      AND p.status = 'published'
  ));
--> statement-breakpoint
CREATE POLICY media_references_member_select ON media_references
  FOR SELECT TO authenticated
  USING (public.current_tenant_role(tenant_id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY media_references_editor_insert ON media_references
  FOR INSERT TO authenticated
  WITH CHECK (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor'));
--> statement-breakpoint
CREATE POLICY media_references_editor_update ON media_references
  FOR UPDATE TO authenticated
  USING (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor'))
  WITH CHECK (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor'));
--> statement-breakpoint
CREATE POLICY media_references_editor_delete ON media_references
  FOR DELETE TO authenticated
  USING (public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor'));
--> statement-breakpoint

-- ------------------------------------------------------ product_revisions ---
-- Append-only: no UPDATE or DELETE policy exists, matching the
-- product_revisions_immutable trigger created in 0000.
CREATE POLICY product_revisions_member_select ON product_revisions
  FOR SELECT TO authenticated
  USING (public.current_tenant_role(tenant_id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY product_revisions_editor_insert ON product_revisions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_tenant_role(tenant_id) IN ('owner', 'catalog_editor', 'publisher')
    AND author_user_id = auth.uid()
  );
--> statement-breakpoint

-- ----------------------------------------------------------- audit_events ---
-- Readable by the roles whose job is oversight; writes are service-role only, so
-- no INSERT policy exists for anon or authenticated.
CREATE POLICY audit_events_oversight_select ON audit_events
  FOR SELECT TO authenticated
  USING (public.current_tenant_role(tenant_id) IN ('owner', 'auditor'));
--> statement-breakpoint

-- ------------------------------------------------------------- privileges ---
-- RLS only filters rows the role is already allowed to touch, so the table
-- privileges are narrowed to match the policies above.
REVOKE ALL ON tenants, memberships, products, product_variants, media_references, product_revisions, audit_events FROM anon;
--> statement-breakpoint
REVOKE ALL ON tenants, memberships, products, product_variants, media_references, product_revisions, audit_events FROM authenticated;
--> statement-breakpoint
GRANT SELECT ON products, product_variants, media_references TO anon;
--> statement-breakpoint
GRANT SELECT ON tenants, memberships, products, product_variants, media_references, product_revisions, audit_events TO authenticated;
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON products, product_variants, media_references TO authenticated;
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON memberships TO authenticated;
--> statement-breakpoint
GRANT UPDATE ON tenants TO authenticated;
--> statement-breakpoint
GRANT INSERT ON product_revisions TO authenticated;
--> statement-breakpoint
GRANT ALL ON tenants, memberships, products, product_variants, media_references, product_revisions, audit_events TO service_role;
