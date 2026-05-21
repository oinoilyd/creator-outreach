-- 0031_outreach_deletion_log.sql
--
-- Audit trail for outreach_entries deletions — final backstop against
-- the data-loss bug that wiped Ryan's outreach (2026-05-21).
--
-- The client-side saveOutreach() safeguard in lib/storage.ts blocks
-- the most common pathway. This trigger is the last line of defense:
-- ANY deletion from outreach_entries (via the app, via direct SQL,
-- via service_role webhooks — anything) gets copied to this log
-- table with the full row JSON. If a future bug, manual mistake, or
-- migration accident wipes data, we can restore from this log
-- without needing Supabase backups.
--
-- The log table is access-controlled so only admin can read it. It
-- has no RLS for INSERT (the trigger writes it on behalf of
-- whoever did the delete) and a SELECT policy that's admin-only.

CREATE TABLE IF NOT EXISTS public.outreach_entries_deletion_log (
  log_id         BIGSERIAL PRIMARY KEY,
  deleted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The user_id whose row was deleted. Stored separately from
  -- row_data so we can index on it for "give me everything Ryan
  -- has ever lost" queries.
  user_id        UUID NOT NULL,
  -- Original outreach_entries.id — useful for cross-referencing
  -- against any backup snapshots.
  entry_id       TEXT NOT NULL,
  channel_id     TEXT,
  channel_name   TEXT,
  -- Full row as JSONB — captures every column at the moment of
  -- deletion, so we can recreate it via INSERT ... SELECT later.
  row_data       JSONB NOT NULL,
  -- auth.uid() at time of delete, when available. NULL when the
  -- delete came from service_role / a server-side cron without
  -- an authenticated user session.
  deleted_by     UUID,
  -- Optional context from the application — useful for debugging
  -- which code path triggered the delete.
  reason         TEXT
);

CREATE INDEX IF NOT EXISTS outreach_deletion_log_user_idx
  ON public.outreach_entries_deletion_log(user_id, deleted_at DESC);

CREATE INDEX IF NOT EXISTS outreach_deletion_log_entry_idx
  ON public.outreach_entries_deletion_log(entry_id);

-- BEFORE DELETE trigger function — runs for every row being deleted.
-- Stores a snapshot to the log table.
CREATE OR REPLACE FUNCTION public.log_outreach_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.outreach_entries_deletion_log
    (user_id, entry_id, channel_id, channel_name, row_data, deleted_by)
  VALUES (
    OLD.user_id,
    OLD.id,
    OLD.channel_id,
    OLD.channel_name,
    to_jsonb(OLD),
    auth.uid()
  );
  RETURN OLD;
END;
$$;

-- Drop and recreate the trigger so this migration is idempotent.
DROP TRIGGER IF EXISTS outreach_deletion_audit ON public.outreach_entries;
CREATE TRIGGER outreach_deletion_audit
  BEFORE DELETE ON public.outreach_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.log_outreach_deletion();

-- ── Access control ─────────────────────────────────────────────────
-- The log table needs RLS to prevent users from reading other users'
-- deletion history (PII would leak otherwise). Only the admin email
-- can SELECT.

ALTER TABLE public.outreach_entries_deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outreach_deletion_log_admin_select" ON public.outreach_entries_deletion_log;
CREATE POLICY "outreach_deletion_log_admin_select"
  ON public.outreach_entries_deletion_log
  FOR SELECT
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'dmeehanj@gmail.com'
  );

-- The trigger writes to the log via SECURITY DEFINER so it bypasses
-- RLS for INSERT. No INSERT policy needed for end-users (they
-- shouldn't write directly).

-- Grant for the trigger function execution.
GRANT EXECUTE ON FUNCTION public.log_outreach_deletion() TO authenticated;

-- Refresh PostgREST cache so the new table is visible to the API
-- (in case admin tools want to read it later).
NOTIFY pgrst, 'reload schema';
