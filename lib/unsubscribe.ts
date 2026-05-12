/**
 * Unsubscribe-link token encoding + verification.
 *
 * CAN-SPAM §5(a)(3-4) requires every commercial email to carry a
 * working unsubscribe mechanism. The footer in `buildCanSpamFooter`
 * embeds a URL of the form
 *
 *     https://creatoroutreach.net/unsubscribe?t=<token>
 *
 * where <token> is `base64url(json).base64url(hmac)`. The JSON payload
 * identifies (sender, recipient, issued-at); the HMAC binds the
 * payload to a server-side secret so an attacker can't forge an
 * unsubscribe for an arbitrary recipient and silently DoS a sender's
 * outreach.
 *
 * The token format is intentionally tiny — three fields, no nonce —
 * because suppression is idempotent: a re-submitted valid token just
 * hits the unique-constraint on `suppression_list (user_id,
 * recipient_email)` and is a no-op. We accept clicks indefinitely
 * (no `ts` expiry) so legitimate recipients can unsubscribe weeks
 * later from a stashed email.
 *
 * The HMAC uses HMAC-SHA256 with `UNSUBSCRIBE_HMAC_SECRET` (≥64 chars,
 * 256+ bits of entropy). Constant-time comparison via
 * `crypto.timingSafeEqual` defeats timing oracles.
 */

import { createHmac, timingSafeEqual } from 'crypto'

export interface UnsubscribePayload {
  /** The sending user's identifier. We pass auth email as a stable,
   *  non-secret pointer; the `/unsubscribe` page resolves it to a UUID
   *  via the service-role Supabase client before inserting. */
  userId: string
  /** The recipient email being unsubscribed. */
  recipientEmail: string
  /** Epoch ms when the token was minted. Captured for audit; we don't
   *  enforce expiry on the verify path. */
  ts: number
}

export interface VerifyResult {
  valid: boolean
  payload?: UnsubscribePayload
  /** Human-readable reason for an invalid token. Useful for logging
   *  but never shown to the recipient (we render a generic message). */
  reason?:
    | 'malformed'
    | 'missing_secret'
    | 'bad_payload'
    | 'bad_signature'
}

/** Base64url encode without padding. */
function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf
  return b
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

/** Base64url decode → Buffer. Throws on malformed input. */
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const std = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(std, 'base64')
}

function getSecret(): string | null {
  const s = process.env.UNSUBSCRIBE_HMAC_SECRET
  if (!s || s.length < 16) return null
  return s
}

/**
 * Mint a signed unsubscribe token. Returns `<b64url(json)>.<b64url(hmac)>`.
 *
 * If `UNSUBSCRIBE_HMAC_SECRET` isn't set (e.g. local dev that forgot
 * to copy `.env.example`), we still emit a deterministic placeholder
 * signature ('unsigned') rather than crashing — better to send mail
 * with a non-verifiable link than to silently fail every outreach.
 * The verify path treats those tokens as invalid, and surfaces the
 * "your link is invalid" page; the sender will notice in testing.
 */
export function encodeUnsubscribeToken(payload: UnsubscribePayload): string {
  const json = JSON.stringify(payload)
  const payloadB64 = b64urlEncode(json)
  const secret = getSecret()
  if (!secret) {
    return `${payloadB64}.unsigned`
  }
  const sig = createHmac('sha256', secret).update(payloadB64).digest()
  return `${payloadB64}.${b64urlEncode(sig)}`
}

/**
 * Verify a token from the `?t=` query param. Returns the parsed
 * payload on success; never throws.
 *
 * We sign the *base64url-encoded payload string* (not the raw JSON)
 * so verification can compare bytes directly without re-serialising
 * the JSON (which could differ from how it was originally encoded).
 */
export function verifyUnsubscribeToken(t: string | null | undefined): VerifyResult {
  if (!t || typeof t !== 'string') return { valid: false, reason: 'malformed' }
  const dot = t.lastIndexOf('.')
  if (dot <= 0 || dot === t.length - 1) return { valid: false, reason: 'malformed' }
  const payloadB64 = t.slice(0, dot)
  const sigB64 = t.slice(dot + 1)

  const secret = getSecret()
  if (!secret) return { valid: false, reason: 'missing_secret' }

  // Parse payload first so a malformed JSON fails fast with a clear reason.
  let payload: UnsubscribePayload
  try {
    const json = b64urlDecode(payloadB64).toString('utf8')
    const parsed = JSON.parse(json) as Partial<UnsubscribePayload>
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.recipientEmail !== 'string' ||
      typeof parsed.ts !== 'number'
    ) {
      return { valid: false, reason: 'bad_payload' }
    }
    payload = {
      userId: parsed.userId,
      recipientEmail: parsed.recipientEmail,
      ts: parsed.ts,
    }
  } catch {
    return { valid: false, reason: 'bad_payload' }
  }

  // Constant-time HMAC compare. Decode signature bytes; mismatched
  // lengths short-circuit (timingSafeEqual would throw).
  let providedSig: Buffer
  try {
    providedSig = b64urlDecode(sigB64)
  } catch {
    return { valid: false, reason: 'bad_signature' }
  }
  const expected = createHmac('sha256', secret).update(payloadB64).digest()
  if (providedSig.length !== expected.length) {
    return { valid: false, reason: 'bad_signature' }
  }
  if (!timingSafeEqual(providedSig, expected)) {
    return { valid: false, reason: 'bad_signature' }
  }

  return { valid: true, payload }
}
