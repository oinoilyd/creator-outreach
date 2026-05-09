-- 0013_user_profile_subject_template.sql
--
-- Add a per-user subject-line template to user_profile so users can
-- type their own subject line once and have it auto-fill on every
-- outreach email.
--
-- Supports placeholders inside the template (substituted at compose
-- time by lib/format.ts):
--   {name}    → recipient first name (parsed from channel name)
--   {channel} → full channel name
--   {content} → top video title or "your content"
--
-- Empty/null falls back to the original hardcoded subject so existing
-- users see no change until they set a template.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS subject_template TEXT;

COMMENT ON COLUMN public.user_profile.subject_template IS
  'Custom subject line for outreach emails. Supports {name}, {channel}, {content} placeholders. NULL or empty = use the default.';
