-- 0030_engagement_wrapup.sql
--
-- Engagement wrap-up flow — per Dylan 2026-05-20.
--
-- When an active-client engagement is marked Completed, instead of
-- just flipping the lifecycle pill we open a "Wrap up engagement"
-- modal that captures real close data:
--
--   • Final value — what was actually paid (may differ from budget)
--   • Completion date — when the engagement really wrapped
--   • Rating — 1-5 star score on the engagement
--   • Repeat likelihood — definitely / likely / maybe / no
--   • Testimonial + public-use permission
--
-- The flow also auto-creates a follow-on outreach_entries row when
-- repeat=definitely or repeat=likely. For 'likely' rows, the new
-- column engagement_status='pending_confirmation' signals the UI to
-- render a "Pending — confirm next engagement?" pill. Once the user
-- confirms or denies, engagement_status is cleared.
--
-- Referrals + deliverable URLs + a free-form wrap-up note are
-- intentionally NOT structured columns — they get appended to the
-- existing client_notes free-text field with [tagged sections] so
-- the schema stays lean. Only the data that drives analytics or UI
-- gating gets its own column.

ALTER TABLE public.outreach_entries
  ADD COLUMN IF NOT EXISTS client_final_value        NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS client_completion_date    DATE,
  ADD COLUMN IF NOT EXISTS client_rating             SMALLINT,
  ADD COLUMN IF NOT EXISTS client_repeat_likelihood  TEXT,
  ADD COLUMN IF NOT EXISTS client_testimonial        TEXT,
  ADD COLUMN IF NOT EXISTS client_testimonial_public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS engagement_status         TEXT;

-- Constrain rating to 1-5. Nullable so older rows + active engagements
-- don't have to fill it in.
ALTER TABLE public.outreach_entries
  DROP CONSTRAINT IF EXISTS outreach_entries_client_rating_chk;
ALTER TABLE public.outreach_entries
  ADD CONSTRAINT outreach_entries_client_rating_chk
  CHECK (client_rating IS NULL OR (client_rating BETWEEN 1 AND 5));

-- Constrain repeat_likelihood to a known set. NULL = not captured.
ALTER TABLE public.outreach_entries
  DROP CONSTRAINT IF EXISTS outreach_entries_client_repeat_likelihood_chk;
ALTER TABLE public.outreach_entries
  ADD CONSTRAINT outreach_entries_client_repeat_likelihood_chk
  CHECK (
    client_repeat_likelihood IS NULL
    OR client_repeat_likelihood IN ('definitely', 'likely', 'maybe', 'no')
  );

-- Constrain engagement_status. NULL = normal outreach (no special
-- handling). 'pending_confirmation' = auto-created from a Likely
-- repeat — UI renders a pill prompting the user to confirm/deny.
ALTER TABLE public.outreach_entries
  DROP CONSTRAINT IF EXISTS outreach_entries_engagement_status_chk;
ALTER TABLE public.outreach_entries
  ADD CONSTRAINT outreach_entries_engagement_status_chk
  CHECK (
    engagement_status IS NULL
    OR engagement_status IN ('pending_confirmation')
  );

COMMENT ON COLUMN public.outreach_entries.client_final_value IS
  'Final amount actually received for the engagement. May differ from client_budget_amount (renegotiated scope, additional add-ons, etc.). NULL until wrap-up captured.';

COMMENT ON COLUMN public.outreach_entries.client_completion_date IS
  'When the engagement was marked completed via the wrap-up flow. Defaults to today on submit, but user-editable for retroactive entries.';

COMMENT ON COLUMN public.outreach_entries.client_rating IS
  '1-5 star rating of the engagement experience. Used by "best clients" analytics filters.';

COMMENT ON COLUMN public.outreach_entries.client_repeat_likelihood IS
  'How likely is repeat business: definitely (already in motion) / likely (happy client) / maybe (nurture) / no (one-off). Drives follow-up auto-creation.';

COMMENT ON COLUMN public.outreach_entries.client_testimonial IS
  'Captured testimonial quote from the wrap-up flow. May be NULL.';

COMMENT ON COLUMN public.outreach_entries.client_testimonial_public IS
  'Whether the user got permission to use the testimonial publicly (case studies, landing page). Defaults FALSE for safety.';

COMMENT ON COLUMN public.outreach_entries.engagement_status IS
  'Sub-state outside of the main status field. NULL=normal. "pending_confirmation"=auto-created from a Likely repeat-business signal; UI renders a confirm/deny pill.';

-- Refresh PostgREST cache so the new columns are visible to the API
-- without waiting for the automatic poll (which can lag 30-60s).
NOTIFY pgrst, 'reload schema';
