-- 0048_email_opt_in.sql
--
-- Per-account "also email me" preference for inbox notifications.
-- Default TRUE (opt-out model) — existing behaviour is preserved.
--
--   • The USER can toggle their own (subtle switch in their inbox).
--   • The ADMIN can toggle any account (switch in the /admin user table).
--   • Email sends — direct messages AND broadcast bulk emails — skip
--     anyone whose email_opt_in is false. In-app delivery is unaffected.
--
-- Additive. No data change (every existing row defaults to true =
-- emails on, same as today).

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN NOT NULL DEFAULT true;

-- Extend the admin extras RPC so the admin user table can render the
-- per-account toggle's current state alongside unlimited_exports.
-- Return-type change → must drop + recreate (CREATE OR REPLACE can't
-- alter the signature).
DROP FUNCTION IF EXISTS public.admin_user_profile_extras();
CREATE FUNCTION public.admin_user_profile_extras()
RETURNS TABLE(
  user_id uuid,
  timezone text,
  last_seen_at timestamptz,
  terms_privacy_agreed_at timestamptz,
  terms_privacy_version text,
  unlimited_exports boolean,
  email_opt_in boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()) IS DISTINCT FROM 'dmeehanj@gmail.com' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.timezone,
    p.last_seen_at,
    p.terms_privacy_agreed_at,
    p.terms_privacy_version,
    COALESCE(p.unlimited_exports, false) AS unlimited_exports,
    COALESCE(p.email_opt_in, true) AS email_opt_in
  FROM public.user_profile p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_profile_extras() TO authenticated;

NOTIFY pgrst, 'reload schema';
