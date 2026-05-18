-- 0027_user_terms_consent.sql
--
-- Per-user consent audit trail for Terms of Service + Privacy Policy.
--
-- Why: GDPR Article 7 requires the controller to be able to demonstrate
-- that the data subject has consented to the processing of their data.
-- Although our lawful basis is primarily Contract (Art. 6(1)(b)) — the
-- user signs up for the Service, so the contract IS the basis — adding
-- an explicit consent checkbox at signup AND recording the timestamp +
-- version of what they agreed to is the cleanest belt-and-suspenders
-- posture for compliance reviews / procurement asks.
--
-- US state privacy laws (CCPA/CPRA/etc.) don't require pre-collection
-- consent for ordinary personal data, but having the same audit trail
-- helps if a state AG or class-action ever asks "when did this user
-- accept your terms?"
--
-- One timestamp covers BOTH Terms + Privacy because the signup
-- checkbox bundles them as a single accept ("I agree to the Terms of
-- Service and Privacy Policy"). The version string lets us re-prompt
-- users if either doc materially changes — the privacy.ts and
-- terms.ts files both carry lastUpdated dates we can match against.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS terms_privacy_agreed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_privacy_version   TEXT;

COMMENT ON COLUMN public.user_profile.terms_privacy_agreed_at IS
  'Timestamp the user checked "I agree to Terms + Privacy" at signup. NULL means consent not yet collected (pre-checkbox users; we can prompt them next sign-in to backfill). Audit trail for GDPR Article 7 compliance.';

COMMENT ON COLUMN public.user_profile.terms_privacy_version IS
  'Version string of the Terms + Privacy that the user agreed to (matches lib/legal/content/{terms,privacy}.ts lastUpdated dates). When either doc materially changes, bump the version + re-prompt. e.g. "2026-05-11".';
