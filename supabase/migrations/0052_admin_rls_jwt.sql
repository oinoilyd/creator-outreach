-- 0052_admin_rls_jwt.sql
--
-- Security audit 2026-07-07. Three admin RLS policies read auth.users
-- inside the policy body:
--     (SELECT email FROM auth.users WHERE id = auth.uid()) = 'dmeehanj@gmail.com'
-- The `authenticated` role cannot SELECT auth.users, so these policies can
-- silently fail with "permission denied", blocking the admin from reading
-- the client error log + the outreach deletion audit trail, and from
-- marking errors resolved.
--
-- Fix: switch to the JWT-claim check `(auth.jwt() ->> 'email')`, which needs
-- no table access — the exact pattern already proven in 0042_inbox.sql and
-- 0046_inbox_saved_replies.sql. Additive: DROP + reCREATE the three policies.
-- Safe to re-run.

-- ── client_error_log (originally 0037) ──────────────────────────────────────
DROP POLICY IF EXISTS "client_error_log_admin_select" ON public.client_error_log;
CREATE POLICY "client_error_log_admin_select"
  ON public.client_error_log
  FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'dmeehanj@gmail.com');

DROP POLICY IF EXISTS "client_error_log_admin_update" ON public.client_error_log;
CREATE POLICY "client_error_log_admin_update"
  ON public.client_error_log
  FOR UPDATE
  USING ((auth.jwt() ->> 'email') = 'dmeehanj@gmail.com');

-- ── outreach_entries_deletion_log (originally 0031) ─────────────────────────
DROP POLICY IF EXISTS "outreach_deletion_log_admin_select" ON public.outreach_entries_deletion_log;
CREATE POLICY "outreach_deletion_log_admin_select"
  ON public.outreach_entries_deletion_log
  FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'dmeehanj@gmail.com');

NOTIFY pgrst, 'reload schema';
