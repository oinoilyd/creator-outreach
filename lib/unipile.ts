/**
 * lib/unipile.ts — thin client wrapper around the Unipile REST API.
 *
 * Phase 1 surface (this file):
 *   • createHostedAuthLink — mint a one-time URL that takes the user
 *     through Unipile's hosted Gmail OAuth flow and webhooks us back
 *     when they finish.
 *   • getAccount — fetch a connected account's metadata (email, status).
 *   • disconnectAccount — revoke / delete a connected account.
 *
 * Phase 2 (later, in lib/unipile-send.ts or similar) will add:
 *   • sendEmail — POST /api/v1/messages with account_id + to/subject/body
 *   • listAccountsByName — backup mechanism to find account_id if the
 *     webhook is missed.
 *
 * Auth: a single workspace-scoped API key, stored in UNIPILE_API_KEY.
 * Header format: X-API-KEY: <key> (NOT Authorization: Bearer).
 *
 * Base URL: Unipile uses a per-tenant DSN like https://api6.unipile.com:13657.
 * If UNIPILE_DSN is set, we use it verbatim. Otherwise we fall back to
 * https://api.unipile.com which works for some single-region accounts.
 * If your tenant returns a 404 on every call, the dashboard probably
 * showed a region-specific URL that needs to go into UNIPILE_DSN.
 *
 * All errors throw `UnipileError` with the HTTP status + Unipile's
 * error payload so callers can render a useful toast.
 */

const DEFAULT_BASE = 'https://api.unipile.com'

function baseUrl(): string {
  const dsn = process.env.UNIPILE_DSN?.trim()
  return dsn || DEFAULT_BASE
}

function apiKey(): string {
  const key = process.env.UNIPILE_API_KEY?.trim()
  if (!key) {
    throw new UnipileError(
      0,
      'UNIPILE_API_KEY env var is missing. Add it to Vercel + .env.local, then redeploy.',
    )
  }
  return key
}

export class UnipileError extends Error {
  status: number
  payload: unknown
  constructor(status: number, message: string, payload?: unknown) {
    super(message)
    this.name = 'UnipileError'
    this.status = status
    this.payload = payload
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${baseUrl()}${path}`
  const resp = await fetch(url, {
    method,
    headers: {
      'X-API-KEY': apiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    // Unipile API calls happen server-side only — no need for CORS,
    // and we never want Next.js's fetch cache to serve a stale
    // account-list response.
    cache: 'no-store',
  })

  const text = await resp.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      // Non-JSON body — keep as text below
    }
  }

  if (!resp.ok) {
    const msg =
      (parsed as { detail?: string; message?: string } | null)?.detail ??
      (parsed as { message?: string } | null)?.message ??
      text ??
      resp.statusText
    throw new UnipileError(resp.status, `Unipile ${method} ${path} → ${resp.status}: ${msg}`, parsed)
  }

  return parsed as T
}

// ── Hosted auth ─────────────────────────────────────────────────────────────

export type HostedAuthProvider = 'GOOGLE' | 'OUTLOOK' | 'LINKEDIN' | 'WHATSAPP' | 'TELEGRAM' | 'INSTAGRAM'

export interface HostedAuthLinkInput {
  /** Our internal identifier (we use the Supabase user.id) — Unipile
   *  echoes this back in the creation webhook as `name`, letting us
   *  map account_id → user row. */
  userId: string
  /** Which provider the user is connecting (Gmail = 'GOOGLE'). */
  providers: HostedAuthProvider[]
  /** Where to send the user after they finish on Unipile's hosted page. */
  successRedirectUrl: string
  /** Where to send them if they cancel or hit an error. */
  failureRedirectUrl: string
  /** Our webhook that captures the account_id once OAuth completes. */
  notifyUrl: string
  /** How long this hosted link stays valid. Default 15 min. */
  expiresInMinutes?: number
}

export interface HostedAuthLinkResponse {
  object: 'HostedAuthURL'
  url: string
}

export async function createHostedAuthLink(input: HostedAuthLinkInput): Promise<HostedAuthLinkResponse> {
  const expiresOn = new Date(
    Date.now() + (input.expiresInMinutes ?? 15) * 60_000,
  ).toISOString()
  return request<HostedAuthLinkResponse>('POST', '/api/v1/hosted/accounts/link', {
    type: 'create',
    providers: input.providers,
    api_url: baseUrl(),
    expiresOn,
    success_redirect_url: input.successRedirectUrl,
    failure_redirect_url: input.failureRedirectUrl,
    notify_url: input.notifyUrl,
    name: input.userId,
  })
}

// ── Account management ─────────────────────────────────────────────────────

export interface UnipileAccount {
  object: 'Account'
  id: string
  /** e.g. 'GOOGLE', 'OUTLOOK', 'LINKEDIN' */
  type: string
  /** Free-text label — we set this to the user's Supabase id at create time. */
  name?: string
  /** Per-provider connection state. 'OK' or 'CREDENTIALS' for working
   *  accounts; other values mean the user needs to reconnect. */
  sources?: Array<{ id: string; status: string }>
  /** Email address Unipile resolved from the OAuth grant (for GOOGLE). */
  connection_params?: {
    mail?: { username?: string }
    [k: string]: unknown
  }
  created_at?: string
}

export async function getAccount(accountId: string): Promise<UnipileAccount> {
  return request<UnipileAccount>('GET', `/api/v1/accounts/${encodeURIComponent(accountId)}`)
}

export async function disconnectAccount(accountId: string): Promise<void> {
  await request<unknown>('DELETE', `/api/v1/accounts/${encodeURIComponent(accountId)}`)
}

/**
 * Extract the user-facing email address from an account payload.
 * Different provider types put it in different places; this normalizes.
 */
export function emailFromAccount(account: UnipileAccount): string | null {
  return account.connection_params?.mail?.username ?? null
}

// ── Send email ─────────────────────────────────────────────────────────────

export interface SendEmailInput {
  accountId: string
  /** Recipient. Pass the bare email — we wrap into the {identifier} shape. */
  to: string
  /** Optional display name shown to recipient (defaults to the email). */
  toDisplayName?: string
  subject: string
  /** Body — accepts plain text OR HTML. If `bodyType` is 'html' we don't
   *  escape it; if 'text' we wrap in a minimal HTML shell so the email
   *  renders correctly in most clients. */
  body: string
  bodyType?: 'text' | 'html'
  /** For threading replies — pass the provider_id of the message we're
   *  replying to. Unipile threads correctly off this. */
  replyTo?: string
  /** Enable open / click tracking. Unipile injects a pixel + wraps
   *  links; we get tracking events via the webhook. Default off so
   *  the first cold email doesn't trigger Gmail's "image privacy"
   *  warnings — toggled on for follow-ups by the cron path. */
  tracking?: {
    opens?: boolean
    links?: boolean
    /** Free-text label that comes back on tracking webhook events.
     *  We set it to the outreach entry id so we can attribute opens. */
    label?: string
  }
}

export interface SendEmailResponse {
  object?: string
  /** Unipile's internal message id. */
  id?: string
  /** Provider-side message id (Gmail's Message-ID header value). */
  provider_id?: string
  /** Conversation/thread id — group key for the back-and-forth. */
  thread_id?: string
  tracking_id?: string
  [k: string]: unknown
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResponse> {
  const body = {
    account_id: input.accountId,
    to: [{ display_name: input.toDisplayName ?? input.to, identifier: input.to }],
    subject: input.subject,
    body: input.body,
    ...(input.bodyType ? { body_type: input.bodyType } : {}),
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    ...(input.tracking
      ? {
          tracking_options: {
            opens: input.tracking.opens ?? false,
            links: input.tracking.links ?? false,
            ...(input.tracking.label ? { label: input.tracking.label } : {}),
          },
        }
      : {}),
  }
  return request<SendEmailResponse>('POST', '/api/v1/emails', body)
}

// ── Threads / messages ─────────────────────────────────────────────────────

export interface UnipileEmailMessage {
  object?: string
  id?: string
  provider_id?: string
  thread_id?: string
  account_id?: string
  /** Header date or send-time, ISO. */
  date?: string
  subject?: string
  /** Free-form body — HTML or text depending on the message. */
  body?: string
  body_plain?: string
  from_attendee?: { display_name?: string; identifier?: string }
  to_attendees?: Array<{ display_name?: string; identifier?: string }>
  /** Email-thread heritage — In-Reply-To / References headers Unipile
   *  resolves into the message they reference. */
  in_reply_to?: string
  [k: string]: unknown
}

/**
 * List the messages in a single email thread, oldest-first when sorted by
 * date. Used by the conversation-history modal to render the back-and-forth.
 */
export async function getThreadMessages(
  accountId: string,
  threadId: string,
): Promise<UnipileEmailMessage[]> {
  const qs = new URLSearchParams({ account_id: accountId, thread_id: threadId })
  const resp = await request<{ items?: UnipileEmailMessage[]; object?: string }>(
    'GET',
    `/api/v1/emails?${qs.toString()}`,
  )
  return resp.items ?? []
}

/**
 * Look up a single message by Unipile's internal id. Used by the
 * webhook handler when a `messaging.new` event fires — payload only
 * has the id, we fetch the body to feed the AI classifier.
 */
export async function getEmailMessage(messageId: string): Promise<UnipileEmailMessage> {
  return request<UnipileEmailMessage>(
    'GET',
    `/api/v1/emails/${encodeURIComponent(messageId)}`,
  )
}

// ── LinkedIn (Phase 6) ──────────────────────────────────────────────────────

export interface SendDmInput {
  accountId: string
  /** LinkedIn provider id of the target (urn-style id). */
  toProviderId: string
  body: string
}

/**
 * Send a LinkedIn DM. Same `/api/v1/messages` endpoint Unipile uses for
 * every non-email chat platform (WhatsApp, Telegram, IG, etc.) — the
 * recipient resolution is platform-aware via account_id.
 */
export async function sendDm(input: SendDmInput): Promise<SendEmailResponse> {
  return request<SendEmailResponse>('POST', '/api/v1/messages', {
    account_id: input.accountId,
    attendees_ids: [input.toProviderId],
    text: input.body,
  })
}
