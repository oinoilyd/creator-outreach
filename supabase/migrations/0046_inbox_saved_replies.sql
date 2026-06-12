-- 0046_inbox_saved_replies.sql
--
-- Admin canned responses for the inbox. A small library of reusable
-- answers the admin can insert into a reply with one click — the
-- biggest time-saver once the same questions repeat at volume.
--
-- Admin-only (single shared library). Same auth.jwt() email pattern as
-- the rest of the inbox; grants to authenticated + service_role per the
-- raw-SQL-table gotcha. Additive.

CREATE TABLE IF NOT EXISTS public.inbox_saved_replies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title      TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.inbox_saved_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inbox_saved_replies_admin" ON public.inbox_saved_replies;
CREATE POLICY "inbox_saved_replies_admin" ON public.inbox_saved_replies FOR ALL USING (
  (auth.jwt() ->> 'email') = 'dmeehanj@gmail.com'
) WITH CHECK (
  (auth.jwt() ->> 'email') = 'dmeehanj@gmail.com'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_saved_replies TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
