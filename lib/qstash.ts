/**
 * QStash background-job publisher (Upstash QStash).
 *
 * Why QStash and not something else:
 *   We're already on Upstash for the Redis cache — QStash is the same
 *   vendor's queue product, ~zero additional setup. Vercel-native: a
 *   QStash message turns into an HTTP POST to one of our /api routes,
 *   so the "worker" is just another serverless function. No long-lived
 *   process to manage, no extra infra cost, free tier covers 500
 *   messages/day which is plenty for current usage.
 *
 * What we use it for:
 *   When /api/enrich resolves an IG handle, we don't want to block the
 *   user-facing response on a Meta Graph API call. So we fire a QStash
 *   job, return immediately, and QStash POSTs to /api/instagram-fetch
 *   a few seconds later to actually hit Meta. Result lands in Redis +
 *   Postgres so the next request sees real metrics instantly.
 *
 * Required env vars (graceful no-op when missing):
 *   QSTASH_TOKEN                — publish credential
 *   QSTASH_CURRENT_SIGNING_KEY  — verify incoming webhooks
 *   QSTASH_NEXT_SIGNING_KEY     — verify incoming webhooks (rotation)
 *
 * Webhook verification: we verify the upstash-signature header in
 * the worker route (/api/instagram-fetch) so randos can't trigger our
 * worker. See verifyQStashSignature below.
 */

import { createHmac } from 'crypto'

export function isQStashConfigured(): boolean {
  return !!(
    process.env.QSTASH_TOKEN &&
    process.env.QSTASH_CURRENT_SIGNING_KEY
  )
}

/**
 * Publish a job to QStash. Body is sent to the destination URL as
 * an HTTP POST with `Content-Type: application/json`. Returns the
 * QStash message ID on success, null on no-op or failure.
 *
 * `destination` should be an absolute URL like
 *   https://creatoroutreach.net/api/instagram-fetch
 *
 * In local dev (no public URL), this no-ops — set
 * QSTASH_DESTINATION_BASE_URL=http://localhost:3000 + use the QStash
 * dev tunnel if you want to test end-to-end locally.
 */
export async function publishJob(
  destination: string,
  body: unknown,
  options: { delaySeconds?: number; deduplicationId?: string } = {},
): Promise<string | null> {
  if (!isQStashConfigured()) {
    console.log('[qstash] not configured, skipping publish')
    return null
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
    'Content-Type': 'application/json',
  }
  if (options.delaySeconds && options.delaySeconds > 0) {
    headers['Upstash-Delay'] = `${options.delaySeconds}s`
  }
  if (options.deduplicationId) {
    headers['Upstash-Deduplication-Id'] = options.deduplicationId
  }

  try {
    const res = await fetch(`https://qstash.upstash.io/v2/publish/${destination}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.warn(`[qstash] publish failed ${res.status}: ${await res.text()}`)
      return null
    }
    const json = (await res.json()) as { messageId?: string }
    return json.messageId || null
  } catch (e) {
    console.warn('[qstash] publish error:', (e as Error).message)
    return null
  }
}

/**
 * Verify the upstash-signature header on an incoming webhook. Returns
 * true when the signature is valid against either the current or next
 * signing key (Upstash supports key rotation by trying both).
 *
 * The signature is JWT-like: base64url(header).base64url(payload).base64url(signature)
 * where signature = HMAC-SHA256(currentKey, header + '.' + payload).
 */
export function verifyQStashSignature(
  rawBody: string,
  signatureHeader: string | null,
  url: string,
): boolean {
  if (!signatureHeader) return false
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY
  if (!currentKey) return false

  const parts = signatureHeader.split('.')
  if (parts.length !== 3) return false
  const [headerB64, payloadB64, signatureB64] = parts
  const signedInput = `${headerB64}.${payloadB64}`

  const tryKey = (key: string): boolean => {
    const expected = createHmac('sha256', key)
      .update(signedInput)
      .digest('base64url')
    return expected === signatureB64
  }

  // Decode + verify the JWT payload claims (issuer, body hash, url, exp).
  let payload: { iss?: string; sub?: string; body?: string; exp?: number }
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return false
  }
  if (payload.iss !== 'Upstash') return false
  if (payload.sub && payload.sub !== url) return false
  if (payload.exp && Date.now() / 1000 > payload.exp) return false

  // Body hash check: payload.body should be SHA-256 of rawBody, base64url.
  if (payload.body) {
    const bodyHash = require('crypto')
      .createHash('sha256')
      .update(rawBody)
      .digest('base64url')
    if (bodyHash !== payload.body) return false
  }

  return tryKey(currentKey) || (nextKey ? tryKey(nextKey) : false)
}
