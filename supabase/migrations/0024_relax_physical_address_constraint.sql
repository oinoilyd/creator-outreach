-- 0024_relax_physical_address_constraint.sql
--
-- Relax the CAN-SPAM physical_address check so it stops blocking
-- legitimate UPDATEs to existing rows that have onboarded=true with
-- an empty/null physical_address.
--
-- The 0023 constraint was written assuming every onboarded user has
-- a real address. In practice we have grandfathered rows from BEFORE
-- 0023 was added (early dev signups + the period when OnboardingModal
-- was a soft-warn). Those rows have onboarded=true with empty
-- physical_address, and the old strict constraint blocks ANY update
-- to them — including subscription state syncs from Stripe webhooks
-- and our /billing/sync trampoline. The Stripe mirror silently fails
-- with check_violation, and the user's UI never reflects the truth.
--
-- New constraint allows the three legitimate states:
--   • NULL                          (never set — grandfathered)
--   • empty string                  (cleared somehow — grandfathered)
--   • length(btrim) >= 8 chars      (a real address — the goal)
--
-- It still blocks the "clearly garbage" case (1-7 chars) which would
-- mostly be typos.
--
-- CAN-SPAM enforcement moves to two places that catch it earlier:
--   1. OnboardingModal client-side validation (already requires 8+ chars)
--   2. Email-send code path (lib/format.ts buildCanSpamFooter checks
--      address before attaching to outgoing mail — pre-existing)
--
-- Net effect: defense in depth at the app + client layer, but the DB
-- no longer breaks Stripe-state writes for legacy rows. The right
-- long-term fix is backfilling addresses on the grandfathered rows,
-- but that requires user input — this migration unblocks them in
-- the meantime.

ALTER TABLE public.user_profile
  DROP CONSTRAINT IF EXISTS user_profile_physical_address_required;

ALTER TABLE public.user_profile
  DROP CONSTRAINT IF EXISTS user_profile_physical_address_valid;

ALTER TABLE public.user_profile
  ADD CONSTRAINT user_profile_physical_address_valid
  CHECK (
    physical_address IS NULL
    OR length(btrim(physical_address)) = 0
    OR length(btrim(physical_address)) >= 8
  );

COMMENT ON CONSTRAINT user_profile_physical_address_valid
  ON public.user_profile IS
  'CAN-SPAM postal address must be either absent (grandfathered or pre-onboarding) or >= 8 non-whitespace chars. The strict "onboarded users MUST have address" enforcement now lives in OnboardingModal (client-side) + lib/format.ts buildCanSpamFooter (server-side email send path). The DB-level guard is intentionally lenient so legacy rows can still receive Stripe state updates from webhooks/sync.';
