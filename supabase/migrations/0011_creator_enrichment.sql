-- Creator enrichment cache — append-only history of every email +
-- social-handle resolution we've ever done.
--
-- Why this table exists:
--   The /api/enrich route runs 7 strategies (youtube_about / ddg /
--   web_scrape / biolink / bio_pages / wayback / domain_guess) per
--   creator and takes 5–12s. Today we cache the result in Redis for
--   7 days. After that, OR if Redis evicts, OR cold-start after
--   deploy, we re-scrape from scratch. This table makes that
--   enrichment durable across Redis evictions and across users.
--
-- Why append-only:
--   Each row is a snapshot of (channelId, email, socials, subs) at
--   fetched_at. Never UPDATE — every enrich call inserts a new
--   snapshot. Trends + recovery come for free.
--
-- Why latest-view:
--   90% of reads want "the most recent snapshot for channel X."
--   creator_enrichment_latest VIEW handles that without app-side
--   DISTINCT ON queries.
--
-- Privacy:
--   Internal-use cache for authenticated users. Same posture as
--   creator_ig_metrics — RLS allows read for authenticated, writes
--   only via service role from /api/enrich.

CREATE TABLE IF NOT EXISTS public.creator_enrichment (
  id              BIGSERIAL PRIMARY KEY,
  -- Natural key: YouTube channel ID (e.g. "UCxxxxxx").
  yt_channel_id   TEXT NOT NULL,
  channel_name    TEXT,
  niche           TEXT,

  -- Email + provenance
  email           TEXT,                                   -- NULL = we tried, found none
  email_source    TEXT,                                   -- which of the 7 strategies produced it
  email_bounced   BOOLEAN NOT NULL DEFAULT false,         -- user marks bad → forces re-fetch

  -- Socials
  linkedin_url    TEXT,
  instagram_handle TEXT,
  twitter_handle  TEXT,
  website         TEXT,

  -- Channel snapshot (changes over time, hence append-only)
  subscribers     BIGINT,
  avg_views       BIGINT,
  last_video_at   TIMESTAMPTZ,
  recent_video_dates JSONB,                               -- array of ISO timestamps

  -- Audit + recovery
  raw_response_json JSONB,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup index: most reads filter by channel_id and want freshest.
CREATE INDEX IF NOT EXISTS idx_creator_enrichment_channel_fetched
  ON public.creator_enrichment (yt_channel_id, fetched_at DESC);

-- "Find by email" index for de-duping inbound contacts and
-- bounce tracking.
CREATE INDEX IF NOT EXISTS idx_creator_enrichment_email
  ON public.creator_enrichment (email)
  WHERE email IS NOT NULL;

-- "Recently added" admin views.
CREATE INDEX IF NOT EXISTS idx_creator_enrichment_fetched_at
  ON public.creator_enrichment (fetched_at DESC);

-- Convenience view: latest snapshot per channel.
CREATE OR REPLACE VIEW public.creator_enrichment_latest AS
SELECT DISTINCT ON (yt_channel_id) *
FROM public.creator_enrichment
ORDER BY yt_channel_id, fetched_at DESC;

-- RLS: shared internal cache. Same posture as creator_ig_metrics.
ALTER TABLE public.creator_enrichment ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read (cost of resolving was borne by us).
CREATE POLICY "creator_enrichment_read_authenticated"
  ON public.creator_enrichment
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for authenticated → only the
-- service role (/api/enrich worker) can write. Prevents user
-- clients from forging snapshots.

GRANT SELECT ON public.creator_enrichment_latest TO authenticated;
