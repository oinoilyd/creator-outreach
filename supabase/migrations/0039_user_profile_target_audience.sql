-- 0039_user_profile_target_audience.sql
--
-- Add target_audience to user_profile so the Profile modal can be
-- truly profile-facing — who YOU are + who you target — instead of
-- doubling as a templates editor.
--
-- Dylan 2026-06-08: Profile was creeping into template territory
-- (subject_template field lived there even though Templates had its
-- own page). Refactor moves outreach-content fields out of Profile
-- into Templates, and adds target_audience as a real profile field
-- — useful for AI fit scoring + downstream tailoring features.
--
-- Additive only — nullable TEXT. No risk to existing rows.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS target_audience TEXT;

COMMENT ON COLUMN public.user_profile.target_audience IS
  'Free-text description of who the user reaches out to (e.g. "fitness creators 100K-1M subs, mostly YouTube"). Used for AI fit scoring + UI personalization.';

NOTIFY pgrst, 'reload schema';
