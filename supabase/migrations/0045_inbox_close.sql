-- 0045_inbox_close.sql
--
-- Let the admin "close" a direct thread (ticket). A closed thread is
-- read-only for the user — they must start a new message instead of
-- continuing an open-ended conversation. NULL = open, timestamp = when
-- it was closed.
--
-- Additive, idempotent. No data change (existing threads stay open).

ALTER TABLE public.inbox_threads ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
