-- 0034_export_paywall.sql
--
-- Export paywall + comp-account infrastructure (Dylan 2026-05-24).
--
-- Three knobs added to user_profile:
--   • unlimited_exports         — admin-controlled bypass. When true, the
--                                 export endpoint never charges and never
--                                 counts against the monthly free quota.
--                                 Use for VIPs / partners / our own accounts.
--   • monthly_export_count      — # of exports consumed this month against
--                                 the "1 free if under 10 outreach rows"
--                                 quota. Resets lazily on read once we cross
--                                 export_count_resets_at.
--   • export_count_resets_at    — when monthly_export_count next rolls over
--                                 to 0. Set to the start of next month on
--                                 every reset; lazy reset on read keeps us
--                                 cron-free.
--   • paid_export_credits       — # of $25 one-off exports the user has
--                                 paid for but not yet used. Webhook
--                                 increments, export endpoint decrements.
--                                 Decoupling credits from the actual export
--                                 means a user who pays $25, then closes
--                                 the tab before download, still has their
--                                 credit on next visit.
--
-- Separate paid_exports table records each Stripe session that granted a
-- credit. PRIMARY KEY on stripe_session_id makes the webhook + redirect
-- fulfillment idempotent — same session can't grant two credits even if
-- both code paths fire (Stripe webhook + success-redirect fulfill).
--
-- DATA SAFETY: All ADD COLUMNs are additive with NOT NULL DEFAULT, so
-- existing rows pick up the default and no SELECT/UPDATE in application
-- code breaks. No data is destroyed, no constraints are dropped.

-- Columns on user_profile.
ALTER TABLE user_profile
  ADD COLUMN IF NOT EXISTS unlimited_exports BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE user_profile
  ADD COLUMN IF NOT EXISTS monthly_export_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE user_profile
  ADD COLUMN IF NOT EXISTS export_count_resets_at TIMESTAMPTZ NOT NULL
    DEFAULT (date_trunc('month', now()) + interval '1 month');

ALTER TABLE user_profile
  ADD COLUMN IF NOT EXISTS paid_export_credits INTEGER NOT NULL DEFAULT 0;

-- Per-session ledger of paid exports — both the redirect-success fulfill
-- path and the Stripe webhook check this table before granting a credit,
-- so duplicate delivery never double-grants.
CREATE TABLE IF NOT EXISTS paid_exports (
  stripe_session_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  fulfilled_via TEXT NOT NULL CHECK (fulfilled_via IN ('redirect', 'webhook')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paid_exports_user_id_idx
  ON paid_exports(user_id);

-- RLS — only the row's owner (or service role) can read. Inserts only
-- happen via service role from the webhook + fulfill endpoints, never
-- from the client.
ALTER TABLE paid_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paid_exports_select_own" ON paid_exports;
CREATE POLICY "paid_exports_select_own" ON paid_exports
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy → only service role can write.

-- Trial length migration: cap any active 14-day trial at now()+7d.
-- LEAST() means we never EXTEND someone's trial — only shorten if they
-- have more than 7 days remaining. Anyone already past day 7 of their
-- 14-day trial keeps their original end date.
--
-- NOTE: this only updates the LOCAL mirror in user_profile. The real
-- Stripe Subscription object still has trial_end at +14 days, and the
-- next subscription.updated webhook will overwrite our mirror back to
-- 14 days. To truly force-shorten in Stripe, run the admin endpoint
-- /api/admin/migrate-trial-lengths AFTER deploy — that one calls
-- stripe.subscriptions.update for each trialing customer.
--
-- Why also touch the mirror here? Two reasons:
--   1. Belt-and-suspenders: if the admin endpoint isn't run, the local
--      UI still reflects the new policy until the next Stripe webhook.
--   2. The webhook drift window is brief (next status change) — by then
--      the admin endpoint has hopefully been run.
UPDATE user_profile
SET subscription_current_period_end = LEAST(
  subscription_current_period_end,
  now() + interval '7 days'
)
WHERE subscription_status = 'trialing'
  AND subscription_current_period_end IS NOT NULL
  AND subscription_current_period_end > now() + interval '7 days';

-- Helpful column comments — show up in Supabase Studio + psql \d+.
COMMENT ON COLUMN user_profile.unlimited_exports IS
  'When true, user bypasses the $25 export paywall and monthly free quota. Admin-toggled.';
COMMENT ON COLUMN user_profile.monthly_export_count IS
  '# of exports consumed this month against the "1 free if <10 outreach rows" quota.';
COMMENT ON COLUMN user_profile.export_count_resets_at IS
  'When monthly_export_count next rolls over to 0. Lazy reset on read.';
COMMENT ON COLUMN user_profile.paid_export_credits IS
  '# of $25 one-off export credits the user has paid for but not yet consumed.';
COMMENT ON TABLE paid_exports IS
  'Per-Stripe-session ledger of paid export purchases. PRIMARY KEY on session_id makes webhook + redirect fulfillment idempotent.';
