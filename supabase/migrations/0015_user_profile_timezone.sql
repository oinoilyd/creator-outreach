-- 0015_user_profile_timezone.sql
--
-- Store the user's IANA timezone (e.g. "America/Chicago",
-- "Europe/London") so the admin dashboard can render every
-- timestamp in the operator's local time and so the in-app
-- follow-up reminders can be scheduled correctly even when the
-- server is on UTC.
--
-- Auto-populated on every sign-in by app/page.tsx — reads
-- Intl.DateTimeFormat().resolvedOptions().timeZone and writes it
-- to this column if it differs from the stored value. NULL means
-- the user hasn't signed in since this column was added; the UI
-- falls back to UTC labeling for those rows.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS timezone TEXT;

COMMENT ON COLUMN public.user_profile.timezone IS
  'IANA timezone name (e.g. America/Chicago). Auto-detected on app load via Intl.DateTimeFormat. NULL = unknown / pre-migration user.';
