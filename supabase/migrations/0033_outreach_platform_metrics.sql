-- 0033_outreach_platform_metrics.sql
--
-- Add platform-specific metric columns to outreach_entries so the
-- per-platform Outreach view can surface X / TikTok creator metrics
-- the same way YouTube currently surfaces avg_views + subscribers.
--
-- Context (Dylan 2026-05-23): the Outreach tab was hardcoded to a
-- YouTube-centric column set. Users searching on Instagram / X /
-- TikTok / LinkedIn would add creators to outreach but the table
-- still showed YT-flavored columns. The fix: per-platform column
-- configs + new platform-specific metric columns that auto-show
-- when their platform is the active context. This migration adds
-- the data backing for X + TikTok metrics. Scraping pipelines to
-- populate these columns come in a follow-up commit; until then
-- they default to NULL and the UI renders an em-dash.
--
-- All columns are nullable + default NULL — additive only, no
-- existing-data risk. Safe to run on production without backups.

ALTER TABLE public.outreach_entries
  -- X (Twitter) — follower count + recent post count. BIGINT
  -- because while individual accounts cap in the hundreds of
  -- millions, the type is consistent with subscribers + IG
  -- followers patterns elsewhere.
  ADD COLUMN IF NOT EXISTS x_followers BIGINT,
  ADD COLUMN IF NOT EXISTS x_posts INTEGER,
  -- TikTok — follower count + total likes (TikTok's primary
  -- engagement metric, often more useful than post count for
  -- gauging reach).
  ADD COLUMN IF NOT EXISTS tiktok_followers BIGINT,
  ADD COLUMN IF NOT EXISTS tiktok_likes BIGINT;

-- Refresh PostgREST cache so the new columns are visible to the
-- API immediately. Without this, the client gets a stale schema
-- and the new fields appear as 'undefined' in queries until the
-- next natural cache refresh (~5 min).
NOTIFY pgrst, 'reload schema';
