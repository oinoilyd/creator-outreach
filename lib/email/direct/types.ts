/**
 * lib/email/direct/types.ts — shared shapes for the direct-email path.
 *
 * Two layers of types:
 *   • Row types — mirror the 0051 migration tables 1:1.
 *   • Provider-agnostic types — the SendInput / NormalizedMessage / OAuth
 *     shapes that the Gmail and Microsoft modules both speak, so the rest
 *     of the app never branches on provider.
 */
import type { DirectEmailProvider } from './flag'

export type { DirectEmailProvider }

// ── Row types (mirror 0051) ─────────────────────────────────────────────────

export type AccountStatus = 'active' | 'needs_reconnect' | 'revoked'

export interface DirectEmailAccount {
  id: string
  user_id: string
  provider: DirectEmailProvider
  email: string
  access_token_enc: string | null
  refresh_token_enc: string | null
  token_expires_at: string | null
  scopes: string | null
  history_id: string | null
  delta_link: string | null
  status: AccountStatus
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export type MessageDirection = 'inbound' | 'outbound'

export interface DirectEmailLogRow {
  id: string
  user_id: string
  account_id: string
  provider_message_id: string
  thread_id: string | null
  direction: MessageDirection
  from_email: string | null
  from_name: string | null
  to_emails: string[] | null
  subject: string | null
  snippet: string | null
  sent_at: string | null
  outreach_entry_id: string | null
  classification: string | null
  created_at: string
}

export interface SequenceStepEmail {
  type: 'email'
  subject: string
  body: string
}
export interface SequenceStepWait {
  type: 'wait'
  days: number
}
export type SequenceStep = SequenceStepEmail | SequenceStepWait

export interface DirectEmailSequence {
  id: string
  user_id: string
  name: string
  steps: SequenceStep[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'stopped'
export type StopReason =
  | 'replied'
  | 'bounced'
  | 'manual'
  | 'booked'
  | 'unsubscribed'

export interface DirectEmailEnrollment {
  id: string
  user_id: string
  sequence_id: string
  outreach_entry_id: string | null
  contact_email: string
  current_step: number
  next_run_at: string | null
  status: EnrollmentStatus
  stop_reason: StopReason | null
  last_step_at: string | null
  created_at: string
  updated_at: string
}

// ── Provider-agnostic shapes ────────────────────────────────────────────────

/** OAuth token set returned by a code exchange or refresh. */
export interface OAuthTokens {
  accessToken: string
  /** Absent on a refresh that doesn't rotate the refresh token. */
  refreshToken?: string
  /** Unix epoch ms when the access token expires. */
  expiresAt: number
  scope?: string
  /** The mailbox address resolved from the grant, when available. */
  email?: string
}

/** Input to the single sendEmail() choke-point. Provider-agnostic. */
export interface SendInput {
  to: string
  toDisplayName?: string
  subject: string
  /** Plain text or HTML — see bodyType. */
  body: string
  bodyType?: 'text' | 'html'
  /** Provider thread id to reply into (keeps the reply in-thread). */
  threadId?: string
  /** RFC822 Message-ID of the message we're replying to, for the
   *  In-Reply-To / References headers (Gmail). */
  inReplyToMessageId?: string
  /** Soft link back to the outreach row, logged with the outbound row. */
  outreachEntryId?: string
}

/** Result of a send — the provider ids we persist for later threading. */
export interface SendResult {
  providerMessageId: string
  threadId: string | null
}

/** A message pulled from a mailbox, normalized across providers. Upserted
 *  into direct_email_log by provider_message_id. */
export interface NormalizedMessage {
  providerMessageId: string
  threadId: string | null
  direction: MessageDirection
  fromEmail: string | null
  fromName: string | null
  toEmails: string[]
  subject: string | null
  snippet: string | null
  sentAt: string | null
  /** RFC822 In-Reply-To header value, used to match a reply to our send. */
  inReplyTo: string | null
}

/** Outcome of an incremental sync — new/updated messages plus the cursor
 *  to persist for next time. */
export interface SyncResult {
  messages: NormalizedMessage[]
  /** Gmail: new historyId. Microsoft: new delta link. Persist whichever
   *  the provider returned. */
  historyId?: string
  deltaLink?: string
}
