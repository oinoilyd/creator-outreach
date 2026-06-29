/**
 * lib/email/direct/crypto.ts — at-rest encryption for OAuth tokens.
 *
 * Refresh tokens are long-lived keys to a user's mailbox. We NEVER store
 * them in plaintext. Everything written to direct_email_accounts.*_enc
 * goes through encryptToken() here; everything read back goes through
 * decryptToken().
 *
 * Scheme: AES-256-GCM (authenticated encryption — tamper-evident).
 *   • A random 12-byte IV per encryption (GCM standard).
 *   • Output layout, base64: [12-byte IV][16-byte auth tag][ciphertext].
 *
 * Key: EMAIL_TOKEN_ENC_KEY — 32 bytes, supplied as 64 hex chars OR
 * base64. Generate one with:  openssl rand -hex 32
 *
 * The key lives ONLY in the environment (Vercel env / .env.local), never
 * in the repo. Rotating it invalidates existing stored tokens (users
 * reconnect) — acceptable and rare.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

/** Parse + validate the 32-byte key from env. Throws a clear error if
 *  missing or the wrong size, so misconfiguration fails loudly at the
 *  first token write rather than silently corrupting data. */
function key(): Buffer {
  const raw = process.env.EMAIL_TOKEN_ENC_KEY?.trim()
  if (!raw) {
    throw new Error(
      'EMAIL_TOKEN_ENC_KEY is missing. Generate one with `openssl rand -hex 32` ' +
        'and set it in Vercel env + .env.local.',
    )
  }
  // Accept hex (64 chars) or base64.
  let buf: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    buf = Buffer.from(raw, 'hex')
  } else {
    buf = Buffer.from(raw, 'base64')
  }
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `EMAIL_TOKEN_ENC_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length}). ` +
        'Use `openssl rand -hex 32`.',
    )
  }
  return buf
}

/** Encrypt a token string → base64 blob safe to store in a text column. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

/** Decrypt a blob produced by encryptToken(). Throws if the key is wrong
 *  or the data was tampered with (GCM auth-tag check). */
export function decryptToken(blob: string): string {
  const buf = Buffer.from(blob, 'base64')
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error('Encrypted token blob is too short / corrupt.')
  }
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const enc = buf.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

/** Encrypt only if present — convenience for optional access tokens. */
export function encryptMaybe(plaintext: string | null | undefined): string | null {
  return plaintext ? encryptToken(plaintext) : null
}

/** Decrypt only if present. */
export function decryptMaybe(blob: string | null | undefined): string | null {
  return blob ? decryptToken(blob) : null
}
