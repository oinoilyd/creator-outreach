-- 0023_can_spam_address_required.sql
--
-- Hard-require a non-trivial physical_address on every onboarded
-- profile. CAN-SPAM §5(a)(5) — every commercial email MUST carry the
-- sender's postal address. Migration 0021 made the column nullable
-- while the onboarding flow was a soft-warn; this migration flips it
-- to a CHECK constraint so the database refuses any UPDATE that flips
-- onboarded=true without a real address present.
--
-- Why a CHECK + onboarded gate (not NOT NULL):
--   - Existing pre-CAN-SPAM rows have null addresses; we can't NOT NULL
--     them without first running a backfill — and there's nothing
--     reasonable to backfill to.
--   - The constraint only fires when onboarded=true, so legacy users
--     can still log in and fix their address before re-completing
--     onboarding.
--   - 8 chars is the same floor the client enforces (OnboardingModal).
--     A real US street address is comfortably above that; PO Box
--     variants ("PO Box 1, City ST") clear it too.

ALTER TABLE public.user_profile
  DROP CONSTRAINT IF EXISTS user_profile_physical_address_required;

ALTER TABLE public.user_profile
  ADD CONSTRAINT user_profile_physical_address_required
  CHECK (
    onboarded IS NOT TRUE
    OR (
      physical_address IS NOT NULL
      AND length(btrim(physical_address)) >= 8
    )
  );

COMMENT ON CONSTRAINT user_profile_physical_address_required
  ON public.user_profile IS
  'Enforces CAN-SPAM §5(a)(5): an onboarded user MUST have a non-trivial postal address on file. The 8-char floor matches the OnboardingModal client validation.';
