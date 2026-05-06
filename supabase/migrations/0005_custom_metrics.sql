-- Per-user custom analytics metrics. Stored as a JSONB array of CustomMetric
-- objects on user_preferences. See lib/types.ts for the shape.

alter table public.user_preferences
  add column if not exists custom_metrics jsonb not null default '[]'::jsonb;
