-- 0025_stripe_events_processed_at.sql
--
-- Two-phase webhook idempotency ledger. The 0022 design inserted
-- event.id into stripe_events BEFORE running the handler. If the
-- handler then threw (500), Stripe retried the delivery — but on
-- retry, our dedupe path saw the existing ledger row and returned
-- 200 without running the handler. The event would be permanently
-- abandoned, silently.
--
-- Fix: split the ledger into a two-phase claim:
--   • INSERT on entry stamps received_at (the existing behavior).
--   • UPDATE after successful handler completion stamps processed_at.
--   • Dedupe path only short-circuits if processed_at IS NOT NULL.
--
-- This is a strict superset of the previous behavior:
--   - First successful delivery: insert → process → mark processed.
--     Subsequent retries see processed_at set → dedupe with 200.
--   - First delivery throws 500: insert → throw. processed_at still
--     NULL. Retry sees NULL → re-runs handler → eventually processes.
--   - Handler races (two simultaneous deliveries): both insert (one
--     succeeds, one gets unique-violation). Both process (idempotent
--     handler). Both update processed_at. End state correct.

ALTER TABLE public.stripe_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.stripe_events.processed_at IS
  'Set to NOW() after the webhook handler completes successfully. Dedupe path short-circuits only if this is NOT NULL — events that errored mid-handler stay processed_at=NULL and are re-tried on Stripe redelivery.';

-- Backfill: existing rows in stripe_events were inserted under the
-- old "insert-before-process" regime. Treat them all as already-
-- processed so we don't re-run handlers for ancient events on
-- redelivery (which Stripe wouldn't do anyway after 3 days, but
-- defensive).
UPDATE public.stripe_events
SET processed_at = received_at
WHERE processed_at IS NULL;
