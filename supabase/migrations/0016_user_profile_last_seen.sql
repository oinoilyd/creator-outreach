-- 0016_user_profile_last_seen.sql
--
-- Track real user activity, not just authentication events.
--
-- auth.users.last_sign_in_at only updates when the user
-- re-authenticates (signInWithPassword / OAuth flow), NOT when
-- they actively use the app on an existing session. Sessions
-- are long-lived (default ~1 week refresh, indefinitely with
-- auto-refresh), so a user can be active daily and still have a
-- last_sign_in_at from days/weeks ago.
--
-- last_seen_at is bumped on every page load by app/page.tsx, so
-- the admin "Idle" / "Active last 7d" / "Last seen" columns
-- reflect actual activity. Falls back to auth.last_sign_in_at
-- for users who haven't loaded the app since this migration.
--
-- Indexed because the admin dashboard sorts/filters on it.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_profile.last_seen_at IS
  'Last time the user loaded the app (any page). Bumped from app/page.tsx on every mount. NULL = pre-migration / never visited since this column was added.';

CREATE INDEX IF NOT EXISTS user_profile_last_seen_idx
  ON public.user_profile (last_seen_at DESC NULLS LAST);
