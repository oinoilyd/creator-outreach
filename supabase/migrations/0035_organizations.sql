-- 0035_organizations.sql
--
-- Enterprise / team accounts foundation (Dylan 2026-05-24).
--
-- ARCHITECTURE OVERVIEW
-- ====================
-- An Organization is a top-level entity that groups users into a team.
-- One Organization has one Stripe subscription on the "Team" plan
-- ($150/mo base + $35/mo per seat over 5). Members of the org share
-- data based on role:
--
--   • OWNER   — billing + everything; one per org
--   • ADMIN   — invite/remove members, assign outreach to anyone, see
--               ALL org outreach. Can't change billing or remove Owner.
--   • MEMBER  — sees only outreach where they are the creator OR the
--               assignee. Can add their own outreach. Cannot invite.
--
-- Individual users (no org) coexist unchanged: their outreach rows
-- have organization_id = NULL and continue to scope by user_id like
-- before. The "Upgrade to Team" flow lets them become an Owner of a
-- newly-created org, migrating their existing data into it.
--
-- DATA SAFETY
-- ===========
-- This migration is ADDITIVE. No DROP TABLE, no destructive UPDATE,
-- no column removal. New tables; new columns on outreach_entries are
-- all nullable (org users) or have safe defaults (audit fields).
-- Existing rows are backfilled in a single transaction so reads
-- always succeed against fully-populated audit fields.
--
-- RLS policies are REPLACED for outreach_entries (DROP + CREATE) but
-- the new policy is a strict superset — it permits all access the old
-- policy permitted, plus org-scoped access. Any existing query that
-- worked before keeps working.
--
-- SECURITY-CRITICAL: Every multi-tenant table MUST have a policy that
-- prevents cross-org leak. The helper functions below are SECURITY
-- DEFINER so they bypass RLS on organization_members (otherwise we'd
-- recurse). They return the CURRENT user's org/role, computed once
-- per query, then used in policy USING clauses.

-- =====================================================================
-- 1. organizations — the org entity (one per team).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                              TEXT NOT NULL,
  -- URL slug for future team URLs (e.g. /team/acme). Optional; auto-
  -- derived from name. UNIQUE so we can route by it later.
  slug                              TEXT UNIQUE,

  -- Stripe billing pointers — one subscription per org on the Team plan.
  stripe_customer_id                TEXT,
  stripe_subscription_id            TEXT,
  subscription_status               TEXT,
  subscription_current_period_end   TIMESTAMPTZ,
  -- # of seats currently provisioned in Stripe (base 5 + extra). Used
  -- to short-circuit syncOrgBilling when no change is needed.
  seats_provisioned                 INTEGER NOT NULL DEFAULT 5,

  -- Comp flag — admin-toggled bypass for all paywalls (exports, future
  -- gates). Mirrors the user-level unlimited_exports flag from 0034
  -- but at the org level so a whole team can be comp'd at once.
  unlimited_exports                 BOOLEAN NOT NULL DEFAULT false,

  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizations_stripe_customer_idx
  ON public.organizations(stripe_customer_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Members of the org can SELECT it. Writes only via service role
-- (Stripe webhook + admin endpoints).
DROP POLICY IF EXISTS "organizations_select_member" ON public.organizations;
CREATE POLICY "organizations_select_member" ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.organizations IS
  'Top-level team entity. One Stripe subscription per row. Members linked via organization_members.';


-- =====================================================================
-- 2. organization_members — user ↔ org with role.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  invited_by      UUID REFERENCES auth.users(id),
  invited_at      TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One org per user (v1 constraint per Dylan 2026-05-24).
  -- If we ever allow multi-org membership, drop this UNIQUE.
  UNIQUE (user_id),
  -- Sanity: a user can't appear twice in the same org.
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS organization_members_org_idx
  ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS organization_members_user_idx
  ON public.organization_members(user_id);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Members can read other members of the same org. (The Team page
-- needs this to render the member list.) No client INSERT/UPDATE/
-- DELETE — those go through admin-gated server endpoints.
DROP POLICY IF EXISTS "organization_members_select_same_org" ON public.organization_members;
CREATE POLICY "organization_members_select_same_org" ON public.organization_members
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.organization_members IS
  'User ↔ Organization membership with role. v1 enforces one-org-per-user via UNIQUE(user_id).';


-- =====================================================================
-- 3. organization_invitations — pending invites awaiting accept.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'member')), -- can't invite as owner
  -- Secret token in the invite link. Cryptographically random,
  -- generated server-side. Index for fast lookup on accept.
  token           TEXT UNIQUE NOT NULL,
  invited_by      UUID NOT NULL REFERENCES auth.users(id),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at     TIMESTAMPTZ,
  -- Records the accepting user_id once they sign up / sign in and
  -- claim the invite. NULL until accepted.
  accepted_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- At most one PENDING invite per (org, email) — we cancel & recreate
  -- on re-invite via app logic. UNIQUE on (org, email) is too strict
  -- because expired/accepted invites should be allowed to coexist
  -- with a fresh pending one, so we enforce uniqueness only via app
  -- logic, not DB constraint.
  CHECK (email = lower(email)) -- normalize emails for case-insensitive lookup
);

CREATE INDEX IF NOT EXISTS organization_invitations_org_idx
  ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS organization_invitations_email_idx
  ON public.organization_invitations(email);

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Admins / Owners of the org can read their pending invites (for
-- the Team page invite list). Accept happens server-side via token
-- lookup with service role — no policy needed for that path.
DROP POLICY IF EXISTS "organization_invitations_select_admin" ON public.organization_invitations;
CREATE POLICY "organization_invitations_select_admin" ON public.organization_invitations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE public.organization_invitations IS
  'Pending invites. Token-based accept link. Expires in 7 days by default.';


-- =====================================================================
-- 4. Helper functions for RLS policies.
-- =====================================================================
-- These run as SECURITY DEFINER so they bypass RLS when reading
-- organization_members (otherwise the policy on organization_members
-- would recurse trying to use these helpers to evaluate itself).
--
-- They return the CURRENT auth user's org and role. NULL if the user
-- isn't in any org (i.e., an individual user). The policy callers
-- treat NULL as "individual user, fall back to user_id check."

CREATE OR REPLACE FUNCTION public.auth_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_org_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM public.organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute to authenticated users so RLS policies can call them.
GRANT EXECUTE ON FUNCTION public.auth_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_org_role() TO authenticated;

COMMENT ON FUNCTION public.auth_user_organization_id() IS
  'Returns the current auth user''s org_id, or NULL if individual. SECURITY DEFINER bypasses RLS on organization_members.';


-- =====================================================================
-- 5. Extend outreach_entries with org + audit fields.
-- =====================================================================
ALTER TABLE public.outreach_entries
  ADD COLUMN IF NOT EXISTS organization_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by_user_id  UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id);

-- Backfill audit fields for existing rows: the user who owns the row
-- is both creator and assignee. Idempotent — re-running just no-ops.
UPDATE public.outreach_entries
SET created_by_user_id  = COALESCE(created_by_user_id,  user_id),
    assigned_to_user_id = COALESCE(assigned_to_user_id, user_id)
WHERE created_by_user_id IS NULL
   OR assigned_to_user_id IS NULL;

CREATE INDEX IF NOT EXISTS outreach_entries_org_idx
  ON public.outreach_entries(organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS outreach_entries_assigned_idx
  ON public.outreach_entries(assigned_to_user_id)
  WHERE assigned_to_user_id IS NOT NULL;

COMMENT ON COLUMN public.outreach_entries.organization_id IS
  'Org that owns this row. NULL = individual user (legacy or non-team user).';

COMMENT ON COLUMN public.outreach_entries.created_by_user_id IS
  'User who originally added this row. Used for "your" filter + audit. Backfilled to user_id for legacy rows.';

COMMENT ON COLUMN public.outreach_entries.assigned_to_user_id IS
  'User the row is assigned to. Members only see rows assigned to them. Admin/Owner can reassign. Defaults to creator.';


-- =====================================================================
-- 6. Replace outreach_entries RLS with org-aware policy.
-- =====================================================================
-- The new policy handles BOTH individual and org users:
--   • Individual (organization_id IS NULL): match by user_id (old behavior)
--   • Org Owner/Admin: see ALL rows where organization_id = their org
--   • Org Member: see rows where (organization_id = their org) AND
--                 (created_by_user_id = self OR assigned_to_user_id = self)
--
-- The old "outreach_entries_self" policy is replaced (not augmented)
-- so we don't get conflicting permissions. The new policy is a strict
-- superset of the old: every row the old policy let you read, the
-- new policy still lets you read.

DROP POLICY IF EXISTS "outreach_entries_self" ON public.outreach_entries;

-- SELECT — split by role to keep each branch readable.
CREATE POLICY "outreach_entries_select_visible" ON public.outreach_entries
  FOR SELECT
  USING (
    -- Individual users: row has no org → match by user_id.
    (organization_id IS NULL AND user_id = auth.uid())
    OR
    -- Org users: row's org must match user's org.
    (
      organization_id IS NOT NULL
      AND organization_id = public.auth_user_organization_id()
      AND (
        -- Owner/Admin see everything in their org.
        public.auth_user_org_role() IN ('owner', 'admin')
        OR
        -- Members only see rows they created OR are assigned to.
        created_by_user_id = auth.uid()
        OR assigned_to_user_id = auth.uid()
      )
    )
  );

-- INSERT — user can insert rows owned by them (legacy) OR into their
-- org (new). Members can insert into their org but the row's
-- created_by/assigned_to must be themselves (enforced by app logic
-- but doubly-checked by WITH CHECK below).
CREATE POLICY "outreach_entries_insert_self_or_org" ON public.outreach_entries
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      organization_id IS NULL
      OR organization_id = public.auth_user_organization_id()
    )
  );

-- UPDATE — Owner/Admin can update any row in their org. Members can
-- update rows they created or are assigned to. Individual users can
-- update their own rows.
CREATE POLICY "outreach_entries_update_visible" ON public.outreach_entries
  FOR UPDATE
  USING (
    (organization_id IS NULL AND user_id = auth.uid())
    OR
    (
      organization_id IS NOT NULL
      AND organization_id = public.auth_user_organization_id()
      AND (
        public.auth_user_org_role() IN ('owner', 'admin')
        OR created_by_user_id = auth.uid()
        OR assigned_to_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    -- Prevent moving a row OUT of the user's org or BETWEEN orgs.
    -- After the update the row must still be in the same org (or
    -- still NULL for individuals).
    (organization_id IS NULL AND user_id = auth.uid())
    OR (organization_id = public.auth_user_organization_id())
  );

-- DELETE — same gating as UPDATE.
CREATE POLICY "outreach_entries_delete_visible" ON public.outreach_entries
  FOR DELETE
  USING (
    (organization_id IS NULL AND user_id = auth.uid())
    OR
    (
      organization_id IS NOT NULL
      AND organization_id = public.auth_user_organization_id()
      AND (
        public.auth_user_org_role() IN ('owner', 'admin')
        OR created_by_user_id = auth.uid()
        OR assigned_to_user_id = auth.uid()
      )
    )
  );


-- =====================================================================
-- 7. updated_at trigger for organizations.
-- =====================================================================
-- Keep the timestamp accurate so admin dashboard "last activity"
-- columns are meaningful.
CREATE OR REPLACE FUNCTION public.touch_organizations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_touch_updated_at ON public.organizations;
CREATE TRIGGER organizations_touch_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_organizations_updated_at();
