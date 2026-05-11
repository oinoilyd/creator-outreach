-- 0022_stripe_subscriptions.sql
--
-- Stripe test-mode subscription integration — foundation only.
-- Does NOT gate app access yet; just tracks every user's billing
-- relationship with Stripe so we can wire upgrade flows + read
-- subscription state from the UI.
--
--   1. user_profile columns — mirror just enough Stripe state that
--      the app can render "Free trial · 11 days left" / "Pro · monthly"
--      badges and decide which CTA to show without round-tripping to
--      Stripe on every request. Webhooks keep this current.
--
--      • stripe_customer_id   — set the first time the user hits
--        Checkout. We reuse it forever so saved cards / promo codes /
--        invoice history stick around even if they re-subscribe.
--      • stripe_subscription_id — current active sub. Null when the
--        user has never subscribed or fully canceled.
--      • subscription_status — TEXT (not enum) so we can store any
--        value Stripe sends without schema churn. Stripe's enum:
--        trialing, active, past_due, canceled, incomplete,
--        incomplete_expired, paused, unpaid.
--      • subscription_current_period_end — for trial-days-left math
--        when status='trialing', or "next bill on …" when 'active'.
--      • subscription_price_id — which plan they're on (monthly /
--        annual). Used to render the right "Pro · monthly" label.
--      • subscription_cancel_at_period_end — surfaces "canceling at
--        period end" so the UI can warn before they fully lapse.
--
--   2. stripe_events table — webhook idempotency ledger. Stripe
--      retries failed deliveries and can send duplicate events; we
--      record event.id before processing and short-circuit if we've
--      seen it. service_role only.

-- ── user_profile.stripe_* ──────────────────────────────────────────
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS stripe_customer_id              TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id          TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status             TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_price_id           TEXT,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.user_profile.stripe_customer_id IS
  'Stripe Customer ID (cus_…). Created lazily the first time the user starts Checkout; reused thereafter so saved cards / promo history persist across re-subscriptions.';
COMMENT ON COLUMN public.user_profile.stripe_subscription_id IS
  'Current Stripe Subscription ID (sub_…). Null when the user has never subscribed or is fully canceled.';
COMMENT ON COLUMN public.user_profile.subscription_status IS
  'Mirrors Stripe Subscription.status as TEXT (not enum) so we accept any value Stripe sends without schema churn. Typical values: trialing, active, past_due, canceled, incomplete, incomplete_expired, paused, unpaid.';
COMMENT ON COLUMN public.user_profile.subscription_current_period_end IS
  'End of current Stripe billing period (epoch from Stripe converted to TIMESTAMPTZ). Used for "trial ends in N days" + "next bill on …" labels.';
COMMENT ON COLUMN public.user_profile.subscription_price_id IS
  'Stripe Price ID the user is currently on (price_…). Drives "Pro · monthly" vs "Pro · annual" UI labels.';
COMMENT ON COLUMN public.user_profile.subscription_cancel_at_period_end IS
  'True when the user has requested cancellation via Customer Portal; the sub is still active until period_end then auto-cancels. UI surfaces a "canceling on …" warning.';

-- Fast lookup by stripe_customer_id (the webhook needs this to map
-- Stripe events → user_profile rows). Partial unique so multiple NULL
-- rows can coexist (every existing user is NULL until they checkout).
CREATE UNIQUE INDEX IF NOT EXISTS user_profile_stripe_customer_id_unique_idx
  ON public.user_profile (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ── stripe_events ──────────────────────────────────────────────────
-- Idempotency ledger. The webhook inserts event.id BEFORE processing;
-- if the insert fails on the unique constraint we short-circuit with
-- 200 and skip re-handling. Service-role only — no RLS policies.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.stripe_events IS
  'Webhook idempotency ledger. Stripe retries failed deliveries and may send duplicates; we record event.id here before processing so duplicates are 200-no-ops.';

-- The UNIQUE constraint above already creates an index on stripe_event_id,
-- but an explicit index makes the intent clear and lets us add other
-- indexes later (e.g. event_type for analytics) without confusion.
CREATE INDEX IF NOT EXISTS stripe_events_event_id_idx
  ON public.stripe_events (stripe_event_id);

-- No RLS — only the webhook (service_role) reads/writes this table.
-- We do NOT enable RLS here, matching the convention used by other
-- admin-only tables (e.g. bulk_jobs uses the same approach).
