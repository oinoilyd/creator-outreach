-- 0049_creator_product_summary.sql
--
-- Adds a durable cache for the new Results "Product" column — a short
-- AI-generated summary of what a creator SELLS (course, coaching,
-- membership, physical product, etc). Distinct from the Outreach
-- "Product" column, which is the user's OWN pitch.
--
-- Why a dedicated table (not a column on creator_enrichment):
--   creator_enrichment is APPEND-ONLY with a `DISTINCT ON (yt_channel_id)
--   ORDER BY fetched_at DESC` latest-view. Writing a product-summary-only
--   row there would mask the fully-enriched latest snapshot (the
--   carry-forward problem solved in bulkSaveSearchResults). A tiny
--   keyed-by-channel UPSERT table sidesteps that entirely and lets the
--   summary be computed once and reused forever.
--
-- The summary is computed server-side (/api/enrich/product) via the
-- SERVICE ROLE, gated by the cheap has_product_mention keyword check so
-- we only spend an AI call on creators that plausibly sell something.
--
--   sells      — did we detect a product? (false = checked, nothing found)
--   summary    — <= ~80 chars, '' when sells = false
--   checked_at — when we last ran the summarizer (enables future re-check)

CREATE TABLE IF NOT EXISTS public.creator_product_summary (
  -- Natural key: YouTube channel ID (e.g. "UCxxxxxx"). One row per
  -- creator; the summarizer UPSERTs on conflict.
  yt_channel_id TEXT PRIMARY KEY,
  sells         BOOLEAN NOT NULL DEFAULT false,
  summary       TEXT    NOT NULL DEFAULT '',
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: shared internal cache, same posture as creator_enrichment (0011).
ALTER TABLE public.creator_product_summary ENABLE ROW LEVEL SECURITY;

-- Authenticated users may READ (the cost of computing was borne by us).
-- No INSERT/UPDATE/DELETE policies → only the service role can write,
-- which prevents user clients from forging summaries.
CREATE POLICY "creator_product_summary_read_authenticated"
  ON public.creator_product_summary
  FOR SELECT
  TO authenticated
  USING (true);

-- Raw-SQL tables in this project DON'T auto-grant (see project_gotchas +
-- the GRANT note in 0042/0044). The summarizer reads + writes through the
-- SERVICE ROLE, so grant it explicitly or every call fails at the grant
-- level before RLS even runs.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_product_summary TO service_role;
GRANT SELECT ON public.creator_product_summary TO authenticated;

NOTIFY pgrst, 'reload schema';
