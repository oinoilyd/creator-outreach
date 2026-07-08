-- 0054_integrations.sql
--
-- Integrations foundation (hamburger → Integrations panel):
--   • api_keys — per-user platform API keys. External tools (Zapier,
--     Airtable automations, custom dashboards) call /api/v1/* with
--     `Authorization: Bearer co_live_...`. Only a SHA-256 hash is stored;
--     the full key is shown once at creation. key_prefix (first 12 chars)
--     is kept for display. revoked_at soft-revokes.
--   • airtable_connections — outbound push config: the user's Airtable
--     personal access token (AES-256-GCM encrypted, same EMAIL_TOKEN_ENC_KEY
--     as direct email), target base/table, our-field → their-column map,
--     and the merge field used for upserts (no duplicate rows).
--
-- Per project gotchas: user_id is plain UUID (no FK to auth.users), RLS
-- owner policies + EXPLICIT grants to authenticated AND service_role
-- (server routes use the service client).

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'API key',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON public.api_keys(user_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_keys_owner ON public.api_keys;
CREATE POLICY api_keys_owner ON public.api_keys
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.airtable_connections (
  user_id UUID PRIMARY KEY,
  token_encrypted TEXT NOT NULL,
  base_id TEXT NOT NULL,
  base_name TEXT,
  table_name TEXT NOT NULL,
  field_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  merge_field TEXT,
  auto_sync BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.airtable_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS airtable_connections_owner ON public.airtable_connections;
CREATE POLICY airtable_connections_owner ON public.airtable_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airtable_connections TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
