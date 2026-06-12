-- 0043_inbox_touch_definer.sql
--
-- Fix: a USER's reply wasn't bumping its thread's updated_at.
--
-- touch_inbox_thread() (0042) ran as the calling user. When a regular
-- user inserts a reply, its UPDATE on inbox_threads is filtered to 0
-- rows by RLS (only admin can UPDATE inbox_threads), so updated_at
-- never moved and the thread didn't resurface to the top of the admin
-- list — making replies easy to miss.
--
-- Make the trigger SECURITY DEFINER so the touch always lands,
-- regardless of who inserted the message. The trigger only ever bumps
-- a timestamp on the parent of the row just inserted, so it's safe.
--
-- Replacing the function is enough — the 0042 trigger references it by
-- name. Additive, no data change.

CREATE OR REPLACE FUNCTION public.touch_inbox_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.inbox_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
