-- Outreach entries: persist the rest of the socials so they can be
-- edited from the LeadDetailModal alongside email + LinkedIn. Existing
-- rows get '' defaults so nothing breaks.

ALTER TABLE public.outreach_entries
  ADD COLUMN IF NOT EXISTS instagram TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS twitter   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tiktok    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS website   TEXT NOT NULL DEFAULT '';
