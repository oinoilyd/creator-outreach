/**
 * POST /api/admin/seed-test-org — create a test org with 3 fixture
 * users (Owner / Admin / Member) for manual end-to-end testing of
 * the team flow. Admin-only.
 *
 * Idempotent: re-running deletes any prior test org named "Test
 * Team (seed)" and rebuilds fresh fixtures.
 *
 * Fixture emails (fixed so admin can sign in as each via password reset):
 *   • test-owner@creatoroutreach.net
 *   • test-admin@creatoroutreach.net
 *   • test-member@creatoroutreach.net
 *
 * Passwords are randomly generated and returned in the response —
 * Dylan copies them somewhere safe (or uses the magic-link auth flow
 * to sign in as each fixture).
 *
 * NOT FOR PRODUCTION USE. This endpoint creates real auth.users rows
 * via the Supabase Admin API. Guarded by admin email check + a small
 * additional confirmation header that has to be present.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { OrganizationRole } from '@/lib/team'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

const FIXTURE_USERS: Array<{ email: string; role: OrganizationRole; fullName: string }> = [
  { email: 'test-owner@creatoroutreach.net',  role: 'owner',  fullName: 'Test Owner' },
  { email: 'test-admin@creatoroutreach.net',  role: 'admin',  fullName: 'Test Admin' },
  { email: 'test-member@creatoroutreach.net', role: 'member', fullName: 'Test Member' },
]

const FIXTURE_ORG_NAME = 'Test Team (seed)'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function generatePassword(): string {
  // 24 chars of base64url-safe entropy — strong enough that fixture
  // accounts can't be brute-forced.
  return randomBytes(18).toString('base64url')
}

export async function POST(req: NextRequest) {
  // Auth: admin email only. 404 to non-admins.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Extra friction: require a confirmation header so this can't be
  // hit accidentally via curl on a sleepy day.
  if (req.headers.get('x-confirm-seed') !== 'yes-rebuild-test-team') {
    return NextResponse.json({
      error: 'confirmation header required',
      hint: 'send x-confirm-seed: yes-rebuild-test-team',
    }, { status: 400 })
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  // STEP 1: Tear down any existing fixture org.
  // Find prior org by name + delete (cascades to members + invitations).
  const { data: existingOrgs } = await sb
    .from('organizations')
    .select('id, stripe_subscription_id')
    .eq('name', FIXTURE_ORG_NAME)

  for (const org of existingOrgs ?? []) {
    // Skip Stripe cancellation — fixture orgs shouldn't have real
    // subscriptions, but log a warning if one slipped through.
    const subId = (org as { stripe_subscription_id: string | null }).stripe_subscription_id
    if (subId) {
      console.warn('[seed-test-org] fixture org has stripe subscription, skipping Stripe cancel', subId)
    }
    // Delete the org — cascades remove members + invitations.
    await sb.from('organizations').delete().eq('id', (org as { id: string }).id)
  }

  // STEP 2: Tear down fixture auth users.
  // We need the Supabase Admin API for this. List users matching our
  // emails, then delete them.
  for (const fixture of FIXTURE_USERS) {
    try {
      // listUsers doesn't take an email filter; we have to paginate.
      // For 3 fixture emails this is cheap.
      const { data: pageData } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
      const match = pageData.users.find(u => u.email?.toLowerCase() === fixture.email.toLowerCase())
      if (match) {
        await sb.auth.admin.deleteUser(match.id)
      }
    } catch (err) {
      console.warn('[seed-test-org] could not check/delete fixture user', fixture.email, err)
    }
  }

  // STEP 3: Create fixture auth users + profiles.
  const created: Array<{ email: string; role: OrganizationRole; userId: string; password: string }> = []
  for (const fixture of FIXTURE_USERS) {
    const password = generatePassword()
    const { data: createdUser, error: createErr } = await sb.auth.admin.createUser({
      email: fixture.email,
      password,
      email_confirm: true, // skip email verification for fixtures
      user_metadata: { full_name: fixture.fullName, fixture: true },
    })
    if (createErr || !createdUser.user) {
      console.error('[seed-test-org] auth user create failed', fixture.email, createErr)
      return NextResponse.json({
        error: 'auth user create failed',
        email: fixture.email,
        detail: createErr?.message,
      }, { status: 500 })
    }
    // Insert user_profile (the on-signup trigger should do this, but
    // it's safer to upsert explicitly here in case the trigger isn't
    // installed in this env).
    await sb
      .from('user_profile')
      .upsert({
        user_id: createdUser.user.id,
        email: fixture.email,
        full_name: fixture.fullName,
      }, { onConflict: 'user_id' })
    created.push({
      email: fixture.email,
      role: fixture.role,
      userId: createdUser.user.id,
      password,
    })
  }

  // STEP 4: Create the org and memberships.
  const { data: orgRow, error: orgErr } = await sb
    .from('organizations')
    .insert({
      name: FIXTURE_ORG_NAME,
      slug: `test-team-${Math.random().toString(36).slice(2, 6)}`,
      // No Stripe billing on fixture orgs — they're for UI testing
      // only. Status 'active' so middleware doesn't lock them out.
      subscription_status: 'active',
      // 100 years out — effectively never expires for fixture purposes.
      subscription_current_period_end: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      unlimited_exports: true, // skip export paywall for fixtures
    })
    .select('id')
    .single()

  if (orgErr || !orgRow) {
    console.error('[seed-test-org] org insert failed', orgErr)
    return NextResponse.json({ error: 'org insert failed', detail: orgErr?.message }, { status: 500 })
  }
  const orgId = (orgRow as { id: string }).id

  for (const fixture of created) {
    await sb.from('organization_members').insert({
      organization_id: orgId,
      user_id: fixture.userId,
      role: fixture.role,
    })
  }

  // STEP 5: Seed a few outreach rows for each member so the team
  // dashboard has data to look at. Owner gets 3, Admin gets 2, Member
  // gets 2 (1 assigned by Admin, 1 self-created).
  const seedRows: Array<{
    user_id: string
    organization_id: string
    created_by_user_id: string
    assigned_to_user_id: string
    channel_id: string
    channel_name: string
    channel_url: string
    id: string
    status: string
    medium: string
    notes: string
  }> = []
  let i = 0
  for (const fixture of created) {
    const count = fixture.role === 'owner' ? 3 : 2
    for (let r = 0; r < count; r++) {
      i++
      seedRows.push({
        user_id: fixture.userId,
        organization_id: orgId,
        created_by_user_id: fixture.userId,
        assigned_to_user_id: fixture.userId,
        channel_id: `seed-${orgId.slice(0, 8)}-${i}`,
        channel_name: `Seed Creator ${i}`,
        channel_url: `https://youtube.com/@seed-creator-${i}`,
        id: `seed-${orgId.slice(0, 8)}-${i}`,
        status: r === 0 ? 'Open' : '',
        medium: 'Email',
        notes: `Seeded for ${fixture.role} role testing.`,
      })
    }
  }
  // One row owned by Owner but assigned to Member — exercises the
  // "Admin assigns to Member" code path.
  const owner = created.find(c => c.role === 'owner')!
  const member = created.find(c => c.role === 'member')!
  seedRows.push({
    user_id: owner.userId,
    organization_id: orgId,
    created_by_user_id: owner.userId,
    assigned_to_user_id: member.userId,
    channel_id: `seed-${orgId.slice(0, 8)}-assigned`,
    channel_name: 'Seed Creator (assigned to Member)',
    channel_url: 'https://youtube.com/@seed-creator-assigned',
    id: `seed-${orgId.slice(0, 8)}-assigned`,
    status: 'Open',
    medium: 'Email',
    notes: 'Owner created, assigned to Member. Tests cross-user assignment visibility.',
  })

  const { error: seedErr } = await sb.from('outreach_entries').insert(seedRows)
  if (seedErr) {
    console.warn('[seed-test-org] seed outreach insert failed', seedErr)
    // Non-fatal — org is created, fixtures exist, just no demo data.
  }

  return NextResponse.json({
    ok: true,
    organization_id: orgId,
    organization_name: FIXTURE_ORG_NAME,
    fixtures: created.map(c => ({ email: c.email, role: c.role, password: c.password })),
    note: 'Password reset works for fixture users too — these passwords are returned ONCE; save them now if you need them.',
  })
}
