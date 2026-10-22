-- Keep the RLS membership helper outside the exposed public API schema. The
-- existing policies depend on the function OID and continue to resolve it
-- after the schema move.
CREATE SCHEMA IF NOT EXISTS delta_private;
REVOKE ALL ON SCHEMA delta_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA delta_private TO authenticated;

-- CREATE OR REPLACE preserves the function identity used by existing policies;
-- it also allows a fresh test database to run this migration before policies.
CREATE OR REPLACE FUNCTION public.is_active_tenant_member(target_tenant uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = target_tenant
      AND m.auth_user_id = auth.uid()
      AND m.status = 'active'
  );
$$;

ALTER FUNCTION public.is_active_tenant_member(uuid) SET SCHEMA delta_private;
ALTER FUNCTION delta_private.is_active_tenant_member(uuid) SET search_path = '';
REVOKE ALL ON FUNCTION delta_private.is_active_tenant_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delta_private.is_active_tenant_member(uuid) TO authenticated;

-- These trigger functions use no unqualified table or function names.
ALTER FUNCTION public.prevent_immutable_record_mutation() SET search_path = '';
ALTER FUNCTION public.enforce_product_status_transition() SET search_path = '';
ALTER FUNCTION public.enforce_order_status_transition() SET search_path = '';
