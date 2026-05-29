/**
 * Admin-only live health check across every external integration the
 * app depends on. Each check runs in parallel with a 5s hard timeout
 * so the panel always responds within ~5s even if one upstream is
 * fully wedged.
 *
 * Returned shape per integration:
 *   {
 *     name: string                   // human label, e.g. "Meta Graph API"
 *     id: string                     // stable id for UI keys
 *     category: 'data' | 'auth' | 'ai' | 'comms' | 'queue' | 'cache' | 'db'
 *     status: 'ok' | 'degraded' | 'down' | 'not_configured' | 'unknown'
 *     latencyMs: number | null       // null on not_configured/down-with-no-response
 *     detail: string                 // human-readable; surfaces the error
 *     fragility: 'low' | 'medium' | 'high'   // how breakable this is
 *     fragilityReason: string        // why it's fragile (HTML changes etc)
 *     checkedAt: string              // ISO timestamp
 *   }
 *
 * The 'fragility' field is the panel's main job — Dylan wants to know
 * "if I see this go red, what kind of break is it?" High-fragility
 * items (Instagram scrape, anything HTML-shape dependent) get flagged
 * explicitly so Dylan can notify me to investigate.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { forbidIfNotAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'
import { cacheGet, cacheSet } from '@/lib/cache'

export const dynamic = 'force-dynamic'

type Status = 'ok' | 'degraded' | 'down' | 'not_configured' | 'unknown'
type Fragility = 'low' | 'medium' | 'high'

interface CheckResult {
  name: string
  id: string
  category: 'data' | 'auth' | 'ai' | 'comms' | 'queue' | 'cache' | 'db'
  status: Status
  latencyMs: number | null
  detail: string
  fragility: Fragility
  fragilityReason: string
  checkedAt: string
}

const PER_CHECK_TIMEOUT_MS = 5_000

/** Wrap a promise in a timeout. Returns the resolved value or throws
 *  AbortError-like with a clear message after the deadline. */
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ])
}

/** Run a single check, measure latency, normalise errors into a
 *  CheckResult shape. Never throws — failures become status: down.
 *
 *  A probe can return `notConfigured: true` to signal "this key/service
 *  isn't set up in THIS environment" — which is neutral (gray), not a
 *  real outage (amber/red). Critical for localhost, where most prod
 *  keys legitimately aren't in .env.local; without this, the panel
 *  screams "6 degraded" when nothing is actually broken (Dylan
 *  2026-05-26). */
async function runCheck(
  spec: Omit<CheckResult, 'status' | 'latencyMs' | 'detail' | 'checkedAt'> & {
    probe: () => Promise<{ ok: boolean; detail: string; notConfigured?: boolean }>
  },
): Promise<CheckResult> {
  const start = Date.now()
  const checkedAt = new Date().toISOString()
  try {
    const res = await withTimeout(spec.probe(), PER_CHECK_TIMEOUT_MS, spec.name)
    const latencyMs = Date.now() - start
    const status: Status = res.notConfigured ? 'not_configured' : res.ok ? 'ok' : 'degraded'
    return {
      name: spec.name,
      id: spec.id,
      category: spec.category,
      fragility: spec.fragility,
      fragilityReason: spec.fragilityReason,
      status,
      latencyMs: res.notConfigured ? null : latencyMs,
      detail: res.detail,
      checkedAt,
    }
  } catch (e) {
    const latencyMs = Date.now() - start
    const msg = e instanceof Error ? e.message : String(e)
    return {
      name: spec.name,
      id: spec.id,
      category: spec.category,
      fragility: spec.fragility,
      fragilityReason: spec.fragilityReason,
      status: 'down',
      latencyMs,
      detail: msg,
      checkedAt,
    }
  }
}

export async function GET(_req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbidden = forbidIfNotAdmin(auth)
  if (forbidden) return forbidden

  // Each check is async + bounded. We fire them all in parallel so the
  // whole panel responds within ~5s worst case (the per-check timeout).
  const checks = await Promise.all([
    // ── DB ────────────────────────────────────────────────────────
    runCheck({
      name: 'Supabase (DB)',
      id: 'supabase',
      category: 'db',
      fragility: 'low',
      fragilityReason: 'Managed service; downtime is rare and visible on status.supabase.com.',
      probe: async () => {
        const supabase = await createClient()
        const { error } = await supabase.from('user_preferences').select('user_id').limit(1)
        if (error) return { ok: false, detail: `query error: ${error.message}` }
        return { ok: true, detail: 'SELECT roundtrip OK' }
      },
    }),

    // ── Cache (Upstash Redis) ─────────────────────────────────────
    runCheck({
      name: 'Upstash Redis (cache)',
      id: 'redis',
      category: 'cache',
      fragility: 'low',
      fragilityReason: 'Managed KV store; rare outages, recovers on its own.',
      probe: async () => {
        // Sentinel must be NON-numeric. Upstash's REST client
        // auto-JSON-parses on read, so a bare numeric string like
        // Date.now().toString() ("1780015224922") comes back as the
        // NUMBER 1780015224922 — and the strict !== fails on type
        // (string vs number), reporting a phantom "roundtrip mismatch"
        // even though Redis is perfectly healthy. Prefixing with a
        // non-numeric token keeps JSON-parse from coercing it.
        // (Dylan 2026-05-26 — this was firing degraded on prod too.)
        const key = 'health:ping'
        const value = `ok-${Date.now()}`
        await cacheSet(key, value, 60)
        const got = await cacheGet<string>(key)
        if (String(got) !== value) return { ok: false, detail: `roundtrip mismatch (got=${got})` }
        return { ok: true, detail: 'SET+GET roundtrip OK' }
      },
    }),

    // ── QStash (job queue) ────────────────────────────────────────
    runCheck({
      name: 'Upstash QStash (worker queue)',
      id: 'qstash',
      category: 'queue',
      fragility: 'low',
      fragilityReason: 'Managed queue; we only enqueue, never poll. QStash retries on its own.',
      probe: async () => {
        const token = process.env.QSTASH_TOKEN
        const signing = process.env.QSTASH_CURRENT_SIGNING_KEY
        if (!token || !signing) {
          return { ok: false, notConfigured: true, detail: 'QSTASH_TOKEN or QSTASH_CURRENT_SIGNING_KEY not set in this environment' }
        }
        // We don't enqueue a real job — that would publish nothing
        // useful. We just verify the env-key pair is present.
        // Genuine QStash outages surface via failed enqueue calls
        // in /api/enrich logs.
        return { ok: true, detail: 'env keys present' }
      },
    }),

    // ── Meta Instagram Graph API ─────────────────────────────────
    runCheck({
      name: 'Meta Instagram Graph API',
      id: 'meta-graph',
      category: 'data',
      fragility: 'medium',
      fragilityReason: 'Meta rotates tokens + tightens rate limits; expect ~yearly token refreshes.',
      probe: async () => {
        const igBusinessId = process.env.META_IG_BUSINESS_ID
        const token = process.env.META_LONG_LIVED_TOKEN
        if (!igBusinessId || !token) {
          return { ok: false, notConfigured: true, detail: 'META_IG_BUSINESS_ID or META_LONG_LIVED_TOKEN not set — IG metrics fall back to public scrape until configured' }
        }
        // Ping the IG Business account node — cheap, no Business Discovery
        // call. Returns id+username if token is valid; error otherwise.
        const url = `https://graph.facebook.com/v22.0/${igBusinessId}?fields=id,username&access_token=${encodeURIComponent(token)}`
        const res = await fetch(url, { method: 'GET' })
        const data = await res.json().catch(() => ({}))
        if (data.error) {
          return { ok: false, detail: `code=${data.error.code}: ${data.error.message}` }
        }
        if (!data.id) return { ok: false, detail: 'unexpected response shape' }
        return { ok: true, detail: `authenticated as @${data.username}` }
      },
    }),

    // ── Instagram public scrape (fallback path) ───────────────────
    runCheck({
      name: 'Instagram public-page scrape',
      id: 'ig-scrape',
      category: 'data',
      fragility: 'high',
      fragilityReason: 'We parse public IG page HTML. Instagram changes their layout / inserts login walls without warning — when this goes red, the scrape selector probably needs updating.',
      probe: async () => {
        // Hit instagram.com root (not a profile page — those rate-limit
        // aggressively). The root reliably serves a small HTML
        // document; we check the response is HTML + 200.
        const res = await fetch('https://www.instagram.com/', {
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreatorOutreach-Healthcheck/1.0)' },
        })
        if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
        const text = await res.text()
        if (text.length < 1000) return { ok: false, detail: `response too small (${text.length} bytes — probable login wall)` }
        if (!text.includes('<html')) return { ok: false, detail: 'response is not HTML' }
        return { ok: true, detail: `HTML response ${text.length} bytes` }
      },
    }),

    // ── YouTube Data API ─────────────────────────────────────────
    runCheck({
      name: 'YouTube Data API',
      id: 'youtube',
      category: 'data',
      fragility: 'low',
      fragilityReason: 'Stable Google API; quota is the main concern, not breakage.',
      probe: async () => {
        const key = process.env.YOUTUBE_API_KEY
        if (!key) return { ok: false, notConfigured: true, detail: 'YOUTUBE_API_KEY not set in this environment' }
        // Smallest possible search: ?part=id&q=test&maxResults=1
        // Costs 100 quota units (search.list always does); we have
        // plenty of headroom and this is admin-only.
        const url = `https://www.googleapis.com/youtube/v3/search?part=id&q=test&maxResults=1&key=${key}`
        const res = await fetch(url)
        const data = await res.json().catch(() => ({}))
        if (data.error) {
          return { ok: false, detail: `${data.error.code}: ${data.error.message}` }
        }
        if (!Array.isArray(data.items)) return { ok: false, detail: 'unexpected response shape' }
        return { ok: true, detail: 'search.list OK' }
      },
    }),

    // ── Anthropic (Claude) ───────────────────────────────────────
    runCheck({
      name: 'Anthropic API (Claude)',
      id: 'anthropic',
      category: 'ai',
      fragility: 'low',
      fragilityReason: 'API stable; key rotations are the most common issue.',
      probe: async () => {
        const key = process.env.ANTHROPIC_API_KEY
        if (!key) return { ok: false, notConfigured: true, detail: 'ANTHROPIC_API_KEY not set in this environment' }
        // Tiny token-count check — much cheaper than actually generating.
        const res = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            messages: [{ role: 'user', content: 'ping' }],
          }),
        })
        if (res.status === 401) return { ok: false, detail: 'auth failed (key rotated?)' }
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          return { ok: false, detail: `HTTP ${res.status}: ${text.slice(0, 120)}` }
        }
        return { ok: true, detail: 'token-count endpoint OK' }
      },
    }),

    // ── Stripe ───────────────────────────────────────────────────
    runCheck({
      name: 'Stripe (payments)',
      id: 'stripe',
      category: 'comms',
      fragility: 'low',
      fragilityReason: 'Highly reliable; webhook secret rotation is the main concern.',
      probe: async () => {
        const key = process.env.STRIPE_SECRET_KEY
        if (!key) return { ok: false, notConfigured: true, detail: 'STRIPE_SECRET_KEY not set in this environment' }
        // accounts/balance — cheapest authenticated call.
        const res = await fetch('https://api.stripe.com/v1/balance', {
          headers: { Authorization: `Bearer ${key}` },
        })
        if (res.status === 401) return { ok: false, detail: 'auth failed (key rotated?)' }
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          return { ok: false, detail: `HTTP ${res.status}: ${text.slice(0, 120)}` }
        }
        return { ok: true, detail: 'balance endpoint OK' }
      },
    }),

    // ── Unipile (email/LinkedIn) ─────────────────────────────────
    runCheck({
      name: 'Unipile (email + LinkedIn)',
      id: 'unipile',
      category: 'comms',
      fragility: 'medium',
      fragilityReason: 'Third-party messaging gateway; outages happen; token may need refresh.',
      probe: async () => {
        const apiKey = process.env.UNIPILE_API_KEY
        const dsn = process.env.UNIPILE_DSN
        if (!apiKey || !dsn) return { ok: false, notConfigured: true, detail: 'UNIPILE_API_KEY or UNIPILE_DSN not set in this environment' }
        const res = await fetch(`${dsn}/api/v1/accounts`, {
          headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
        })
        if (res.status === 401) return { ok: false, detail: 'auth failed' }
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          return { ok: false, detail: `HTTP ${res.status}: ${text.slice(0, 120)}` }
        }
        return { ok: true, detail: 'accounts endpoint OK' }
      },
    }),

    // ── Resend (transactional email) ─────────────────────────────
    runCheck({
      name: 'Resend (transactional email)',
      id: 'resend',
      category: 'comms',
      fragility: 'low',
      fragilityReason: 'API stable; key/domain verification is the main concern.',
      probe: async () => {
        const key = process.env.RESEND_API_KEY
        if (!key) return { ok: false, notConfigured: true, detail: 'RESEND_API_KEY not set in this environment' }
        // /domains is the cheapest authenticated read.
        const res = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${key}` },
        })
        if (res.status === 401) return { ok: false, detail: 'auth failed (key rotated?)' }
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          return { ok: false, detail: `HTTP ${res.status}: ${text.slice(0, 120)}` }
        }
        return { ok: true, detail: 'domains endpoint OK' }
      },
    }),
  ])

  return NextResponse.json({ checks, generatedAt: new Date().toISOString() })
}
