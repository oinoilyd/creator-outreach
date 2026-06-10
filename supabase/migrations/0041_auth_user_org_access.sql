-- 0041_auth_user_org_access.sql
--
-- CRITICAL team-access fix (2026-06-10 enterprise investigation).
--
-- The paywall middleware (lib/supabase/middleware.ts) only checked the
-- caller's INDIVIDUAL user_profile.subscription_status. But a team
-- plan's subscription lives on the ORGANIZATIONS row — the team
-- webhook writes subscription_status to organizations, never to any
-- user_profile. So every team member (and the owner) had a null
-- individual status, wasn't on the bypass list, and got redirected to
-- /pricing — unable to enter the app at all. The team feature was
-- non-functional in production, and the /admin sandbox "never worked"
-- for the same reason (all 5 fixtures bounced to /pricing on login).
--
-- This SECURITY DEFINER helper returns the current user's effective
-- ORG subscription status + unlimited_exports flag, bypassing RLS to
-- avoid the recursion the org policies are structured to dodge. The
-- middleware calls it on the slow path (only when the individual
-- subscription check fails) and grants access if the user's org has a
-- live subscription.
--
-- Returns NULL/empty when the user belongs to no org (individual user)
-- — those correctly fall through to the existing paywall.
--
-- Additive only — one function. No table/column/data changes.

CREATE OR REPLACE FUNCTION public.auth_user_org_access()
RETURNS TABLE(subscription_status TEXT, unlimited_exports BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.subscription_status, o.unlimited_exports
  FROM public.organization_members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_org_access() TO authenticated;

COMMENT ON FUNCTION public.auth_user_org_access() IS
  'Returns the current auth user''s ORG subscription_status + unlimited_exports (or empty if individual). SECURITY DEFINER bypasses RLS to avoid org-policy recursion. Used by the paywall middleware so team members inherit their org''s subscription.';

NOTIFY pgrst, 'reload schema';
