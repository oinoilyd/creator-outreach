-- 0029_active_clients_expansion.sql
--
-- "Big build" expansion of the Active Clients surface — per Dylan
-- 2026-05-19. Builds on 0028 (which added budget/timeline/scope/
-- contract-url/notes columns) with the engagement-management depth
-- the v1 was missing:
--
--   • Lifecycle states (active / paused / completed / churned) so
--     the user can move a deal through its arc without losing it.
--     status='Successful' continues to gate visibility in the tab,
--     but the lifecycle drives the workflow inside the tab.
--   • Milestones — an editable checklist per engagement (kickoff,
--     brief, deliverable, invoice…). Stored as JSONB so we don't
--     need a separate table.
--   • Activity log — append-only timeline of state changes for
--     accountability + history. Also JSONB.
--   • Contract file upload — Supabase Storage path + filename +
--     size + uploaded-at, so the user can upload a PDF instead of
--     only linking an external URL. The existing client_contract_url
--     stays for users who prefer Drive/Notion links.
--
-- All columns nullable. Old rows pre-dating 0029 render cleanly
-- (lifecycle defaults to 'active' for backward compat).
--
-- A separate STORAGE BUCKET `contracts` is also created — RLS scoped
-- by the user_id prefix in the object path. The app uploads to
-- `<user_id>/<entry_id>/<filename>` so the policy "user can only see
-- their own folder" works with simple prefix matching.

-- ── Columns ────────────────────────────────────────────────────────

ALTER TABLE public.outreach_entries
  ADD COLUMN IF NOT EXISTS client_lifecycle           TEXT,
  ADD COLUMN IF NOT EXISTS client_milestones          JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS client_activity            JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS client_contract_path       TEXT,
  ADD COLUMN IF NOT EXISTS client_contract_name       TEXT,
  ADD COLUMN IF NOT EXISTS client_contract_size       INTEGER,
  ADD COLUMN IF NOT EXISTS client_contract_uploaded_at TIMESTAMPTZ;

-- Constrain lifecycle to known values. Nullable so old rows + new
-- rows that haven't been touched yet behave the same (treated as
-- 'active' by the app).
ALTER TABLE public.outreach_entries
  DROP CONSTRAINT IF EXISTS outreach_entries_client_lifecycle_chk;
ALTER TABLE public.outreach_entries
  ADD CONSTRAINT outreach_entries_client_lifecycle_chk
  CHECK (client_lifecycle IS NULL OR client_lifecycle IN ('active', 'paused', 'completed', 'churned'));

COMMENT ON COLUMN public.outreach_entries.client_lifecycle IS
  'Engagement lifecycle state. NULL or "active" = currently delivering. "paused" = on hold. "completed" = wrapped successfully. "churned" = ended early / didn''t renew. Drives filter pills + card chips in the Active Clients tab.';

COMMENT ON COLUMN public.outreach_entries.client_milestones IS
  'Per-engagement checklist. Array of { id, label, dueDate, completedAt, completed }. JSONB so we can iterate the shape without a schema migration.';

COMMENT ON COLUMN public.outreach_entries.client_activity IS
  'Append-only timeline of state changes. Array of { ts, type, summary }. Auto-logged by the app on lifecycle / budget / contract changes.';

COMMENT ON COLUMN public.outreach_entries.client_contract_path IS
  'Supabase Storage object path for the uploaded contract PDF. Format: <user_id>/<entry_id>/<filename>. NULL = user hasn''t uploaded; they may still have an external client_contract_url.';

COMMENT ON COLUMN public.outreach_entries.client_contract_name IS
  'Original filename of the uploaded contract (display only — the storage path uses a slugged version).';

COMMENT ON COLUMN public.outreach_entries.client_contract_size IS
  'Size in bytes of the uploaded contract — surfaced as "1.2 MB" in the UI.';

COMMENT ON COLUMN public.outreach_entries.client_contract_uploaded_at IS
  'When the contract file was uploaded. NULL if not uploaded.';

-- ── Storage bucket + policies ──────────────────────────────────────
-- The `contracts` bucket holds uploaded PDFs (or other engagement
-- docs). Private — never publicly readable. RLS policies match
-- against the FIRST path segment being the user's UID.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  20 * 1024 * 1024,  -- 20 MB cap per file
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop any prior versions of the policies (idempotent re-run).
DROP POLICY IF EXISTS "contracts_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "contracts_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "contracts_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "contracts_owner_delete" ON storage.objects;

CREATE POLICY "contracts_owner_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "contracts_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "contracts_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "contracts_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
