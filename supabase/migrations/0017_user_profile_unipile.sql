-- 0017_user_profile_unipile.sql
--
-- Unipile integration — track which Unipile account a user has
-- connected (Gmail today, LinkedIn/WhatsApp/etc. in future phases).
--
-- Flow:
--   1. User clicks "Connect Gmail" in our app.
--   2. /api/unipile/connect mints a hosted-auth URL via Unipile's
--      POST /api/v1/hosted/accounts/link, passing `name = user.id` so
--      we can map the eventual account_id back to the right user.
--   3. User completes OAuth on Unipile's hosted page.
--   4. Unipile webhook fires CREATION_SUCCESS → /api/unipile/webhook
--      with { account_id, name (== our user.id), ... }.
--   5. Webhook updates this row: unipile_account_id, email, connected_at.
--
-- Why store these on user_profile (1:1) rather than a separate
-- connected_accounts table:
--   • Today we only support one Gmail per user — 1:1 fits.
--   • When we add LinkedIn / multi-account, we'll spin out
--     connected_accounts. For now, premature normalization.
--
-- All three columns are nullable — "not connected yet" is the default
-- state for every existing row.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS unipile_account_id    TEXT,
  ADD COLUMN IF NOT EXISTS unipile_account_email TEXT,
  ADD COLUMN IF NOT EXISTS unipile_connected_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.user_profile.unipile_account_id IS
  'Unipile account identifier for this user''s connected Gmail. NULL = not connected. Populated by /api/unipile/webhook on CREATION_SUCCESS.';

COMMENT ON COLUMN public.user_profile.unipile_account_email IS
  'Display-only — the Gmail address the user authorized. Useful for showing "Connected as: foo@gmail.com" in the UI without an extra Unipile API call.';

COMMENT ON COLUMN public.user_profile.unipile_connected_at IS
  'When the user first completed OAuth. Used for analytics + to detect stale connections.';

-- Reverse lookup: webhook receives an account_id and needs to find
-- the user row to update. Indexed for that path.
CREATE INDEX IF NOT EXISTS user_profile_unipile_account_id_idx
  ON public.user_profile (unipile_account_id)
  WHERE unipile_account_id IS NOT NULL;
