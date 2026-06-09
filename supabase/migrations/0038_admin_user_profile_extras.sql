-- 0038_admin_user_profile_extras.sql
--
-- Admin-only RPC returning per-user profile extras (timezone,
-- last_seen_at, consent, unlimited_exports) that the admin dashboard
-- needs to render the user table.
--
-- Why (Dylan 2026-06-08): the admin page was doing a direct SELECT
-- on user_profile, but the user_profile RLS policy is
-- `auth.uid() = user_id` — meaning admin only sees their OWN row.
-- That's correct for end users but wrong for /admin, where we need
-- to see every user's profile data. As a result Ryan's timezone +
-- last_seen_at were invisible to the admin table, so his "last
-- active" displayed `last_sign_in_at` (which only moves on
-- re-authentication, hence a 19-day stale reading when he was
-- actually active that day).
--
-- This function is SECURITY DEFINER + admin-email-gated, so it
-- bypasses user_profile RLS but only when called by Dylan.
-- Returns all the fields the admin page used to fetch directly.

create or replace function public.admin_user_profile_extras()
returns table(
  user_id uuid,
  timezone text,
  last_seen_at timestamptz,
  terms_privacy_agreed_at timestamptz,
  terms_privacy_version text,
  unlimited_exports boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Admin gate: only Dylan may call. Same pattern as admin_user_summary.
  if (select u.email from auth.users u where u.id = auth.uid()) is distinct from 'dmeehanj@gmail.com' then
    raise exception 'forbidden';
  end if;

  return query
  select
    p.user_id,
    p.timezone,
    p.last_seen_at,
    p.terms_privacy_agreed_at,
    p.terms_privacy_version,
    coalesce(p.unlimited_exports, false) as unlimited_exports
  from public.user_profile p;
end;
$$;

grant execute on function public.admin_user_profile_extras() to authenticated;

comment on function public.admin_user_profile_extras() is
  'Returns timezone + last_seen_at + consent + unlimited_exports for every user. Admin-only (dmeehanj@gmail.com). SECURITY DEFINER bypasses user_profile RLS for the cross-user read.';

NOTIFY pgrst, 'reload schema';
