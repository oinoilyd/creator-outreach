-- 0051_direct_email.sql
--
-- Foundation for the DIRECT email integration — connecting straight to a
-- user's Gmail / Outlook over OAuth, instead of going through Unipile.
--
-- This is the "own it" path (no per-seat middleman fee, full control of
-- read/send/threading). It runs DARK behind the DIRECT_EMAIL_ENABLED flag
-- and in parallel with the existing Unipile path — nothing here touches
-- unipile_* code or the live outreach send. Adding these tables is inert
-- until the application code that reads them is flag-enabled.
--
-- Four tables, matching the agreed design:
--   1. direct_email_accounts   — one row per connected mailbox (encrypted
--                                tokens + the incremental-sync cursor).
--   2. direct_email_log        — every message in/out, keyed by the
--                                provider's stable message id (idempotent
--                                upsert on re-sync). This is what makes
--                                "emails tie to status" possible.
--   3. direct_email_sequences  — an ordered follow-up recipe (email, wait
--                                N days, email, …).
--   4. direct_email_enrollments— a contact walking through a sequence,
--                                with the stop-conditions that gate every
--                                automated send.
--
-- RLS: every table is owned by user_id = auth.uid(). No auth.users reads
-- in the policies (perf + the project's standing rule). auth.uid() is
-- wrapped in a subselect so Postgres evaluates it once per query, not
-- once per row.
--
-- Tokens are NEVER stored in plaintext — the *_enc columns hold AES-256-GCM
-- blobs produced by lib/email/direct/crypto.ts. The DB only ever sees
-- ciphertext.

-- ── 1. Connected mailboxes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.direct_email_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  provider          text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  email             text NOT NULL,
  -- Encrypted OAuth material (AES-256-GCM, app-layer). Never plaintext.
  access_token_enc  text,
  refresh_token_enc text,
  token_expires_at  timestamptz,
  scopes            text,
  -- Incremental-sync cursors. Gmail uses an opaque historyId; Microsoft
  -- Graph uses a delta link URL. Only one is populated per provider.
  history_id        text,
  delta_link        text,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'needs_reconnect', 'revoked')),
  last_synced_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- One connection per mailbox per user. Reconnecting updates in place.
  UNIQUE (user_id, provider, email)
);

CREATE INDEX IF NOT EXISTS direct_email_accounts_user_idx
  ON public.direct_email_accounts (user_id);

-- ── 2. Message log (in + out) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.direct_email_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  account_id         uuid NOT NULL
                     REFERENCES public.direct_email_accounts (id) ON DELETE CASCADE,
  -- The provider's own stable id (Gmail message id / Graph message id).
  -- The unique key below makes re-syncs idempotent — we upsert, never dup.
  provider_message_id text NOT NULL,
  thread_id          text,
  direction          text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email         text,
  from_name          text,
  to_emails          text[],
  subject            text,
  snippet            text,
  sent_at            timestamptz,
  -- Soft link to the outreach row this message belongs to (no hard FK so
  -- the log survives outreach edits/deletes and matches the project's
  -- loose-coupling convention). Set when we can match a reply to a send.
  outreach_entry_id  uuid,
  -- Filled by the reply classifier (lib/inbound-classify.ts) on inbound
  -- mail: interested / not_interested / out_of_office / bounced / other.
  classification     text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider_message_id)
);

CREATE INDEX IF NOT EXISTS direct_email_log_thread_idx
  ON public.direct_email_log (user_id, thread_id);
CREATE INDEX IF NOT EXISTS direct_email_log_outreach_idx
  ON public.direct_email_log (outreach_entry_id);

-- ── 3. Follow-up sequences ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.direct_email_sequences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  name        text NOT NULL,
  -- Ordered steps, e.g.
  --   [{"type":"email","subject":"…","body":"…"},
  --    {"type":"wait","days":3},
  --    {"type":"email","subject":"…","body":"…"}]
  steps       jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS direct_email_sequences_user_idx
  ON public.direct_email_sequences (user_id);

-- ── 4. Enrollments (a contact moving through a sequence) ─────────────────────

CREATE TABLE IF NOT EXISTS public.direct_email_enrollments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  sequence_id       uuid NOT NULL
                    REFERENCES public.direct_email_sequences (id) ON DELETE CASCADE,
  outreach_entry_id uuid,
  contact_email     text NOT NULL,
  current_step      integer NOT NULL DEFAULT 0,
  next_run_at       timestamptz,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'completed', 'stopped')),
  -- Why a sequence stopped early — the safety gate that prevents the
  -- classic "followed up after they already replied" bug.
  stop_reason       text CHECK (stop_reason IN
                      ('replied', 'bounced', 'manual', 'booked', 'unsubscribed')),
  last_step_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- The follow-up cron finds due work with: status='active' AND next_run_at <= now().
CREATE INDEX IF NOT EXISTS direct_email_enrollments_due_idx
  ON public.direct_email_enrollments (status, next_run_at);
CREATE INDEX IF NOT EXISTS direct_email_enrollments_user_idx
  ON public.direct_email_enrollments (user_id);

-- ── Row-level security ──────────────────────────────────────────────────────
-- Every table: a user can only see/touch their own rows. service_role
-- (cron + OAuth callback) bypasses RLS entirely, so no policy is needed
-- for it — only the explicit GRANTs below.

ALTER TABLE public.direct_email_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_email_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_email_sequences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_email_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS direct_email_accounts_owner ON public.direct_email_accounts;
CREATE POLICY direct_email_accounts_owner ON public.direct_email_accounts
  FOR ALL USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS direct_email_log_owner ON public.direct_email_log;
CREATE POLICY direct_email_log_owner ON public.direct_email_log
  FOR ALL USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS direct_email_sequences_owner ON public.direct_email_sequences;
CREATE POLICY direct_email_sequences_owner ON public.direct_email_sequences
  FOR ALL USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS direct_email_enrollments_owner ON public.direct_email_enrollments;
CREATE POLICY direct_email_enrollments_owner ON public.direct_email_enrollments
  FOR ALL USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Raw tables created outside the Supabase UI need explicit grants (the
-- project hit this before — see 0050). authenticated operates within RLS;
-- service_role needs full access for the sync cron + OAuth callback.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_email_accounts    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_email_log         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_email_sequences   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_email_enrollments TO authenticated;

GRANT ALL ON public.direct_email_accounts    TO service_role;
GRANT ALL ON public.direct_email_log         TO service_role;
GRANT ALL ON public.direct_email_sequences   TO service_role;
GRANT ALL ON public.direct_email_enrollments TO service_role;

NOTIFY pgrst, 'reload schema';
