-- Grant the service_role explicit table permissions on the
-- creator_enrichment cache.
--
-- Why this needs its own migration:
--   The 0011 migration scoped its GRANTs to the "authenticated"
--   role. In newer Supabase projects the service_role doesn't get
--   implicit table grants — it has to be granted explicitly. The
--   /api/enrich worker writes via the service_role JWT, so without
--   these grants every INSERT silently 403'd ("permission denied
--   for table creator_enrichment") and the cache stayed empty
--   forever.
--
-- Discovery posture:
--   Caught 2026-05-09 by curl-probing the Supabase REST API with
--   the service_role JWT after the L2 hit count refused to climb
--   past zero. The JWT auth was fine; the Postgres-level grant
--   was missing.

GRANT SELECT, INSERT ON public.creator_enrichment TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.creator_enrichment_id_seq TO service_role;
GRANT SELECT ON public.creator_enrichment_latest TO service_role;
