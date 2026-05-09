-- 0014_outreach_entries_tracking_id.sql
--
-- Adds a per-entry tracking ID used by the inbound-reply detection
-- system. Outbound emails get a hidden subject-line tag of the form
--   [CO-#{tracking_id}]
-- which a Gmail filter forwards to our SendGrid Inbound Parse webhook
-- when the creator replies. We extract the tracking_id from the
-- forwarded subject and update the matching entry's status.
--
-- We don't backfill existing rows. Rows without a tracking_id keep
-- working in the old "no auto-reply detection" mode. New entries
-- (added after this migration deploys) get a tracking_id at creation
-- time via app/page.tsx's addToOutreach.

ALTER TABLE public.outreach_entries
  ADD COLUMN IF NOT EXISTS tracking_id TEXT;

-- Lookup index for the inbound webhook's "find entry by tracking_id"
-- query. Partial index (only non-null) keeps it small.
CREATE INDEX IF NOT EXISTS idx_outreach_entries_tracking_id
  ON public.outreach_entries(tracking_id)
  WHERE tracking_id IS NOT NULL;
