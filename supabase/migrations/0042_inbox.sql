-- 0042_inbox.sql
--
-- Two-way in-app messaging (Dylan 2026-06-10).
--
-- Turns the one-way admin contact inbox into a real channel:
--   • Admin → site-wide broadcast (one thread, NULL target, read by all)
--   • Admin → direct message to one user (two-way)
--   • Users → reply to direct threads, and to reply-enabled broadcasts
--     (a broadcast reply spins off a private direct thread)
--   • Inquiries (contact_messages) can become direct threads the admin
--     answers in-app (origin_contact_id links them)
--
-- Three tables:
--   inbox_threads   — a conversation (broadcast or direct)
--   inbox_messages  — messages within a thread
--   inbox_reads     — per-user read state (lets ONE broadcast row be
--                     read independently by N users, no fan-out)
--
-- IMPORTANT — two Supabase gotchas this migration avoids:
--   1. NO foreign keys to auth.users. Supabase has tightened the SQL
--      Editor's access to the auth schema, so `REFERENCES auth.users(id)`
--      now throws "permission denied for table users". User ids are
--      plain UUID columns; the app sources them from real users.
--   2. Admin RLS uses (auth.jwt() ->> 'email'), never a SELECT on
--      auth.users (same error). Matches 0006/0007.
--
-- Re-runnable: drops + recreates the (brand-new, empty) inbox tables so
-- a half-applied earlier attempt is cleaned up. Safe — these tables have
-- never successfully held data (every write errored until this fix).

-- Clear any partial state from earlier failed runs. CASCADE also removes
-- the trigger + policies on these tables. Safe: brand-new, no real data.
DROP TABLE IF EXISTS public.inbox_reads    CASCADE;
DROP TABLE IF EXISTS public.inbox_messages CASCADE;
DROP TABLE IF EXISTS public.inbox_threads  CASCADE;

-- ── 1. inbox_threads ────────────────────────────────────────────────
CREATE TABLE public.inbox_threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  subject           TEXT NOT NULL DEFAULT '',
  -- 'broadcast' = NULL target, visible to everyone.
  -- 'direct'    = one-to-one with target_user_id.
  type              TEXT NOT NULL CHECK (type IN ('broadcast', 'direct')),
  -- auth.users id of the recipient (direct only). Plain UUID — no FK to
  -- auth.users (see header). NULL for broadcasts.
  target_user_id    UUID,
  -- Broadcasts only: whether users can reply (reply spins a direct
  -- thread). Direct threads are always repliable.
  allow_replies     BOOLEAN NOT NULL DEFAULT true,
  -- When this thread answers a contact-form inquiry, link it.
  origin_contact_id UUID REFERENCES public.contact_messages(id) ON DELETE SET NULL,
  -- For a broadcast-reply spin-off, point back at the broadcast.
  origin_thread_id  UUID REFERENCES public.inbox_threads(id) ON DELETE SET NULL
);

CREATE INDEX inbox_threads_target_idx
  ON public.inbox_threads(target_user_id) WHERE target_user_id IS NOT NULL;
CREATE INDEX inbox_threads_type_updated_idx
  ON public.inbox_threads(type, updated_at DESC);

-- ── 2. inbox_messages ───────────────────────────────────────────────
CREATE TABLE public.inbox_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       UUID NOT NULL REFERENCES public.inbox_threads(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  body            TEXT NOT NULL,
  -- auth.users id of the author; NULL = sent by admin / system.
  -- Plain UUID — no FK to auth.users (see header).
  author_user_id  UUID,
  author_is_admin BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX inbox_messages_thread_idx
  ON public.inbox_messages(thread_id, created_at);

-- Bump the parent thread's updated_at on every new message (drives
-- inbox sort order + "new reply" surfacing).
CREATE OR REPLACE FUNCTION public.touch_inbox_thread()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.inbox_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS inbox_messages_touch_thread ON public.inbox_messages;
CREATE TRIGGER inbox_messages_touch_thread
  AFTER INSERT ON public.inbox_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_inbox_thread();

-- ── 3. inbox_reads (per-user read state) ────────────────────────────
CREATE TABLE public.inbox_reads (
  thread_id    UUID NOT NULL REFERENCES public.inbox_threads(id) ON DELETE CASCADE,
  -- auth.users id; plain UUID — no FK to auth.users (see header).
  user_id      UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed    BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (thread_id, user_id)
);

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.inbox_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_reads    ENABLE ROW LEVEL SECURITY;

-- Admin check uses (auth.jwt() ->> 'email') — reads the email straight
-- from the request JWT, NO table access. A direct `SELECT email FROM
-- auth.users` in a policy throws "permission denied for table users"
-- because the `authenticated` role can't read auth.users. Matches the
-- working pattern in 0006_contact_messages / 0007_email_test_runs.

-- THREADS: see broadcasts + your own direct threads; admin sees all.
DROP POLICY IF EXISTS "inbox_threads_select" ON public.inbox_threads;
CREATE POLICY "inbox_threads_select" ON public.inbox_threads FOR SELECT USING (
  type = 'broadcast'
  OR target_user_id = auth.uid()
  OR (auth.jwt() ->> 'email') = 'dmeehanj@gmail.com'
);
-- Only admin inserts/updates threads directly. The "user reply spins a
-- direct thread" flow runs server-side via the service role (bypasses RLS).
DROP POLICY IF EXISTS "inbox_threads_admin_write" ON public.inbox_threads;
CREATE POLICY "inbox_threads_admin_write" ON public.inbox_threads FOR ALL USING (
  (auth.jwt() ->> 'email') = 'dmeehanj@gmail.com'
) WITH CHECK (
  (auth.jwt() ->> 'email') = 'dmeehanj@gmail.com'
);

-- MESSAGES: visible if the parent thread is visible.
DROP POLICY IF EXISTS "inbox_messages_select" ON public.inbox_messages;
CREATE POLICY "inbox_messages_select" ON public.inbox_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.inbox_threads t
    WHERE t.id = inbox_messages.thread_id
      AND (
        t.type = 'broadcast'
        OR t.target_user_id = auth.uid()
        OR (auth.jwt() ->> 'email') = 'dmeehanj@gmail.com'
      )
  )
);
-- A user may post a reply ONLY into a direct thread that targets them.
-- Admin (and service role) post anywhere.
DROP POLICY IF EXISTS "inbox_messages_insert" ON public.inbox_messages;
CREATE POLICY "inbox_messages_insert" ON public.inbox_messages FOR INSERT WITH CHECK (
  (
    author_user_id = auth.uid()
    AND author_is_admin = false
    AND EXISTS (
      SELECT 1 FROM public.inbox_threads t
      WHERE t.id = thread_id
        AND t.type = 'direct'
        AND t.target_user_id = auth.uid()
    )
  )
  OR (auth.jwt() ->> 'email') = 'dmeehanj@gmail.com'
);

-- READS: each user manages only their own.
DROP POLICY IF EXISTS "inbox_reads_self" ON public.inbox_reads;
CREATE POLICY "inbox_reads_self" ON public.inbox_reads FOR ALL USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_threads  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_reads    TO authenticated;

-- ── Unread-count helper ─────────────────────────────────────────────
-- How many threads visible to the caller have a message they haven't
-- read (no inbox_reads row, or a message newer than last_read_at).
-- SECURITY DEFINER so the per-thread message scan isn't blocked by RLS.
--
-- Note: dismissing a thread stamps last_read_at = now, so a dismissed
-- thread only re-counts when a NEW message arrives after the dismiss —
-- exactly the "resurface on admin follow-up" behavior we want. That's
-- why there's no explicit `dismissed` exclusion here.
CREATE OR REPLACE FUNCTION public.inbox_unread_count()
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.inbox_threads t
  WHERE (t.type = 'broadcast' OR t.target_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.inbox_messages m
      WHERE m.thread_id = t.id
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM public.inbox_reads r WHERE r.thread_id = t.id AND r.user_id = auth.uid()),
          'epoch'::timestamptz
        )
        -- Don't count the user's own messages as unread.
        AND COALESCE(m.author_user_id, '00000000-0000-0000-0000-000000000000') <> auth.uid()
    );
$$;
GRANT EXECUTE ON FUNCTION public.inbox_unread_count() TO authenticated;

NOTIFY pgrst, 'reload schema';
