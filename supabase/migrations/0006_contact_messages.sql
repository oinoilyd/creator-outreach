-- Contact form submissions from the public landing page.
-- Anyone can insert (the form is public). Only the admin can read.
-- Each row also fires an email to dmeehanj@gmail.com via the /api/contact
-- route — this table is the durable "inbox" you can review later.

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  name        text NOT NULL,
  email       text NOT NULL,
  message     text NOT NULL,
  user_agent  text,
  resolved    boolean NOT NULL DEFAULT false
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Public insert: the contact form submits without auth.
DROP POLICY IF EXISTS "anyone can insert contact" ON public.contact_messages;
CREATE POLICY "anyone can insert contact"
  ON public.contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admin-only read.
DROP POLICY IF EXISTS "admin can read contact" ON public.contact_messages;
CREATE POLICY "admin can read contact"
  ON public.contact_messages FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'dmeehanj@gmail.com');

-- Admin-only update (for marking resolved).
DROP POLICY IF EXISTS "admin can update contact" ON public.contact_messages;
CREATE POLICY "admin can update contact"
  ON public.contact_messages FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'dmeehanj@gmail.com');

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
  ON public.contact_messages (created_at DESC);

-- Supabase doesn't auto-grant table privileges to anon/authenticated for
-- tables created via the SQL editor — RLS policies alone aren't enough,
-- the underlying GRANT must be present too.
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE ON public.contact_messages TO authenticated;
