-- 0044_inbox_service_grants.sql
--
-- Fix: "permission denied for table inbox_threads" when a USER starts a
-- new thread (POST /api/inbox/new) or replies to a reply-enabled
-- broadcast (the spin-off in /api/inbox/[threadId]/reply).
--
-- Both run through the SERVICE ROLE (users can't INSERT into
-- inbox_threads under RLS — admin-only). But 0042 granted the inbox
-- tables only to `authenticated`, not `service_role`. Raw-SQL tables in
-- this project don't auto-grant (see the GRANT note in 0042 +
-- project_gotchas), so the service role had no INSERT privilege and
-- Postgres denied it at the grant level — before RLS even runs.
--
-- The authenticated-only paths (admin compose, user reply to a direct
-- thread, mark-read) worked fine, which is why this only showed up on
-- the user-initiated flow.
--
-- Additive, idempotent. No data change.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_threads  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_reads    TO service_role;

NOTIFY pgrst, 'reload schema';
