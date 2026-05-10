-- 0018_outreach_entries_unipile_send.sql
--
-- Add Unipile send-tracking columns to outreach_entries.
--
-- Every time we POST a message through Unipile (initial outreach OR
-- auto-follow-up), Unipile returns:
--   • id          — Unipile's internal message id
--   • provider_id — Gmail's Message-ID header
--   • thread_id   — conversation grouping key
--
-- We store all three so:
--   1. Replies can be matched back to the right outreach entry via
--      the webhook → provider_id / thread_id lookup (Phase 3).
--   2. The conversation modal can fetch the full thread by thread_id
--      (Phase 4).
--   3. The auto-follow-up cron can decide whether to send a follow-up
--      based on whether a reply has been received (skip if any newer
--      message exists in the same thread, Phase 7).
--   4. Open-tracking events can be attributed to the right entry via
--      tracking_id (Phase 5).
--
-- Also: open_count + last_opened_at populated by the tracking webhook
-- so the UI can surface "they opened 3x but didn't reply" signals.
--
-- All columns nullable / default 0 — legacy entries (sent via the old
-- compose-URL flow) have no Unipile ids and that's fine; they keep
-- working with the SendGrid-tracking-tag path during the deprecation
-- window.

ALTER TABLE public.outreach_entries
  ADD COLUMN IF NOT EXISTS unipile_message_id   TEXT,
  ADD COLUMN IF NOT EXISTS unipile_provider_id  TEXT,
  ADD COLUMN IF NOT EXISTS unipile_thread_id    TEXT,
  ADD COLUMN IF NOT EXISTS unipile_tracking_id  TEXT,
  ADD COLUMN IF NOT EXISTS unipile_sent_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_opened_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_followup        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_followup_at TIMESTAMPTZ;

COMMENT ON COLUMN public.outreach_entries.unipile_provider_id IS
  'Gmail Message-ID header from the most recent outbound. Used by the webhook to match replies via In-Reply-To.';

COMMENT ON COLUMN public.outreach_entries.unipile_thread_id IS
  'Unipile thread id grouping every message in the conversation. Used for the conversation history modal AND the auto-followup "skip if replied" check.';

COMMENT ON COLUMN public.outreach_entries.auto_followup IS
  'When true AND followUpDate has passed AND no reply received, the cron at /api/cron/send-followups auto-fires a follow-up email. User opt-in per row.';

-- Reverse-lookup indexes for the webhook hot path.
CREATE INDEX IF NOT EXISTS outreach_entries_unipile_thread_idx
  ON public.outreach_entries (unipile_thread_id)
  WHERE unipile_thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS outreach_entries_unipile_provider_idx
  ON public.outreach_entries (unipile_provider_id)
  WHERE unipile_provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS outreach_entries_unipile_tracking_idx
  ON public.outreach_entries (unipile_tracking_id)
  WHERE unipile_tracking_id IS NOT NULL;

-- Cron query: find entries that are due for an auto-follow-up.
CREATE INDEX IF NOT EXISTS outreach_entries_auto_followup_due_idx
  ON public.outreach_entries (follow_up_date)
  WHERE auto_followup = true AND status NOT IN ('Successful','Rejected');
