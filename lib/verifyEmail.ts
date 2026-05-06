// Heuristic deliverability check for an email address. Cheap, free, no
// external API. Catches the common ways an email turns out to be a
// dud — bad domain, disposable inbox, role/group address, parked
// domain — without an SMTP probe (which Vercel blocks on outbound
// port 25 anyway).
//
// What it CANNOT verify:
//   - Whether the specific local part exists at the mail server
//     (would need real SMTP RCPT TO probing)
//   - Whether anyone reads the inbox
// What it CAN catch:
//   - Domains with no MX records at all (parked / static-only sites)
//   - Disposable email domains (mailinator, tempmail, etc.)
//   - Role addresses (likely unmonitored auto-reply boxes)
//   - Free-mail providers (signal, not a flag — gmail addresses are
//     often valid, just suggests the creator has no business infra)

import { promises as dns } from 'dns'

const ROLE_LOCALS = new Set([
  'info', 'hello', 'contact', 'support', 'help', 'admin', 'postmaster',
  'hostmaster', 'webmaster', 'abuse', 'noreply', 'no-reply',
  'donotreply', 'do-not-reply', 'marketing', 'sales', 'team', 'hr',
  'jobs', 'careers', 'partnerships', 'press', 'media', 'inquiries',
  'booking', 'hi', 'hey', 'inquiry',
])

const FREE_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me',
  'pm.me', 'mail.com', 'gmx.com', 'yandex.com', 'zoho.com',
  'yahoo.co.uk', 'yahoo.ca', 'yahoo.de',
])

// Process-level caches so a 50-email run doesn't make 50 redundant
// DNS lookups for the same domain.
const mxCache = new Map<string, boolean>()
let disposableSet: Set<string> | null = null
let disposableLoadingPromise: Promise<Set<string>> | null = null

async function loadDisposable(): Promise<Set<string>> {
  if (disposableSet) return disposableSet
  if (disposableLoadingPromise) return disposableLoadingPromise

  disposableLoadingPromise = (async () => {
    try {
      const resp = await fetch(
        'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf',
        { signal: AbortSignal.timeout(4000) },
      )
      if (!resp.ok) throw new Error(`status ${resp.status}`)
      const txt = await resp.text()
      const parsed = new Set(
        txt.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean),
      )
      disposableSet = parsed
      return parsed
    } catch {
      // Fall back to a small inline list if GitHub fetch fails.
      const fallback = new Set([
        'mailinator.com', 'tempmail.com', 'temp-mail.org', '10minutemail.com',
        'guerrillamail.com', 'throwaway.email', 'fakeinbox.com', 'getnada.com',
        'yopmail.com', 'maildrop.cc', 'sharklasers.com', 'dispostable.com',
        'trashmail.com', 'mohmal.com', 'mintemail.com', 'tempmailo.com',
      ])
      disposableSet = fallback
      return fallback
    } finally {
      disposableLoadingPromise = null
    }
  })()
  return disposableLoadingPromise
}

async function checkMx(domain: string): Promise<boolean> {
  if (mxCache.has(domain)) return mxCache.get(domain) as boolean
  try {
    const records = await dns.resolveMx(domain)
    const has = records.length > 0
    mxCache.set(domain, has)
    return has
  } catch {
    mxCache.set(domain, false)
    return false
  }
}

export type Verdict = 'deliverable' | 'risky' | 'invalid'

export interface VerifyResult {
  email: string
  score: number
  verdict: Verdict
  flags: string[]
  reason: string
}

export async function verifyEmail(rawEmail: string): Promise<VerifyResult> {
  const email = rawEmail.trim().toLowerCase()
  const flags: string[] = []

  // Format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      email,
      score: 0,
      verdict: 'invalid',
      flags: ['bad_format'],
      reason: 'Email syntax is invalid',
    }
  }

  const [local, domain] = email.split('@')

  let score = 100

  // MX gate — domain must accept mail at all
  const hasMx = await checkMx(domain)
  if (!hasMx) {
    flags.push('no_mx')
    score -= 90
  }

  // Disposable inbox
  const disposable = await loadDisposable()
  if (disposable.has(domain)) {
    flags.push('disposable')
    score -= 90
  }

  // Role / group address (likely unmonitored)
  if (ROLE_LOCALS.has(local)) {
    flags.push('role')
    score -= 30
  }

  // Free-mail provider (signal but not a hard penalty)
  if (FREE_DOMAINS.has(domain)) {
    flags.push('freemail')
    score -= 5
  }

  score = Math.max(0, Math.min(100, score))

  let verdict: Verdict
  if (score >= 70) verdict = 'deliverable'
  else if (score >= 40) verdict = 'risky'
  else verdict = 'invalid'

  let reason: string
  if (flags.length === 0) {
    reason = 'Domain has MX, non-disposable, professional local part'
  } else if (flags.includes('no_mx')) {
    reason = 'Domain has no MX records — cannot accept mail'
  } else if (flags.includes('disposable')) {
    reason = 'Disposable email domain'
  } else {
    const human = flags.map(f => ({
      role: 'role address (often unmonitored)',
      freemail: 'free-mail provider',
    } as Record<string, string>)[f] || f)
    reason = `Notes: ${human.join(', ')}`
  }

  return { email, score, verdict, flags, reason }
}

export async function verifyMany(emails: string[]): Promise<VerifyResult[]> {
  return Promise.all(emails.map(verifyEmail))
}
