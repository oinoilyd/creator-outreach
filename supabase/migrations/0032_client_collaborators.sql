-- 0032_client_collaborators.sql
--
-- Per Dylan 2026-05-21 — many creator deals involve a team (editor,
-- designer, videographer, manager, etc.) who each take a cut of the
-- budget. Active Clients needs a way to track who's on each
-- engagement, their role + contact info, and how much of the budget
-- they earn. The top-line metrics then split "Total Booked" (gross)
-- from "Personal Revenue" (net of collaborator shares).
--
-- Stored as JSONB so we don't need a separate collaborators table
-- with a FK to outreach_entries — at this volume the JSONB approach
-- is simpler and queries cleanly. Each entry in the array is:
--
--   {
--     id: string            // local UUID (crypto.randomUUID)
--     role: string          // "Editor" | "Designer" | custom text
--     name: string
--     email: string         // optional
--     phone: string         // optional
--     share: number         // fixed dollar amount
--   }
--
-- Revenue share is stored as a number representing a fixed dollar
-- value (not a percentage) per Dylan's preference — accommodates
-- flat-fee arrangements like "$500 per video edit" cleanly.

ALTER TABLE public.outreach_entries
  ADD COLUMN IF NOT EXISTS client_collaborators JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.outreach_entries.client_collaborators IS
  'Per-engagement team. Array of { id, role, name, email, phone, share }. share is a fixed dollar amount. Used by the Active Clients view to compute Personal Revenue (gross budget minus sum of shares).';

-- Refresh PostgREST cache so the new column is visible without the
-- 30-60s lag we hit on 0028 + 0029 + 0030.
NOTIFY pgrst, 'reload schema';
