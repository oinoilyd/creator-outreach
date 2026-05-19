-- 0028_active_clients.sql
--
-- "Active Client" surface — per Dylan 2026-05-18.
--
-- When an outreach entry is marked status='Successful', it represents
-- a real signed engagement. Today the row keeps the same shape as any
-- other outreach — same columns for status, notes, follow-up. But the
-- engagement now has different metadata that matters:
--
--   • Budget  — deal value
--   • Timeline — start + end dates of the engagement
--   • Scope   — what's actually being delivered
--   • Contract URL — link to the signed contract (Google Drive,
--     Dropbox, Notion, wherever it lives)
--   • Client notes — engagement-specific notes, distinct from the
--     pre-deal outreach `notes` field which tends to track sourcing /
--     follow-up context.
--
-- Phase 1 (this migration): add columns to outreach_entries. Filter by
-- status='Successful' to surface these in the new "Active Clients"
-- sub-tab. All columns nullable so older rows that have NO client
-- data still render cleanly (with empty fields).
--
-- Phase 2 (future, if needed): split into a dedicated active_clients
-- table with a 1:1 outreach_entry_id FK + lifecycle (active /
-- complete / paused / churned), automated milestones, file uploads
-- to Supabase Storage, etc. Defer until usage patterns confirm the
-- shape — Dylan's framing was "first go, can clean up later."

ALTER TABLE public.outreach_entries
  ADD COLUMN IF NOT EXISTS client_budget_amount   NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS client_budget_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS client_timeline_start  DATE,
  ADD COLUMN IF NOT EXISTS client_timeline_end    DATE,
  ADD COLUMN IF NOT EXISTS client_scope           TEXT,
  ADD COLUMN IF NOT EXISTS client_contract_url    TEXT,
  ADD COLUMN IF NOT EXISTS client_notes           TEXT;

COMMENT ON COLUMN public.outreach_entries.client_budget_amount IS
  'Deal value for the active-client engagement. NULL when no budget set yet. Numeric(12,2) supports up to $9,999,999,999.99 — sufficient for any reasonable creator deal.';

COMMENT ON COLUMN public.outreach_entries.client_budget_currency IS
  'ISO 4217 currency code for client_budget_amount (USD, EUR, GBP, etc.). Defaults USD.';

COMMENT ON COLUMN public.outreach_entries.client_timeline_start IS
  'Engagement start date. NULL when not yet scheduled.';

COMMENT ON COLUMN public.outreach_entries.client_timeline_end IS
  'Engagement end date (or projected completion). NULL when open-ended.';

COMMENT ON COLUMN public.outreach_entries.client_scope IS
  'Free-form scope description for the engagement — what is actually being delivered.';

COMMENT ON COLUMN public.outreach_entries.client_contract_url IS
  'External URL to the signed contract document (Google Drive, Dropbox, Notion, etc.). v1 supports linking only; Supabase Storage upload is a v2 followup.';

COMMENT ON COLUMN public.outreach_entries.client_notes IS
  'Engagement-specific notes separate from the pre-deal outreach `notes` field.';
