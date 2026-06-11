/**
 * POST /api/admin/make-me-team-owner — put the ADMIN's own account in
 * as Owner of a test team so they can see the full enterprise UI in
 * their normal logged-in session (no magic-link / incognito dance).
 *
 * Body: { action: 'create' | 'teardown' }
 *   • create   — safe-teardown any prior test team, then create a
 *                fresh "My Test Team" (active sub), add the admin as
 *                Owner + 2 member fixtures, seed a few cross-assigned
 *                outreach rows. Returns member login info.
 *   • teardown — restore the admin to an individual account. Nulls
 *                organization_id on every row pointing at the test org
 *                FIRST (so the ON DELETE CASCADE can't take any real
 *                outreach rows), then deletes the org + member fixtures.
 *
 * Admin-only. NOT for production users.
 *
 * DATA SAFETY: the admin's existing individual outreach rows
 * (organization_id IS NULL) are never touched by create. teardown
 * de-orgs any rows stamped with the test org before deleting it, so
 * a real row the admin assigned to a teammate during testing is
 * restored to individual ownership rather than cascade-deleted.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import type { OrganizationRole } from '@/lib/team'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ADMIN_EMAIL = 'dmeehanj@gmail.com'
const TEST_ORG_NAME = 'My Test Team'

// Two member fixtures so the owner has people to manage + assign to.
const MEMBER_FIXTURES: Array<{ email: string; fullName: string }> = [
  { email: 'teammate-a@creatoroutreach.net', fullName: 'Alex Teammate' },
  { email: 'teammate-b@creatoroutreach.net', fullName: 'Bailey Teammate' },
]

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function generatePassword(): string {
  return randomBytes(15).toString('base64url')
}

/**
 * SAFE teardown: de-org outreach rows pointing at the test org BEFORE
 * deleting the org (so cascade can't take real rows), delete the org,
 * then delete the member fixtures. Never touches the admin's account
 * or their individual (org=null) rows.
 */
async function safeTeardown(sb: SupabaseClient): Promise<void> {
  const { data: orgs } = await sb
    .from('organizations')
    .select('id')
    .eq('name', TEST_ORG_NAME)

  for (const org of orgs ?? []) {
    const orgId = (org as { id: string }).id
    // CRITICAL: null out organization_id on every row pointing at this
    // org first. Restores assigned-to to the row's owning user so
    // nothing is orphaned, and — more importantly — protects any of
    // the admin's REAL rows they assigned to a teammate from the
    // ON DELETE CASCADE that fires when we delete the org next.
    const { error: deOrgErr } = await sb
      .from('outreach_entries')
      .update({ organization_id: null })
      .eq('organization_id', orgId)
    if (deOrgErr) {
      console.error('[make-me-team-owner] de-org failed; ABORTING teardown to protect data', deOrgErr.message)
      throw new Error(`de-org failed: ${deOrgErr.message}`)
    }
    // Now safe to delete the org — cascade only removes members +
    // invitations, which is what we want.
    await sb.from('organizations').delete().eq('id', orgId)
  }

  // Delete the member fixtures (NOT the admin). Page through users to
  // find them by email.
  const fixtureEmails = new Set(MEMBER_FIXTURES.map(f => f.email.toLowerCase()))
  for (let page = 1; page <= 5; page++) {
    const { data: pageData } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (!pageData?.users?.length) break
    for (const u of pageData.users) {
      if (u.email && fixtureEmails.has(u.email.toLowerCase())) {
        try { await sb.auth.admin.deleteUser(u.id) } catch { /* best effort */ }
      }
    }
    if (pageData.users.length < 200) break
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const action = body.action === 'teardown' ? 'teardown' : 'create'

  // Always teardown first (idempotent). For 'teardown' we stop there.
  try {
    await safeTeardown(sb)
  } catch (e) {
    return NextResponse.json({ error: 'teardown failed', detail: (e as Error).message }, { status: 500 })
  }
  if (action === 'teardown') {
    return NextResponse.json({ ok: true, action: 'teardown', message: 'Restored to individual account.' })
  }

  // ----- Create the org with the ADMIN as Owner. -----
  const { data: orgRow, error: orgErr } = await sb
    .from('organizations')
    .insert({ name: TEST_ORG_NAME, slug: `my-test-team-${Math.random().toString(36).slice(2, 8)}` })
    .select('id')
    .single()
  if (orgErr || !orgRow) {
    return NextResponse.json({
      error: 'org insert failed',
      detail: orgErr?.message ?? 'no row',
      hint: 'If it mentions permission/schema, confirm migrations 0035 + 0036 are applied.',
    }, { status: 500 })
  }
  const orgId = (orgRow as { id: string }).id

  // Mark the org as a live subscription so the paywall middleware lets
  // members in (auth_user_org_access RPC reads this). Non-fatal per field.
  for (const [field, value] of Object.entries({
    subscription_status: 'active',
    subscription_current_period_end: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    unlimited_exports: true,
  })) {
    await sb.from('organizations').update({ [field]: value }).eq('id', orgId)
  }

  // Add the ADMIN as Owner (their real user_id).
  const { error: ownerErr } = await sb.from('organization_members').insert({
    organization_id: orgId,
    user_id: user.id,
    role: 'owner' as OrganizationRole,
  })
  if (ownerErr) {
    return NextResponse.json({ error: 'owner membership failed', detail: ownerErr.message, organization_id: orgId }, { status: 500 })
  }

  // Create + add the 2 member fixtures.
  const memberLogins: Array<{ email: string; fullName: string; password: string; userId: string }> = []
  for (const fixture of MEMBER_FIXTURES) {
    const password = generatePassword()
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email: fixture.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fixture.fullName, fixture: true },
    })
    if (createErr || !created?.user) {
      return NextResponse.json({
        error: 'member fixture create failed',
        detail: `${fixture.email}: ${createErr?.message ?? 'no user'}`,
      }, { status: 500 })
    }
    await sb.from('user_profile').upsert(
      { user_id: created.user.id, email: fixture.email, full_name: fixture.fullName },
      { onConflict: 'user_id' },
    )
    await sb.from('organization_members').insert({
      organization_id: orgId,
      user_id: created.user.id,
      role: 'member' as OrganizationRole,
    })
    memberLogins.push({ email: fixture.email, fullName: fixture.fullName, password, userId: created.user.id })
  }

  // Seed a handful of team outreach rows so the board isn't empty —
  // owned by the admin, assigned across the two members. These carry
  // organization_id = orgId, so teardown's de-org step handles them.
  const now = Date.now()
  const seedRows = [
    { name: 'Acme Creator', assignee: memberLogins[0], status: 'Open' },
    { name: 'Beta Channel', assignee: memberLogins[1], status: 'No Response' },
    { name: 'Gamma Media', assignee: memberLogins[0], status: 'Successful' },
    { name: 'Delta Studios', assignee: memberLogins[1], status: 'Not Outreached' },
  ].map((r, i) => ({
    id: `mtt-${orgId.slice(0, 8)}-${i}`,
    user_id: r.assignee.userId,
    organization_id: orgId,
    created_by_user_id: user.id,
    assigned_to_user_id: r.assignee.userId,
    channel_id: `mtt-${orgId.slice(0, 8)}-${i}`,
    channel_name: r.name,
    channel_url: `https://youtube.com/@${r.name.toLowerCase().replace(/\s+/g, '-')}`,
    status: r.status,
    medium: 'Email',
    notes: `[test team] Owner sourced, assigned to ${r.assignee.fullName}.`,
    added_at: now - i * 86400000,
  }))
  await sb.from('outreach_entries').insert(seedRows)

  return NextResponse.json({
    ok: true,
    action: 'create',
    organization_id: orgId,
    organization_name: TEST_ORG_NAME,
    message: 'You are now the Owner of "My Test Team". Refresh the app to see the enterprise UI.',
    members: memberLogins.map(m => ({ email: m.email, fullName: m.fullName, password: m.password })),
  })
}
