-- 0037_client_error_log.sql
--
-- Centralized error inbox for silent client-side failures.
--
-- Background (Dylan 2026-06-08, post-data-loss incident):
-- Migration 0033 added new columns but wasn't applied to prod for 16
-- days. Every save during that window failed with PGRST204 (schema
-- cache miss) and was logged ONLY to the browser console — invisible
-- to the user, invisible to admin. Users lost data without knowing.
--
-- This table is the central error log. Any save function that fails
-- with a schema-cache error (or any other unexpected error) writes a
-- row here. Admin (dmeehanj@gmail.com) sees the count + details on
-- the /admin tab via the ErrorInbox component. Regular users see
-- nothing scary — but admin gets notified within seconds.
--
-- All columns are nullable except occurred_at / function_name /
-- error_message — those are required for the inbox to be useful.

CREATE TABLE IF NOT EXISTS public.client_error_log (
  id              BIGSERIAL PRIMARY KEY,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The user_id this error happened for. Filled when auth.uid() is
  -- available. NULL when the error occurred before auth resolved.
  user_id         UUID,
  user_email      TEXT,
  -- Which save function failed — e.g. 'saveOutreach', 'saveDismissed'.
  function_name   TEXT NOT NULL,
  -- PostgREST / Postgres error code (e.g. 'PGRST204', '42703'). NULL
  -- if the error didn't have one.
  error_code      TEXT,
  error_message   TEXT NOT NULL,
  error_details   TEXT,
  error_hint      TEXT,
  -- Keys of the payload that was being saved. Useful for spotting
  -- "schema cache says column X missing" → check if X was in the
  -- payload.
  payload_keys    TEXT[],
  -- Admin marks resolved after fixing root cause. Resolved errors
  -- stay in the log for history but don't appear in the active inbox.
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID
);

CREATE INDEX IF NOT EXISTS client_error_log_occurred_idx
  ON public.client_error_log(occurred_at DESC);

CREATE INDEX IF NOT EXISTS client_error_log_unresolved_idx
  ON public.client_error_log(resolved, occurred_at DESC)
  WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS client_error_log_user_idx
  ON public.client_error_log(user_id, occurred_at DESC)
  WHERE user_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.client_error_log ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can INSERT — they need to log their own
-- errors. We do NOT trust the user_id field to match auth.uid()
-- because we want to capture pre-auth errors too (where auth.uid()
-- is null but we want to log anyway).
DROP POLICY IF EXISTS "client_error_log_insert_any_auth" ON public.client_error_log;
CREATE POLICY "client_error_log_insert_any_auth"
  ON public.client_error_log
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only admin can read the log.
DROP POLICY IF EXISTS "client_error_log_admin_select" ON public.client_error_log;
CREATE POLICY "client_error_log_admin_select"
  ON public.client_error_log
  FOR SELECT
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'dmeehanj@gmail.com'
  );

-- Only admin can mark errors resolved.
DROP POLICY IF EXISTS "client_error_log_admin_update" ON public.client_error_log;
CREATE POLICY "client_error_log_admin_update"
  ON public.client_error_log
  FOR UPDATE
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'dmeehanj@gmail.com'
  );

GRANT INSERT ON public.client_error_log TO authenticated;
GRANT SELECT, UPDATE ON public.client_error_log TO authenticated;
GRANT USAGE ON SEQUENCE public.client_error_log_id_seq TO authenticated;

-- Refresh PostgREST cache.
NOTIFY pgrst, 'reload schema';
