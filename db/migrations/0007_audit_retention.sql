-- Keep audit events append-only for routine callers. The only deletion path is
-- a bounded, service-role-only RPC that removes rows strictly older than one
-- calendar year. Product revisions retain their original immutable trigger.

CREATE OR REPLACE FUNCTION public.guard_audit_event_retention_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  purge_owner name;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(p.proowner)
    INTO purge_owner
    FROM pg_catalog.pg_proc p
   WHERE p.oid = 'public.purge_expired_audit_events(boolean)'::pg_catalog.regprocedure;

  IF current_user = purge_owner
     AND pg_catalog.current_setting('delta.audit_retention_purge', true) = 'authorized'
     AND OLD.created_at < pg_catalog.transaction_timestamp() - interval '1 year' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'audit_events records are immutable outside the approved retention procedure'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_audit_events(p_dry_run boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_dry_run THEN
    SELECT count(*)::integer
      INTO affected
      FROM (
        SELECT id
          FROM public.audit_events
         WHERE created_at < pg_catalog.transaction_timestamp() - interval '1 year'
         ORDER BY created_at, id
         LIMIT 5000
      ) eligible;
    RETURN affected;
  END IF;

  PERFORM pg_catalog.set_config('delta.audit_retention_purge', 'authorized', true);

  WITH eligible AS (
    SELECT id
      FROM public.audit_events
     WHERE created_at < pg_catalog.transaction_timestamp() - interval '1 year'
     ORDER BY created_at, id
     LIMIT 5000
     FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.audit_events event
   USING eligible
   WHERE event.id = eligible.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_audit_event_retention_delete() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.purge_expired_audit_events(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_audit_events(boolean) TO service_role;

DROP TRIGGER IF EXISTS audit_events_immutable ON public.audit_events;
CREATE TRIGGER audit_events_immutable
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_audit_event_retention_delete();

-- Reassert that revisions never received the audit-specific retention path.
DROP TRIGGER IF EXISTS product_revisions_immutable ON public.product_revisions;
CREATE TRIGGER product_revisions_immutable
  BEFORE UPDATE OR DELETE ON public.product_revisions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_record_mutation();

ALTER FUNCTION public.guard_audit_event_retention_delete() SET search_path = '';
ALTER FUNCTION public.purge_expired_audit_events(boolean) SET search_path = '';
