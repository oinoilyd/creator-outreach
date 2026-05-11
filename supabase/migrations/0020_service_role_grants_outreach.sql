-- 0020_service_role_grants_outreach.sql
--
-- Grant service_role explicit permissions on the tables the Unipile
-- webhook + auto-followup cron need to read/write.
--
-- Why this needs its own migration:
--   Same root cause as 0012 (creator_enrichment). Newer Supabase
--   projects don't grant service_role implicit table privileges —
--   they have to be granted explicitly. Migrations 0017–0019 added
--   columns to user_profile and outreach_entries but didn't grant
--   service_role access, so the auto-followup cron (running with a
--   service_role JWT) gets:
--       permission denied for table outreach_entries
--       code 42501
--   ...whenever it tries to query candidates.
--
-- The webhook handler hits the same wall when it tries to read or
-- update outreach_entries on a reply/open event.
--
-- Discovery posture:
--   Caught 2026-05-10 by curl-probing /api/cron/send-followups with
--   the new CRON_SECRET Bearer auth. Auth passed, query returned the
--   permission-denied error; surfaced via the diagnostic patch from
--   the same audit pass.
--
-- Both user_profile and outreach_entries need full read/write so the
-- webhook can update reply status + the cron can claim candidates +
-- stamp last_auto_followup_at + insert audit notes.

GRANT SELECT, INSERT, UPDATE ON public.outreach_entries TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_profile     TO service_role;

-- If sequences exist on these tables (for serial id columns), service_role
-- needs them too. NOT a no-op even when sequences are absent — the GRANT
-- with no matching object just silently succeeds.
DO $$
DECLARE
  seq_name text;
BEGIN
  FOR seq_name IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
      AND (sequence_name LIKE 'outreach_entries_%' OR sequence_name LIKE 'user_profile_%')
  LOOP
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.%I TO service_role', seq_name);
  END LOOP;
END $$;
