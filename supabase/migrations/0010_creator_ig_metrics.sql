-- Creator Instagram metrics — append-only historical log.
--
-- Why append-only:
--   Each row is a snapshot of @username's metrics at fetched_at. We
--   never UPDATE existing rows — every Meta Graph API call inserts a
--   new snapshot. This gives us trend data ("creator was at 50k
--   followers 6 months ago, now 80k = growing") without extra work.
--
-- Why latest-view convenience:
--   90% of reads want "the most recent snapshot for handle X." The
--   creator_ig_metrics_latest VIEW handles that without app-side
--   DISTINCT ON queries.
--
-- Privacy posture (legal context — see CLAUDE.md):
--   This is internal-use cache for Dylan's authenticated users.
--   Data sourced from Meta's Business Discovery API (per their ToS,
--   only usable to provide the user-facing service — we honor that).
--   Not exposed externally, not sold. If commercialization is ever
--   pursued, raw_response_json + source field provide an audit trail.

CREATE TABLE IF NOT EXISTS public.creator_ig_metrics (
  id              BIGSERIAL PRIMARY KEY,
  -- Lowercased IG handle (no @, no URL). Natural key for the creator.
  ig_username     TEXT NOT NULL,
  -- Optional: link back to the source creator if we know the YouTube
  -- channel (most enrichment paths come through YouTube discovery).
  yt_channel_id   TEXT,
  -- Numeric snapshot fields.
  followers       BIGINT NOT NULL,
  follows         BIGINT NOT NULL DEFAULT 0,
  media_count     BIGINT NOT NULL DEFAULT 0,
  -- Computed engagement-rate proxy (avg(likes+comments)/followers over
  -- the most recent 12 posts). Stored to avoid recomputing on read.
  engagement_rate NUMERIC(8, 6) NOT NULL DEFAULT 0,
  avg_likes_per_post NUMERIC(12, 2) NOT NULL DEFAULT 0,
  -- String fields — bio, name, profile photo, link.
  biography       TEXT NOT NULL DEFAULT '',
  display_name    TEXT NOT NULL DEFAULT '',
  website         TEXT NOT NULL DEFAULT '',
  profile_picture_url TEXT NOT NULL DEFAULT '',
  -- Recent media as JSON for trend/personalization use cases.
  recent_media_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Audit + provenance: raw API response + which source produced it.
  -- 'meta_graph' is the only value today but leaves room for future
  -- providers (Phyllo, Modash, scraped) without a schema change.
  source          TEXT NOT NULL DEFAULT 'meta_graph',
  raw_response_json JSONB,
  -- When we fetched. Defaults to insertion time.
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup index: most reads filter by handle + sort by fetched_at DESC.
CREATE INDEX IF NOT EXISTS idx_creator_ig_metrics_username_fetched
  ON public.creator_ig_metrics (ig_username, fetched_at DESC);

-- Optional: index on yt_channel_id for "find IG metrics for this YT
-- channel" queries.
CREATE INDEX IF NOT EXISTS idx_creator_ig_metrics_yt_channel
  ON public.creator_ig_metrics (yt_channel_id)
  WHERE yt_channel_id IS NOT NULL;

-- Convenience view: latest snapshot per handle.
CREATE OR REPLACE VIEW public.creator_ig_metrics_latest AS
SELECT DISTINCT ON (ig_username) *
FROM public.creator_ig_metrics
ORDER BY ig_username, fetched_at DESC;

-- RLS: this is shared internal data (cache), readable by any
-- authenticated user since the cost of fetching it is borne by us.
-- Inserts/updates restricted to service role (only the worker route
-- using SUPABASE_SERVICE_ROLE_KEY can write).
ALTER TABLE public.creator_ig_metrics ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can READ the cache.
CREATE POLICY "creator_ig_metrics_read_authenticated"
  ON public.creator_ig_metrics
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for authenticated → only service role
-- (which bypasses RLS) can write. This prevents user clients from
-- forging snapshots.

-- Same view-level access posture.
GRANT SELECT ON public.creator_ig_metrics_latest TO authenticated;
