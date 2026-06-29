/**
 * lib/email/direct/send.ts — the single choke-point every direct-email
 * send flows through. Per the design, NOTHING sends mail except this.
 *
 * Responsibilities:
 *   1. Load the connected account (caller passes a Supabase client, so this
 *      works both in a user request — RLS-scoped — and in the cron via the
 *      service-role client).
 *   2. Guarantee a fresh access token (refresh + persist if expired).
 *   3. Dispatch to the right provider (Gmail / Graph).
 *   4. Log the send into direct_email_log as an outbound row immediately,
 *      idempotently, so the thread view + sequence stop-conditions see it.
 *
 * It deliberately does NOT decide WHETHER to send (sequence stop-conditions
 * live in the enrollment engine). It only sends what it's told and records it.
 *
 * getFreshAccessToken() is exported because the sync cron needs the exact
 * same refresh-and-persist logic.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DirectEmailAccount, SendInput, SendResult, OAuthTokens } from './types'
import { isDirectEmailEnabled } from './flag'
import { decryptToken, encryptToken } from './crypto'
import * as google from './google'
import * as microsoft from './microsoft'

const ACCOUNTS = 'direct_email_accounts'
const LOG = 'direct_email_log'

/** Provider dispatch table — keeps send/sync provider-agnostic. */
const PROVIDERS = {
  google: { send: google.sendMessage, refresh: google.refreshTokens },
  microsoft: { send: microsoft.sendMessage, refresh: microsoft.refreshTokens },
} as const

/** Refresh + persist if the access token is missing or within 60s of
 *  expiry; otherwise return the still-valid decrypted token. */
export async function getFreshAccessToken(
  supabase: SupabaseClient,
  account: DirectEmailAccount,
): Promise<string> {
  const expiresSoon =
    !account.token_expires_at || new Date(account.token_expires_at).getTime() - Date.now() < 60_000

  if (!expiresSoon && account.access_token_enc) {
    return decryptToken(account.access_token_enc)
  }

  if (!account.refresh_token_enc) {
    throw new Error(`Account ${account.id} has no refresh token — user must reconnect.`)
  }

  const refreshToken = decryptToken(account.refresh_token_enc)
  let tokens: OAuthTokens
  try {
    tokens = await PROVIDERS[account.provider].refresh(refreshToken)
  } catch (e) {
    // Refresh failed → the grant was revoked/expired. Flag for reconnect.
    await supabase.from(ACCOUNTS).update({ status: 'needs_reconnect', updated_at: new Date().toISOString() }).eq('id', account.id)
    throw e
  }

  const patch: Record<string, unknown> = {
    access_token_enc: encryptToken(tokens.accessToken),
    token_expires_at: new Date(tokens.expiresAt).toISOString(),
    updated_at: new Date().toISOString(),
  }
  // Providers usually keep the same refresh token on refresh; persist a
  // rotated one only if returned.
  if (tokens.refreshToken) patch.refresh_token_enc = encryptToken(tokens.refreshToken)

  await supabase.from(ACCOUNTS).update(patch).eq('id', account.id)
  return tokens.accessToken
}

/** Send (or reply to) a message from a connected mailbox and record it. */
export async function sendEmail(
  supabase: SupabaseClient,
  accountId: string,
  input: SendInput,
): Promise<SendResult> {
  if (!isDirectEmailEnabled()) {
    throw new Error('Direct email is disabled (DIRECT_EMAIL_ENABLED is off).')
  }

  const { data: account, error } = await supabase
    .from(ACCOUNTS)
    .select('*')
    .eq('id', accountId)
    .maybeSingle<DirectEmailAccount>()

  if (error) throw new Error(`Loading account ${accountId}: ${error.message}`)
  if (!account) throw new Error(`Account ${accountId} not found.`)
  if (account.status !== 'active') {
    throw new Error(`Account ${accountId} is ${account.status} — cannot send.`)
  }

  const accessToken = await getFreshAccessToken(supabase, account)
  const result = await PROVIDERS[account.provider].send(accessToken, input)

  // Log outbound immediately, idempotent on (account_id, provider_message_id).
  const snippet = input.body.replace(/\s+/g, ' ').slice(0, 200)
  await supabase.from(LOG).upsert(
    {
      user_id: account.user_id,
      account_id: account.id,
      provider_message_id: result.providerMessageId,
      thread_id: result.threadId,
      direction: 'outbound',
      from_email: account.email,
      to_emails: [input.to],
      subject: input.subject,
      snippet,
      sent_at: new Date().toISOString(),
      outreach_entry_id: input.outreachEntryId ?? null,
    },
    { onConflict: 'account_id,provider_message_id' },
  )

  return result
}
