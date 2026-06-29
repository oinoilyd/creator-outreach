/**
 * lib/email/direct/google.ts — Gmail provider for the direct-email path.
 *
 * Pure REST over fetch (no googleapis SDK — keeps the bundle lean and
 * serverless-friendly, matching how lib/unipile.ts talks to its API).
 *
 * Exposes the provider-uniform surface that send.ts + the sync cron
 * dispatch to:
 *   authUrl / exchangeCode / refreshTokens — OAuth
 *   getIdentity                            — resolve the mailbox address
 *   sendMessage                            — build MIME + users.messages.send
 *   syncMessages                           — incremental pull via historyId
 *
 * Scopes (all "restricted" → require Google's security review for prod):
 *   gmail.readonly  — read inbox for reply detection
 *   gmail.send      — send + reply in-thread
 *   openid / email  — resolve which mailbox this is
 *
 * NOTE: this is written to Google's documented API shapes but can only be
 * exercised end-to-end once a Google Cloud OAuth client exists and the
 * mailbox is connected (the sandbox step). Until then it is dead code.
 */
import type { OAuthTokens, SendInput, SendResult, SyncResult, NormalizedMessage } from './types'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'openid',
  'email',
]

function clientId(): string {
  const v = process.env.GOOGLE_EMAIL_CLIENT_ID?.trim()
  if (!v) throw new Error('GOOGLE_EMAIL_CLIENT_ID is missing.')
  return v
}
function clientSecret(): string {
  const v = process.env.GOOGLE_EMAIL_CLIENT_SECRET?.trim()
  if (!v) throw new Error('GOOGLE_EMAIL_CLIENT_SECRET is missing.')
  return v
}

// ── OAuth ───────────────────────────────────────────────────────────────────

/** Build the consent-screen URL. access_type=offline + prompt=consent
 *  guarantees we get a refresh token on first connect. `state` is our
 *  CSRF/round-trip token (carries the user id). */
export function authUrl(opts: { redirectUri: string; state: string; loginHint?: string }): string {
  const qs = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: opts.state,
  })
  if (opts.loginHint) qs.set('login_hint', opts.loginHint)
  return `${AUTH_ENDPOINT}?${qs.toString()}`
}

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  id_token?: string
}

function tokensFrom(r: GoogleTokenResponse): OAuthTokens {
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Date.now() + (r.expires_in - 30) * 1000, // 30s safety margin
    scope: r.scope,
    email: r.id_token ? emailFromIdToken(r.id_token) : undefined,
  }
}

/** Decode the email claim from an OIDC id_token without verifying the
 *  signature — we just received it over TLS straight from Google's token
 *  endpoint, so it's trusted; we only need the email claim. */
function emailFromIdToken(idToken: string): string | undefined {
  try {
    const payload = idToken.split('.')[1]
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof json.email === 'string' ? json.email : undefined
  } catch {
    return undefined
  }
}

export async function exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  const r = await postForm(TOKEN_ENDPOINT, body)
  return tokensFrom(r)
}

export async function refreshTokens(refreshToken: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'refresh_token',
  })
  const r = await postForm(TOKEN_ENDPOINT, body)
  // A refresh response usually omits refresh_token — caller keeps the old one.
  return tokensFrom(r)
}

async function postForm(url: string, body: URLSearchParams): Promise<GoogleTokenResponse> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`Google token endpoint ${resp.status}: ${text}`)
  return JSON.parse(text) as GoogleTokenResponse
}

// ── Identity ────────────────────────────────────────────────────────────────

/** Resolve the mailbox address + current historyId (the sync starting
 *  point) from the Gmail profile. */
export async function getIdentity(accessToken: string): Promise<{ email: string; historyId?: string }> {
  const resp = await fetch(`${GMAIL_BASE}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`Gmail profile ${resp.status}: ${text}`)
  const j = JSON.parse(text) as { emailAddress: string; historyId?: string }
  return { email: j.emailAddress, historyId: j.historyId }
}

// ── Send ────────────────────────────────────────────────────────────────────

/** RFC 2047 encode a header value if it contains non-ASCII. */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/** Build a minimal RFC 2822 message and return it base64url-encoded for
 *  the Gmail send endpoint. Sets In-Reply-To / References when replying
 *  so the message threads correctly in the recipient's client. */
function buildRawMessage(input: SendInput): string {
  const contentType = input.bodyType === 'html' ? 'text/html' : 'text/plain'
  const headers = [
    `To: ${input.toDisplayName ? `${encodeHeader(input.toDisplayName)} <${input.to}>` : input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: ${contentType}; charset="UTF-8"`,
    'Content-Transfer-Encoding: 8bit',
  ]
  if (input.inReplyToMessageId) {
    const ref = input.inReplyToMessageId.startsWith('<')
      ? input.inReplyToMessageId
      : `<${input.inReplyToMessageId}>`
    headers.push(`In-Reply-To: ${ref}`, `References: ${ref}`)
  }
  const mime = `${headers.join('\r\n')}\r\n\r\n${input.body}`
  return Buffer.from(mime, 'utf8').toString('base64url')
}

export async function sendMessage(accessToken: string, input: SendInput): Promise<SendResult> {
  const payload: { raw: string; threadId?: string } = { raw: buildRawMessage(input) }
  if (input.threadId) payload.threadId = input.threadId
  const resp = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`Gmail send ${resp.status}: ${text}`)
  const j = JSON.parse(text) as { id: string; threadId?: string }
  return { providerMessageId: j.id, threadId: j.threadId ?? null }
}

// ── Sync (incremental) ──────────────────────────────────────────────────────

/** Pull mail changed since `historyId`. On the very first sync (no
 *  historyId yet) the caller should seed one via getIdentity() and skip
 *  back-fill, or do a bounded messages.list — kept out of this core to
 *  avoid an unbounded first pull. Returns new messages + the new cursor. */
export async function syncMessages(accessToken: string, historyId?: string): Promise<SyncResult> {
  if (!historyId) {
    // No cursor → just establish one; back-fill strategy is decided by the
    // cron (e.g. list the last N) so this function stays bounded + cheap.
    const id = await getIdentity(accessToken)
    return { messages: [], historyId: id.historyId }
  }

  const auth = { Authorization: `Bearer ${accessToken}` }
  const ids = new Set<string>()
  let newHistoryId = historyId
  let pageToken: string | undefined

  do {
    const qs = new URLSearchParams({ startHistoryId: historyId, historyTypes: 'messageAdded' })
    if (pageToken) qs.set('pageToken', pageToken)
    const resp = await fetch(`${GMAIL_BASE}/history?${qs.toString()}`, { headers: auth, cache: 'no-store' })
    const text = await resp.text()
    if (!resp.ok) throw new Error(`Gmail history ${resp.status}: ${text}`)
    const j = JSON.parse(text) as {
      history?: Array<{ messagesAdded?: Array<{ message: { id: string } }> }>
      historyId?: string
      nextPageToken?: string
    }
    for (const h of j.history ?? []) {
      for (const m of h.messagesAdded ?? []) ids.add(m.message.id)
    }
    if (j.historyId) newHistoryId = j.historyId
    pageToken = j.nextPageToken
  } while (pageToken)

  const messages: NormalizedMessage[] = []
  for (const id of ids) {
    const m = await getMessage(accessToken, id)
    if (m) messages.push(m)
  }
  return { messages, historyId: newHistoryId }
}

/** Fetch one message (metadata only) and normalize it. */
async function getMessage(accessToken: string, id: string): Promise<NormalizedMessage | null> {
  const qs = new URLSearchParams({ format: 'metadata' })
  for (const h of ['From', 'To', 'Subject', 'Message-ID', 'In-Reply-To']) qs.append('metadataHeaders', h)
  const resp = await fetch(`${GMAIL_BASE}/messages/${encodeURIComponent(id)}?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!resp.ok) return null
  const j = (await resp.json()) as {
    id: string
    threadId?: string
    snippet?: string
    internalDate?: string
    labelIds?: string[]
    payload?: { headers?: Array<{ name: string; value: string }> }
  }
  const header = (name: string) =>
    j.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null
  const from = parseAddress(header('From'))
  return {
    providerMessageId: j.id,
    threadId: j.threadId ?? null,
    direction: (j.labelIds ?? []).includes('SENT') ? 'outbound' : 'inbound',
    fromEmail: from.email,
    fromName: from.name,
    toEmails: parseAddressList(header('To')),
    subject: header('Subject'),
    snippet: j.snippet ?? null,
    sentAt: j.internalDate ? new Date(Number(j.internalDate)).toISOString() : null,
    inReplyTo: header('In-Reply-To'),
  }
}

/** "Jane Doe <jane@x.com>" → { name, email }. */
function parseAddress(raw: string | null): { name: string | null; email: string | null } {
  if (!raw) return { name: null, email: null }
  const m = raw.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/)
  if (m) return { name: m[1]?.trim() || null, email: m[2].trim() }
  return { name: null, email: raw.trim() }
}
function parseAddressList(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((part) => parseAddress(part).email)
    .filter((e): e is string => !!e)
}
