/**
 * Server-side team context resolver.
 *
 * Given an authenticated user, returns their membership status:
 * individual or in-an-org-with-a-role. Used by API routes that need
 * to make role-based decisions (Can this user invite? Can they assign?).
 *
 * Why split this from lib/team.ts? team.ts is pure data + permission
 * predicates that can run in the browser bundle. team-context.ts pulls
 * from Supabase via the service-role client and is server-only.
 */

import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Organization, OrganizationMember, OrganizationRole, TeamContext } from './team'

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

interface MemberRow {
  id: string
  organization_id: string
  user_id: string
  role: OrganizationRole
  invited_by: string | null
  invited_at: string | null
  joined_at: string
}

interface OrgRow {
  id: string
  name: string
  slug: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null
  subscription_current_period_end: string | null
  seats_provisioned: number
  unlimited_exports: boolean
  created_at: string
  updated_at: string
}

function mapMember(row: MemberRow): OrganizationMember {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    invitedBy: row.invited_by,
    invitedAt: row.invited_at,
    joinedAt: row.joined_at,
  }
}

function mapOrg(row: OrgRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    subscriptionStatus: row.subscription_status,
    subscriptionCurrentPeriodEnd: row.subscription_current_period_end,
    seatsProvisioned: row.seats_provisioned,
    unlimitedExports: row.unlimited_exports,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Resolve the user's team context. Returns mode='individual' if the
 * user isn't in any org. Defaults to mode='individual' on any error
 * (safe fallback — they keep using the app like they always did).
 */
export async function getTeamContextForUser(userId: string): Promise<TeamContext> {
  const sb = getServiceClient()
  if (!sb) {
    return { mode: 'individual', organization: null, role: null }
  }

  // Migration-tolerant: organization_members may not exist yet if 0035
  // hasn't been applied. Treat any error as "individual user."
  const { data: memberRow, error: memberErr } = await sb
    .from('organization_members')
    .select('id, organization_id, user_id, role, invited_by, invited_at, joined_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (memberErr || !memberRow) {
    return { mode: 'individual', organization: null, role: null }
  }

  const member = mapMember(memberRow as MemberRow)

  const { data: orgRow, error: orgErr } = await sb
    .from('organizations')
    .select('*')
    .eq('id', member.organizationId)
    .maybeSingle()

  if (orgErr || !orgRow) {
    // Membership row exists but org doesn't — corrupt state. Fall back
    // to individual mode rather than crash the page.
    console.warn('[team-context] membership without org', { userId, orgId: member.organizationId })
    return { mode: 'individual', organization: null, role: null }
  }

  return {
    mode: 'team',
    organization: mapOrg(orgRow as OrgRow),
    role: member.role,
  }
}

/**
 * Resolve the team context for a user via a Supabase server client
 * (already-authenticated request).
 *
 * Convenience wrapper around getTeamContextForUser when you already
 * have the user object from supabase.auth.getUser().
 */
export async function getTeamContext(user: { id: string } | null): Promise<TeamContext> {
  if (!user) return { mode: 'individual', organization: null, role: null }
  return getTeamContextForUser(user.id)
}
