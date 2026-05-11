-- 0021_can_spam.sql
--
-- CAN-SPAM foundation — the data plumbing so every outreach email we
-- send through Unipile (or anywhere else) can claim CAN-SPAM compliance:
--
--   1. user_profile.physical_address — the sender's postal address.
--      CAN-SPAM §5(a)(5) requires every commercial email to include a
--      valid physical address. We collect this at onboarding (next step)
--      and auto-append it to the footer of outgoing email.
--
--   2. suppression_list — per-user unsubscribe ledger.
--      CAN-SPAM §5(a)(3-4) requires (a) a working unsubscribe mechanism
--      and (b) that the sender honor it within 10 business days. We
--      record every unsubscribe / bounce / complaint here and consult
--      this list before sending. RLS keeps each user's list private.
--
-- The unsubscribe endpoint itself, the pre-send filter, and the bounce
-- ingest from Unipile webhooks are separate follow-on tasks. This
-- migration is the schema foundation.

-- ── user_profile.physical_address ──────────────────────────────────
-- Nullable for now so existing rows don't 500. The onboarding flow and
-- the SendPreviewModal both nudge the user to fill it in before sending
-- commercial outreach.
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS physical_address TEXT;

COMMENT ON COLUMN public.user_profile.physical_address IS
  'Sender''s postal address. Auto-appended to the footer of every outreach email to satisfy CAN-SPAM §5(a)(5). Nullable; the composer warns when missing.';

-- ── suppression_list ──────────────────────────────────────────────
-- One row per (user, recipient_email) the user has unsubscribed,
-- bounced, or otherwise marked do-not-contact. Pre-send code looks
-- here before delivering any new outreach.
CREATE TABLE IF NOT EXISTS public.suppression_list (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Free-text reason. Today the values we write are: 'unsubscribe',
  -- 'bounce', 'complaint', 'manual'. Kept as TEXT (not enum) so we can
  -- add new reasons without a migration.
  reason          TEXT,
  CONSTRAINT suppression_list_user_recipient_unique
    UNIQUE (user_id, recipient_email)
);

COMMENT ON TABLE public.suppression_list IS
  'Per-user do-not-contact ledger. Consulted before every send to satisfy CAN-SPAM §5(a)(4) (honor opt-out within 10 business days). RLS isolates each user''s list.';

-- Fast pre-send lookup: "is (this user, this email) in the suppression
-- list?" — exactly the unique constraint we already declared, but an
-- explicit index makes the intent clear and lets us add other indexes
-- later (e.g. by recipient alone for cross-user analytics).
CREATE INDEX IF NOT EXISTS suppression_list_user_recipient_idx
  ON public.suppression_list (user_id, recipient_email);

-- ── RLS ────────────────────────────────────────────────────────────
-- A user can only read / write their own suppression rows. The
-- /unsubscribe endpoint (built later) will run with the service_role
-- key so the public unsubscribe link can write on behalf of any user.
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppression_list_select_own ON public.suppression_list;
CREATE POLICY suppression_list_select_own
  ON public.suppression_list
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS suppression_list_insert_own ON public.suppression_list;
CREATE POLICY suppression_list_insert_own
  ON public.suppression_list
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS suppression_list_update_own ON public.suppression_list;
CREATE POLICY suppression_list_update_own
  ON public.suppression_list
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS suppression_list_delete_own ON public.suppression_list;
CREATE POLICY suppression_list_delete_own
  ON public.suppression_list
  FOR DELETE
  USING (auth.uid() = user_id);
