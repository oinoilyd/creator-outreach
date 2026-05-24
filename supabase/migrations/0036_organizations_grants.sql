-- 0036_organizations_grants.sql
--
-- Explicit GRANTs for the team tables added in 0035.
--
-- Why this needs its own migration:
--   Same gotcha as 0012 (creator_enrichment grants). Supabase's
--   auto-grant of CRUD permissions to authenticated + service_role
--   doesn't apply to tables created via custom migrations — only
--   to tables created via the Supabase UI. The 0035 migration
--   created the team tables via raw SQL, so service_role couldn't
--   even SELECT from them ("permission denied for table organizations").
--
-- Without these grants:
--   • Service role API routes return 403 on every team query.
--   • Authenticated client gets the same error before RLS even runs.
--   • /admin/sandbox seed endpoint fails at the very first cleanup
--     step with "cannot read organizations table".

-- service_role: full access (it bypasses RLS, so this is the only gate).
GRANT ALL ON public.organizations           TO service_role;
GRANT ALL ON public.organization_members    TO service_role;
GRANT ALL ON public.organization_invitations TO service_role;

-- authenticated: same CRUD verbs, but RLS policies from 0035 still
-- enforce per-row visibility. This grant just gets us past the
-- table-level permission check.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invitations TO authenticated;

-- paid_exports (from 0034) also needs the service_role grant — it's
-- the same gap. Defensive even if export paywall is already working
-- (the existing INSERT path may have been using a different code path).
GRANT ALL ON public.paid_exports TO service_role;
GRANT SELECT ON public.paid_exports TO authenticated;

-- Make sure the helper functions added in 0035 can be called by
-- authenticated. We already GRANTed EXECUTE in 0035 but re-running
-- is harmless (idempotent at the catalog level).
GRANT EXECUTE ON FUNCTION public.auth_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_org_role()        TO authenticated;

-- Force PostgREST to re-read the schema cache so the API picks up
-- the new grants without waiting for the auto-refresh window. Safe
-- to run multiple times.
NOTIFY pgrst, 'reload schema';
