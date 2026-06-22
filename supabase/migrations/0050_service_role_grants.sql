-- 0050_service_role_grants.sql
-- Backfill missing service_role table GRANTs (pre-launch audit, 2026-06-22).
--
-- Raw-SQL-created tables in this project do NOT auto-grant privileges to
-- service_role — migrations 0012, 0020, 0036 and 0044 each exist solely to
-- fix this same gap. The audit found three more tables that service-role
-- server paths WRITE to but were never granted, so every write silently
-- fails with "permission denied for table X" (SQLSTATE 42501) BEFORE RLS
-- even evaluates:
--
--   • stripe_events — the Stripe webhook idempotency ledger
--     (app/api/stripe/webhook). If writes fail, events are never marked
--     processed, so Stripe's retries REPROCESS them → double
--     subscription / credit provisioning. This is the most important one.
--   • creator_ig_metrics — the Instagram enrichment cache
--     (app/api/instagram-fetch). Failing writes keep the cache empty so
--     IG metrics never populate from this path.
--   • outreach_entries_deletion_log — the BEFORE DELETE audit trigger
--     writes here, and the admin read policy needs table SELECT to
--     evaluate at all.
--
-- GRANTs are idempotent — re-running is harmless, and if service_role
-- already has access in this project these are no-ops.

-- Guarded with to_regclass so a table that isn't present in a given
-- database is skipped instead of erroring the whole block. Notably
-- creator_ig_metrics (0010) was never applied to prod — IG metrics run
-- off the Redis cache there, so that Postgres table is legitimately
-- absent. GRANT runs fine inside a plpgsql DO block.
DO $$
BEGIN
  -- Stripe webhook idempotency ledger (id UUID — no backing sequence).
  IF to_regclass('public.stripe_events') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.stripe_events TO service_role;
  END IF;

  -- Instagram metrics cache (id BIGSERIAL — grant the backing sequence too).
  IF to_regclass('public.creator_ig_metrics') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.creator_ig_metrics TO service_role;
    GRANT USAGE, SELECT ON SEQUENCE public.creator_ig_metrics_id_seq TO service_role;
  END IF;

  -- Outreach deletion audit log (log_id BIGSERIAL). The BEFORE DELETE
  -- trigger INSERTs here; the admin-only read policy needs `authenticated`
  -- to hold table SELECT (RLS gates WHICH rows, the GRANT gates access at
  -- all — without it even the admin gets "permission denied").
  IF to_regclass('public.outreach_entries_deletion_log') IS NOT NULL THEN
    GRANT SELECT, INSERT ON public.outreach_entries_deletion_log TO service_role;
    GRANT USAGE, SELECT ON SEQUENCE public.outreach_entries_deletion_log_log_id_seq TO service_role;
    GRANT SELECT ON public.outreach_entries_deletion_log TO authenticated;
  END IF;
END $$;
