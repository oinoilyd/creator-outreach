/**
 * POST /api/unipile/webhook — Unipile callbacks for account lifecycle.
 *
 * Phase 1 scope: handle CREATION_SUCCESS (and equivalents) so we can
 * map the newly-issued account_id back to a user_profile row via the
 * `name` field we set to user.id during hosted-link creation.
 *
 * Phase 3 will extend this same route to handle:
 *   • new_email / messaging.new — incoming replies → reply classifier
 *   • account.disconnected / .error — reset unipile_account_id, surface UI
 *
 * Payload shape (best-effort — Unipile's docs are incomplete; we
 * tolerate variations):
 *   {
 *     status: 'CREATION_SUCCESS' | 'CREATION_FAILED' | ...,
 *     account_id: '...',
 *     name: '<our supabase user.id we passed at link time>',
 *     account_type?: 'GOOGLE' | ...,
 *     email?: '...',   // sometimes present, sometimes only in /accounts/{id}
 *   }
 *
 * Security: the hosted-auth flow's `notify_url` parameter is one-shot
 * per link and doesn't get a shared secret, so this route can't
 * verify a signature on Phase 1. Mitigation: we (a) only accept
 * payloads whose `name` matches a real user.id, and (b) cross-verify
 * the account by calling getAccount() back to Unipile with our
 * authenticated API key — a forged webhook pointing at a random
 * account_id would either 404 or surface an account we don't
 * recognize. The write to user_profile only happens after that
 * round-trip succeeds.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getAccount, emailFromAccount, UnipileError } from '@/lib/unipile'
import { cacheGet, cacheSet } from '@/lib/cache'

export const runtime = 'nodejs'
export const maxDuration = 15

/** Rolling Redis list of recent Unipile webhook events — drives the
 *  admin debug page. Same shape/pattern as inbound-email:recent:v1. */
const RECENT_WEBHOOK_KEY = 'unipile-webhook:recent:v1'
const RECENT_WEBHOOK_LIMIT = 50
const RECENT_WEBHOOK_TTL_SECONDS = 7 * 24 * 60 * 60

interface RecentWebhookEntry {
  receivedAt: string
  status: string | null
  accountId: string | null
  userId: string | null
  accountType: string | null
  matched: boolean
  /** Brief error message if processing failed — null on success. */
  error: string | null
}

interface UnipileWebhookPayload {
  status?: string
  account_id?: string
  name?: string
  account_type?: string
  email?: string
  [k: string]: unknown
}

/** Service-role Supabase client — bypasses RLS. Only this webhook
 *  uses it. Returns null when env vars are missing (graceful no-op). */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function pushRecent(entry: RecentWebhookEntry): Promise<void> {
  try {
    const list = (await cacheGet<RecentWebhookEntry[]>(RECENT_WEBHOOK_KEY)) || []
    const next = [entry, ...list].slice(0, RECENT_WEBHOOK_LIMIT)
    await cacheSet(RECENT_WEBHOOK_KEY, next, RECENT_WEBHOOK_TTL_SECONDS)
  } catch (e) {
    console.warn('[unipile/webhook] failed to write recent list:', (e as Error).message)
  }
}

export async function POST(req: NextRequest) {
  let payload: UnipileWebhookPayload
  try {
    payload = (await req.json()) as UnipileWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const status = (payload.status ?? '').toString().toUpperCase()
  const accountId = payload.account_id?.toString().trim() ?? ''
  const userId = payload.name?.toString().trim() ?? ''
  const baseRecent: RecentWebhookEntry = {
    receivedAt: new Date().toISOString(),
    status: status || null,
    accountId: accountId || null,
    userId: userId || null,
    accountType: payload.account_type ?? null,
    matched: false,
    error: null,
  }

  // CREATION_SUCCESS is the happy path. Unipile also emits RECONNECT_SUCCESS
  // for reconnections — treat the same since we just want to (re)point
  // user_profile.unipile_account_id. OK is sometimes used as a generic
  // "everything's fine" status.
  const isCreationOrReconnect =
    status === 'CREATION_SUCCESS' ||
    status === 'RECONNECT_SUCCESS' ||
    status === 'OK'

  if (!isCreationOrReconnect) {
    await pushRecent({ ...baseRecent, error: 'non-creation event (ignored)' })
    console.log('[unipile/webhook] non-creation event', { status, accountId, userId })
    return NextResponse.json({ ok: true, ignored: true })
  }

  if (!accountId || !userId) {
    await pushRecent({ ...baseRecent, error: 'missing account_id or name' })
    return NextResponse.json({ error: 'Missing account_id or name' }, { status: 400 })
  }

  // Cross-verify with Unipile using our authenticated key. Catches both
  // forged webhooks AND payload-format drift (where Unipile changes their
  // status enum and our happy-path branch fires on a non-finished state).
  let email: string | null = null
  let accountType: string | null = payload.account_type ?? null
  try {
    const account = await getAccount(accountId)
    email = emailFromAccount(account)
    accountType = account.type ?? accountType
    if (account.name && account.name !== userId) {
      await pushRecent({ ...baseRecent, error: 'name mismatch with Unipile account' })
      console.warn('[unipile/webhook] account.name mismatch', {
        accountId,
        webhookName: userId,
        accountName: account.name,
      })
      return NextResponse.json({ error: 'Account name mismatch' }, { status: 403 })
    }
  } catch (err) {
    const msg = err instanceof UnipileError ? err.message : (err as Error).message
    await pushRecent({ ...baseRecent, error: `verify failed: ${msg}` })
    console.error('[unipile/webhook] account verify failed', err)
    return NextResponse.json(
      { error: 'Could not verify account with Unipile', detail: msg },
      { status: 502 },
    )
  }

  const supabase = getServiceClient()
  if (!supabase) {
    await pushRecent({ ...baseRecent, error: 'service client unavailable' })
    return NextResponse.json(
      { error: 'Service client unavailable — check NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    )
  }

  const { error: updateErr } = await supabase
    .from('user_profile')
    .update({
      unipile_account_id: accountId,
      unipile_account_email: email,
      unipile_connected_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (updateErr) {
    await pushRecent({ ...baseRecent, error: `db update failed: ${updateErr.message}` })
    console.error('[unipile/webhook] user_profile update failed', updateErr)
    return NextResponse.json({ error: 'Could not persist account link' }, { status: 500 })
  }

  await pushRecent({ ...baseRecent, accountType, matched: true })
  console.log('[unipile/webhook] linked account', { userId, accountId, accountType, email })

  return NextResponse.json({ ok: true, linked: { accountId, email, accountType } })
}
