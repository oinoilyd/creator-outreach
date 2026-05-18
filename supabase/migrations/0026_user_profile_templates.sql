-- 0026_user_profile_templates.sql
--
-- Per-user message templates + CAN-SPAM footer opt-out.
--
-- Why: today every send pulls from a baked-in template in lib/format.ts
-- (for email) and lib/outreach.ts (for IG DM). Users have no way to
-- tailor their voice without us shipping new code. This migration adds
-- per-platform template overrides to user_profile so a Templates modal
-- in the app can let users edit and save their own.
--
-- Five platforms supported, mirroring what creator cells already render:
--   • email          — Gmail compose URL body (Path A) + Unipile send (Path B)
--   • ig_dm          — Instagram DM (copy-to-clipboard pattern)
--   • linkedin_dm    — LinkedIn message (copy-to-clipboard pattern)
--   • x_dm           — X / Twitter DM (copy-to-clipboard pattern)
--   • tiktok_dm      — TikTok DM (copy-to-clipboard pattern)
--
-- All five are nullable — NULL means "use the bundled default." That
-- way an existing user with no Templates customization keeps working,
-- and a user can blank out their override to fall back to default.
--
-- Also: include_can_spam_footer (defaults TRUE so existing behavior is
-- preserved) and footer_disabled_acknowledged_at (stamped when a user
-- explicitly turns the footer off — provides the platform-liability
-- shield by recording user acknowledgment of compliance responsibility).

ALTER TABLE public.user_profile
  -- Per-platform templates. Variables supported: {name}, {channel},
  -- {content}, {pitch}, {sender_first}, {sender_full}, {linkedin}.
  -- Substitution happens client-side at render + at send time.
  ADD COLUMN IF NOT EXISTS email_template       TEXT,
  ADD COLUMN IF NOT EXISTS ig_dm_template       TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_dm_template TEXT,
  ADD COLUMN IF NOT EXISTS x_dm_template        TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_dm_template   TEXT,

  -- CAN-SPAM footer opt-out. Defaults TRUE so every existing user
  -- keeps the compliant footer they have today. When a user flips
  -- this off in the Templates modal, they're shown a low-key
  -- acknowledgment ("You are the sender, you accept compliance
  -- responsibility for CAN-SPAM / GDPR / CASL") and the timestamp
  -- gets stamped on _acknowledged_at. That timestamp is our audit
  -- trail for platform-liability purposes.
  ADD COLUMN IF NOT EXISTS include_can_spam_footer        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS footer_disabled_acknowledged_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_profile.email_template IS
  'User-customized email body template. NULL = use bundled default in lib/templates.ts. Variables: {name} {channel} {content} {pitch} {sender_first} {sender_full} {linkedin}.';

COMMENT ON COLUMN public.user_profile.ig_dm_template IS
  'User-customized Instagram DM template. NULL = use bundled default.';

COMMENT ON COLUMN public.user_profile.linkedin_dm_template IS
  'User-customized LinkedIn DM template. NULL = use bundled default.';

COMMENT ON COLUMN public.user_profile.x_dm_template IS
  'User-customized X / Twitter DM template. NULL = use bundled default.';

COMMENT ON COLUMN public.user_profile.tiktok_dm_template IS
  'User-customized TikTok DM template. NULL = use bundled default.';

COMMENT ON COLUMN public.user_profile.include_can_spam_footer IS
  'When TRUE (default), every outreach email body gets the CAN-SPAM footer (sender name, physical address, unsubscribe link). When FALSE, footer is suppressed AND footer_disabled_acknowledged_at must be non-null (set when user clicks-through the acknowledgment).';

COMMENT ON COLUMN public.user_profile.footer_disabled_acknowledged_at IS
  'Timestamp the user explicitly acknowledged compliance responsibility when disabling the CAN-SPAM footer. NULL when footer is enabled. Used as audit trail for platform-liability shift to user.';
