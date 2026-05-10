-- 0019_user_profile_linkedin.sql
--
-- Phase 6 — store a SECOND Unipile account per user, this one for
-- LinkedIn. Keeps the Gmail columns from migration 0017 untouched
-- so an existing Gmail-only user upgrades cleanly.
--
-- A future migration will normalize this into a connected_accounts
-- join table once we have more than 2-3 providers (WhatsApp, IG, etc.
-- — they'd each want their own pair of columns otherwise). For now,
-- two providers fits 2 column pairs cleanly without overengineering.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS unipile_linkedin_account_id   TEXT,
  ADD COLUMN IF NOT EXISTS unipile_linkedin_username     TEXT,
  ADD COLUMN IF NOT EXISTS unipile_linkedin_connected_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_profile.unipile_linkedin_account_id IS
  'Unipile account id for the user''s connected LinkedIn. NULL = not connected. Set by /api/unipile/webhook on CREATION_SUCCESS when account_type=LINKEDIN.';

CREATE INDEX IF NOT EXISTS user_profile_unipile_linkedin_idx
  ON public.user_profile (unipile_linkedin_account_id)
  WHERE unipile_linkedin_account_id IS NOT NULL;
