/**
 * POST /api/admin/seed-test-org — create a sandbox Organization with
 * 5 fixture users (1 Owner / 1 Admin / 3 Members) for manual E2E
 * testing of the team flow. Admin-only.
 *
 * GET — return the CURRENT state of the sandbox (members + fresh
 * magic links) without rebuilding. Lets /admin/sandbox load existing
 * fixtures + regenerate magic links without nuking the team.
 *
 * Idempotent (POST): deletes any prior sandbox org + fixture users
 * first, then recreates from scratch.
 *
 * Returns magic-link URLs for each fixture (via Supabase Admin API)
 * so the admin can open each role in an incognito window for
 * parallel multi-role testing. Plus passwords as a fallback if magic
 * links fail to deliver / expire.
 *
 * NOT FOR PRODUCTION USE. Guarded by admin email + a confirmation
 * header so it can't be triggered accidentally via curl.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import type { OrganizationRole } from '@/lib/team'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

/**
 * 5 fixture users. 1 Owner / 1 Admin / 3 Members. Fixed emails so
 * the magic-link URLs can be regenerated on demand from /admin/sandbox
 * without rebuilding the whole org.
 */
const FIXTURE_USERS: Array<{ email: string; role: OrganizationRole; fullName: string }> = [
  { email: 'test-owner@creatoroutreach.net',   role: 'owner',  fullName: 'Test Owner' },
  { email: 'test-admin@creatoroutreach.net',   role: 'admin',  fullName: 'Test Admin' },
  { email: 'test-member1@creatoroutreach.net', role: 'member', fullName: 'Sarah Member' },
  { email: 'test-member2@creatoroutreach.net', role: 'member', fullName: 'Marcus Member' },
  { email: 'test-member3@creatoroutreach.net', role: 'member', fullName: 'Jenna Member' },
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
  return randomBytes(18).toString('base64url')
}

/** Read the request origin so magic links land back on the right host. */
function originFromReq(req: NextRequest): string {
  return (
    req.headers.get('origin') ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  )
}

/**
 * Generate a single-use magic link that signs the user in as the
 * fixture and redirects them to `/`. Each call returns a fresh link
 * (Supabase magic links are short-lived).
 *
 * Returns null if generation fails — the UI falls back to showing
 * the email + password.
 */
async function generateMagicLink(
  sb: SupabaseClient,
  email: string,
  redirectOrigin: string,
): Promise<string | null> {
  try {
    const { data, error } = await sb.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${redirectOrigin}/` },
    })
    if (error) {
      console.warn('[seed-test-org] generateLink failed', email, error.message)
      return null
    }
    const link = data?.properties?.action_link
    return typeof link === 'string' ? link : null
  } catch (err) {
    console.warn('[seed-test-org] generateLink threw', email, err)
    return null
  }
}

// --------------------------------------------------------------------
// GET — return CURRENT sandbox state (no rebuild).
// --------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  // Find the sandbox org by name.
  const { data: orgRow } = await sb
    .from('organizations')
    .select('id, name')
    .eq('name', FIXTURE_ORG_NAME)
    .maybeSingle()
  if (!orgRow) {
    return NextResponse.json({ exists: false })
  }

  // List members + fresh magic links.
  const origin = originFromReq(req)
  const fixtures: Array<{
    email: string
    role: OrganizationRole
    fullName: string
    magicLink: string | null
  }> = []

  for (const fixture of FIXTURE_USERS) {
    const magicLink = await generateMagicLink(sb, fixture.email, origin)
    fixtures.push({
      email: fixture.email,
      role: fixture.role,
      fullName: fixture.fullName,
      magicLink,
    })
  }

  return NextResponse.json({
    exists: true,
    organization_id: (orgRow as { id: string }).id,
    organization_name: (orgRow as { name: string }).name,
    fixtures,
  })
}

// --------------------------------------------------------------------
// POST — rebuild sandbox from scratch.
// --------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  if (req.headers.get('x-confirm-seed') !== 'yes-rebuild-test-team') {
    return NextResponse.json({
      error: 'confirmation header required',
      hint: 'send x-confirm-seed: yes-rebuild-test-team',
    }, { status: 400 })
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  // ----- STEP 1: Tear down any existing fixture org. -----
  const { data: existingOrgs, error: listOrgErr } = await sb
    .from('organizations')
    .select('id, stripe_subscription_id')
    .eq('name', FIXTURE_ORG_NAME)

  if (listOrgErr) {
    // Most likely cause: migration 0035 not applied OR PostgREST
    // schema cache lag. Surface clearly.
    return NextResponse.json({
      error: 'cannot read organizations table',
      detail: listOrgErr.message,
      hint: 'Confirm migration 0035 ran + try `NOTIFY pgrst, \'reload schema\';` in the SQL editor.',
    }, { status: 500 })
  }

  for (const org of existingOrgs ?? []) {
    const orgRec = org as { id: string; stripe_subscription_id: string | null }
    if (orgRec.stripe_subscription_id) {
      console.warn('[seed-test-org] fixture org has stripe subscription, skipping Stripe cancel', orgRec.stripe_subscription_id)
    }
    // Delete the org — cascades remove members + invitations.
    const { error: deleteOrgErr } = await sb
      .from('organizations')
      .delete()
      .eq('id', orgRec.id)
    if (deleteOrgErr) {
      console.error('[seed-test-org] failed to delete prior org', orgRec.id, deleteOrgErr.message)
    }
  }

  // ----- STEP 2: Tear down fixture auth users. -----
  // Page through up to 1000 users (5 pages of 200) so we find fixtures
  // even on busier projects.
  const fixtureEmailsLower = new Set(FIXTURE_USERS.map(f => f.email.toLowerCase()))
  for (let page = 1; page <= 5; page++) {
    try {
      const { data: pageData } = await sb.auth.admin.listUsers({ page, perPage: 200 })
      if (!pageData?.users?.length) break
      const matches = pageData.users.filter(u => u.email && fixtureEmailsLower.has(u.email.toLowerCase()))
      for (const m of matches) {
        try {
          await sb.auth.admin.deleteUser(m.id)
        } catch (err) {
          console.warn('[seed-test-org] could not delete fixture user', m.email, err)
        }
      }
      if (pageData.users.length < 200) break
    } catch (err) {
      console.warn('[seed-test-org] listUsers page failed', page, err)
      break
    }
  }

  // ----- STEP 3: Create fixture auth users + profiles. -----
  const created: Array<{
    email: string
    role: OrganizationRole
    fullName: string
    userId: string
    password: string
  }> = []

  for (const fixture of FIXTURE_USERS) {
    const password = generatePassword()
    const { data: createdUser, error: createErr } = await sb.auth.admin.createUser({
      email: fixture.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fixture.fullName, fixture: true },
    })
    if (createErr || !createdUser?.user) {
      return NextResponse.json({
        error: 'auth user create failed',
        detail: `${fixture.email}: ${createErr?.message ?? 'no user returned'}`,
        hint: 'A prior fixture user may still exist with this email; cleanup pagination may have missed it.',
      }, { status: 500 })
    }
    // Insert user_profile (upsert in case the on-signup trigger
    // already created a row).
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
      fullName: fixture.fullName,
      userId: createdUser.user.id,
      password,
    })
  }

  // ----- STEP 4: Create the org (DEFENSIVE INSERT). -----
  // First try with a minimal payload — only the absolutely required
  // fields. If that succeeds, enrich with optional fields via UPDATE.
  // This isolates any schema-cache lag on individual columns.
  const orgInsertPayload = {
    name: FIXTURE_ORG_NAME,
    slug: `test-team-${Math.random().toString(36).slice(2, 8)}`,
  }
  const { data: orgRow, error: orgErr } = await sb
    .from('organizations')
    .insert(orgInsertPayload)
    .select('id')
    .single()

  if (orgErr || !orgRow) {
    // Detailed diagnostics so we know exactly what's broken.
    const code = (orgErr as { code?: string } | null)?.code
    const hint = (orgErr as { hint?: string } | null)?.hint
    return NextResponse.json({
      error: 'org insert failed',
      detail: orgErr
        ? `${orgErr.message}${code ? ` (code: ${code})` : ''}`
        : 'insert returned no row',
      hint: hint ?? 'If error mentions schema cache, run `NOTIFY pgrst, \'reload schema\';` in the Supabase SQL editor.',
    }, { status: 500 })
  }
  const orgId = (orgRow as { id: string }).id

  // ----- STEP 4b: Enrich with optional fields (non-fatal). -----
  // Each UPDATE is independent — if one column has schema cache lag
  // or some other issue, the org still exists; we just lose that
  // particular setting.
  const enrichUpdates: Array<{ field: string; value: unknown }> = [
    { field: 'subscription_status', value: 'active' },
    { field: 'subscription_current_period_end', value: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { field: 'unlimited_exports', value: true },
  ]
  const enrichErrors: string[] = []
  for (const u of enrichUpdates) {
    const { error: updateErr } = await sb
      .from('organizations')
      .update({ [u.field]: u.value })
      .eq('id', orgId)
    if (updateErr) {
      enrichErrors.push(`${u.field}: ${updateErr.message}`)
      console.warn('[seed-test-org] enrich update failed', u.field, updateErr.message)
    }
  }

  // ----- STEP 5: Create memberships. -----
  for (const fixture of created) {
    const { error: membershipErr } = await sb.from('organization_members').insert({
      organization_id: orgId,
      user_id: fixture.userId,
      role: fixture.role,
    })
    if (membershipErr) {
      return NextResponse.json({
        error: 'membership create failed',
        detail: `${fixture.email}: ${membershipErr.message}`,
        organization_id: orgId,
      }, { status: 500 })
    }
  }

  // ----- STEP 6: Seed outreach rows for each member. -----
  // Owner gets 3, Admin gets 2, each Member gets 2.
  // Plus one cross-role row: Owner-created, Member-assigned.
  const seedRows: Array<Record<string, unknown>> = []
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
        channel_name: `Seed Creator ${i} (${fixture.fullName})`,
        channel_url: `https://youtube.com/@seed-creator-${i}`,
        id: `seed-${orgId.slice(0, 8)}-${i}`,
        status: r === 0 ? 'Open' : '',
        medium: 'Email',
        notes: `Seeded for ${fixture.role} role testing.`,
      })
    }
  }
  const owner = created.find(c => c.role === 'owner')!
  const firstMember = created.find(c => c.role === 'member')!
  seedRows.push({
    user_id: owner.userId,
    organization_id: orgId,
    created_by_user_id: owner.userId,
    assigned_to_user_id: firstMember.userId,
    channel_id: `seed-${orgId.slice(0, 8)}-assigned`,
    channel_name: 'Cross-assigned: Owner→Member',
    channel_url: 'https://youtube.com/@seed-cross-assigned',
    id: `seed-${orgId.slice(0, 8)}-assigned`,
    status: 'Open',
    medium: 'Email',
    notes: `Owner created, assigned to ${firstMember.fullName}. Tests cross-user assignment visibility.`,
  })

  const { error: seedErr } = await sb.from('outreach_entries').insert(seedRows)
  if (seedErr) {
    console.warn('[seed-test-org] seed outreach insert failed', seedErr.message)
    // Non-fatal — the team exists, just no demo data.
  }

  // ----- STEP 7: Generate magic links per fixture. -----
  const origin = originFromReq(req)
  const fixturesWithLinks: Array<{
    email: string
    role: OrganizationRole
    fullName: string
    password: string
    magicLink: string | null
  }> = []

  for (const fixture of created) {
    const magicLink = await generateMagicLink(sb, fixture.email, origin)
    fixturesWithLinks.push({
      email: fixture.email,
      role: fixture.role,
      fullName: fixture.fullName,
      password: fixture.password,
      magicLink,
    })
  }

  return NextResponse.json({
    ok: true,
    organization_id: orgId,
    organization_name: FIXTURE_ORG_NAME,
    fixtures: fixturesWithLinks,
    enrichWarnings: enrichErrors.length > 0 ? enrichErrors : undefined,
  })
}
