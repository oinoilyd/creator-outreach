/**
 * lib/email/direct/microsoft.ts — Outlook / Microsoft 365 provider.
 *
 * Same provider-uniform surface as google.ts, over Microsoft Graph via
 * plain fetch. Microsoft's verification is lighter than Google's, but the
 * shape mirrors Gmail so send.ts + the sync cron stay provider-agnostic.
 *
 * Scopes:
 *   Mail.ReadWrite  — read inbox + create/send drafts (needed to capture
 *                     the message id, which /sendMail alone doesn't return)
 *   Mail.Send       — send
 *   offline_access  — refresh token
 *   User.Read / openid / email — resolve the mailbox address
 *
 * Threading: Graph groups a back-and-forth by conversationId; replying via
 * createReply keeps it threaded. For Microsoft, SendInput.inReplyToMessageId
 * carries the Graph message id (not an RFC822 Message-ID).
 *
 * Written to Graph's documented shapes; exercisable only once an Azure app
 * registration exists and a mailbox is connected.
 */
import type { OAuthTokens, SendInput, SendResult, SyncResult, NormalizedMessage } from './types'

const TENANT = 'common'
const AUTH_ENDPOINT = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`
const TOKEN_ENDPOINT = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

export const MS_SCOPES = [
  'offline_access',
  'openid',
  'email',
  'User.Read',
  'Mail.ReadWrite',
  'Mail.Send',
]

function clientId(): string {
  const v = process.env.MS_EMAIL_CLIENT_ID?.trim()
  if (!v) throw new Error('MS_EMAIL_CLIENT_ID is missing.')
  return v
}
function clientSecret(): string {
  const v = process.env.MS_EMAIL_CLIENT_SECRET?.trim()
  if (!v) throw new Error('MS_EMAIL_CLIENT_SECRET is missing.')
  return v
}

// ── OAuth ───────────────────────────────────────────────────────────────────

export function authUrl(opts: { redirectUri: string; state: string; loginHint?: string }): string {
  const qs = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    redirect_uri: opts.redirectUri,
    response_mode: 'query',
    scope: MS_SCOPES.join(' '),
    state: opts.state,
  })
  if (opts.loginHint) qs.set('login_hint', opts.loginHint)
  return `${AUTH_ENDPOINT}?${qs.toString()}`
}

interface MsTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  id_token?: string
}

function tokensFrom(r: MsTokenResponse): OAuthTokens {
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Date.now() + (r.expires_in - 30) * 1000,
    scope: r.scope,
    email: r.id_token ? emailFromIdToken(r.id_token) : undefined,
  }
}

function emailFromIdToken(idToken: string): string | undefined {
  try {
    const payload = idToken.split('.')[1]
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return (json.email || json.preferred_username) ?? undefined
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
    scope: MS_SCOPES.join(' '),
  })
  return tokensFrom(await postForm(body))
}

export async function refreshTokens(refreshToken: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'refresh_token',
    scope: MS_SCOPES.join(' '),
  })
  return tokensFrom(await postForm(body))
}

async function postForm(body: URLSearchParams): Promise<MsTokenResponse> {
  const resp = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`Microsoft token endpoint ${resp.status}: ${text}`)
  return JSON.parse(text) as MsTokenResponse
}

// ── Identity ────────────────────────────────────────────────────────────────

export async function getIdentity(accessToken: string): Promise<{ email: string; historyId?: string }> {
  const resp = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`Graph /me ${resp.status}: ${text}`)
  const j = JSON.parse(text) as { mail?: string; userPrincipalName?: string }
  return { email: j.mail || j.userPrincipalName || '' }
}

// ── Send ────────────────────────────────────────────────────────────────────

async function graph(
  accessToken: string,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
}

/** Send a message (or reply) and return the captured ids. We create a
 *  draft first (rather than fire-and-forget /sendMail) so we get back the
 *  message id + conversationId to persist for threading + dedupe. */
export async function sendMessage(accessToken: string, input: SendInput): Promise<SendResult> {
  const contentType = input.bodyType === 'html' ? 'HTML' : 'Text'

  let draftId: string
  let conversationId: string | null = null

  if (input.inReplyToMessageId) {
    // Reply path: createReply makes a threaded draft, then we set the body.
    const r = await graph(accessToken, 'POST', `/me/messages/${encodeURIComponent(input.inReplyToMessageId)}/createReply`)
    const text = await r.text()
    if (!r.ok) throw new Error(`Graph createReply ${r.status}: ${text}`)
    const draft = JSON.parse(text) as { id: string; conversationId?: string }
    draftId = draft.id
    conversationId = draft.conversationId ?? null
    const patch = await graph(accessToken, 'PATCH', `/me/messages/${encodeURIComponent(draftId)}`, {
      body: { contentType, content: input.body },
    })
    if (!patch.ok) throw new Error(`Graph patch reply ${patch.status}: ${await patch.text()}`)
  } else {
    // New message: create a draft with all fields, then send it.
    const r = await graph(accessToken, 'POST', '/me/messages', {
      subject: input.subject,
      body: { contentType, content: input.body },
      toRecipients: [
        { emailAddress: { address: input.to, name: input.toDisplayName ?? input.to } },
      ],
    })
    const text = await r.text()
    if (!r.ok) throw new Error(`Graph create draft ${r.status}: ${text}`)
    const draft = JSON.parse(text) as { id: string; conversationId?: string }
    draftId = draft.id
    conversationId = draft.conversationId ?? null
  }

  const sent = await graph(accessToken, 'POST', `/me/messages/${encodeURIComponent(draftId)}/send`)
  if (!sent.ok && sent.status !== 202) throw new Error(`Graph send ${sent.status}: ${await sent.text()}`)
  return { providerMessageId: draftId, threadId: conversationId ?? input.threadId ?? null }
}

// ── Sync (delta) ────────────────────────────────────────────────────────────

/** Pull inbox changes since the stored delta link. First run (no link)
 *  walks the delta from the start; thereafter we follow the persisted
 *  deltaLink. Everything from the inbox folder is inbound by definition. */
export async function syncMessages(accessToken: string, deltaLink?: string): Promise<SyncResult> {
  const messages: NormalizedMessage[] = []
  let url = deltaLink || `${GRAPH_BASE}/me/mailFolders/inbox/messages/delta`
  let nextDeltaLink = deltaLink

  // Follow nextLink pages until we reach the page that carries deltaLink.
  // Guard against runaway paging.
  for (let page = 0; page < 50; page++) {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const text = await resp.text()
    if (!resp.ok) throw new Error(`Graph delta ${resp.status}: ${text}`)
    const j = JSON.parse(text) as {
      value?: GraphMessage[]
      '@odata.nextLink'?: string
      '@odata.deltaLink'?: string
    }
    for (const m of j.value ?? []) messages.push(normalize(m))
    if (j['@odata.deltaLink']) {
      nextDeltaLink = j['@odata.deltaLink']
      break
    }
    if (!j['@odata.nextLink']) break
    url = j['@odata.nextLink']
  }

  return { messages, deltaLink: nextDeltaLink }
}

interface GraphMessage {
  id: string
  conversationId?: string
  subject?: string
  bodyPreview?: string
  sentDateTime?: string
  receivedDateTime?: string
  from?: { emailAddress?: { name?: string; address?: string } }
  toRecipients?: Array<{ emailAddress?: { address?: string } }>
  internetMessageId?: string
}

function normalize(m: GraphMessage): NormalizedMessage {
  return {
    providerMessageId: m.id,
    threadId: m.conversationId ?? null,
    direction: 'inbound', // inbox-folder delta is always received mail
    fromEmail: m.from?.emailAddress?.address ?? null,
    fromName: m.from?.emailAddress?.name ?? null,
    toEmails: (m.toRecipients ?? [])
      .map((r) => r.emailAddress?.address)
      .filter((a): a is string => !!a),
    subject: m.subject ?? null,
    snippet: m.bodyPreview ?? null,
    sentAt: m.receivedDateTime || m.sentDateTime || null,
    inReplyTo: m.internetMessageId ?? null,
  }
}
