-- 0053_followup_templates.sql
--
-- Follow-up email template library.
--
-- Today follow-ups have no real template: the manual "email" button on a
-- follow-up row reuses the cold-email copy, and the auto-follow-up cron
-- ships a single hardcoded one-liner (no per-stage variation, no CAN-SPAM
-- footer). This migration backs a proper library:
--
--   • user_profile.followup_config — a jsonb blob holding the whole
--     library: a list of named "sets" (each set = the four stage bodies
--     1st/2nd/3rd/final) plus which set id is the default. NULL = the
--     bundled starter set in lib/templates.ts. One column keeps the whole
--     library loading with the profile (no extra table / RLS surface).
--
--   • outreach_entries.followup_set_id — which set a given lead uses. NULL
--     = the user's default set. Stamped when the user picks a set on a
--     manual follow-up send; the auto-follow-up cron reads it too so a
--     lead's cadence copy stays consistent across manual + automatic sends.
--
-- Both are nullable and additive — existing rows keep working (they fall
-- back to the bundled default), and no RLS change is needed since both
-- columns ride the existing user_profile / outreach_entries policies.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS followup_config JSONB;

ALTER TABLE public.outreach_entries
  ADD COLUMN IF NOT EXISTS followup_set_id TEXT;

COMMENT ON COLUMN public.user_profile.followup_config IS
  'Follow-up template library: { "sets": [{ "id", "name", "stages": [4 strings] }], "defaultId": "<set id>" }. NULL = bundled starter set in lib/templates.ts. Email-only for now.';

COMMENT ON COLUMN public.outreach_entries.followup_set_id IS
  'Which followup_config set (by id) this lead''s follow-ups use. NULL = the user''s default set. Read by both the manual follow-up composer and the send-followups cron.';

NOTIFY pgrst, 'reload schema';
