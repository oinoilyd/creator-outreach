/**
 * lib/scrape-politeness.ts — small helpers that make our outbound
 * scrape requests look more human and dodge basic anti-bot detection.
 *
 * Two pieces:
 *
 *   1. politeJitter() — sleep a random 500-2000ms (configurable). Use
 *      between scrape requests to space them out. Anti-bot heuristics
 *      look for tight, rhythmic request patterns; randomness defeats
 *      the simplest detectors. Negligible UX cost (the user already
 *      waits seconds for enrichment results).
 *
 *   2. withScrapeBackoff() — wraps a fetch-like call with exponential
 *      backoff on 429 / 403 / 503 / 408 / network errors. Honors
 *      Retry-After when present; otherwise doubles the delay each
 *      retry up to a cap. Surrenders after a few tries so a single
 *      stuck request doesn't tie up a worker.
 *
 * Both are intentionally tiny and dependency-free — they wrap any
 * function returning a Promise<{ status: number, retryAfterSec?: number }>
 * shape that our scrapers already produce (axios responses + custom
 * unavailable returns).
 *
 * 2026-05-10 per Dylan — single biggest 'don't get blocked' trick.
 */

// 2026-05-11 per Dylan: halved jitter range (was 500–2000) to make
// scrape paths feel snappier. Still randomized to defeat simple
// anti-bot rhythm detectors, just on a tighter window. Watch for
// 429s in the enrichment logs — if they spike, bump these back up.
const DEFAULT_MIN_JITTER_MS = 250
const DEFAULT_MAX_JITTER_MS = 1000

// 2026-05-12 per Dylan: platform-aware politeness. Anti-bot models
// differ wildly across platforms — IG is the only one that genuinely
// rewards request-rate slowdown. YouTube's anti-bot is IP reputation
// + account behavior (youtubei.js already handles its own session),
// TikTok / X / LinkedIn use header + behavior fingerprinting more
// than rate, and our generic email-finder hits (creator websites,
// DDG, biolink aggregators) only need light protection against
// the host's own rate limit, not the platform's.
//
// Profiles:
//   youtube  — 0ms jitter, no retry. youtubei.js / public pages.
//   tiktok   — 100–400ms jitter, 1 retry. Fast feedback site.
//   twitter  — 100–400ms jitter, 1 retry.
//   linkedin — 100–400ms jitter, 1 retry. (Most LI traffic is via DDG.)
//   instagram— 250–1000ms jitter, 2 retries (status of the art today).
//   generic  — 100–400ms jitter, 1 retry. Default for unspecified hosts
//              (creator websites, biolink pages, DDG, podcast RSS, etc.).
//
// If 429s spike on a specific profile, bump that one in isolation
// rather than the whole pipeline.
export type ScrapePlatform =
  | 'youtube'
  | 'tiktok'
  | 'twitter'
  | 'linkedin'
  | 'instagram'
  | 'generic'

interface PolitenessProfile {
  /** Min jitter between sequential requests. 0 disables jitter. */
  jitterMinMs: number
  /** Max jitter between sequential requests. */
  jitterMaxMs: number
  /** Retry count for transient failures. 0 disables retries. */
  maxRetries: number
  /** Starting backoff for retries (doubles each attempt). */
  initialDelayMs: number
  /** Status codes that trigger a retry. */
  retryStatuses: number[]
}

const POLITENESS_PROFILES: Record<ScrapePlatform, PolitenessProfile> = {
  // youtubei.js manages its own session; YouTube's public HTML
  // surfaces (About / RSS / /videos / /shorts) don't penalize tight
  // bursts from a single IP — they penalize *account* reputation.
  // Sleeping or retrying here just spends user-perceived time for
  // zero block protection.
  youtube: {
    jitterMinMs: 0,
    jitterMaxMs: 0,
    maxRetries: 0,
    initialDelayMs: 0,
    retryStatuses: [],
  },
  tiktok: {
    jitterMinMs: 100,
    jitterMaxMs: 400,
    maxRetries: 1,
    initialDelayMs: 1000,
    retryStatuses: [429, 503, 504],
  },
  twitter: {
    jitterMinMs: 100,
    jitterMaxMs: 400,
    maxRetries: 1,
    initialDelayMs: 1000,
    retryStatuses: [429, 503, 504],
  },
  linkedin: {
    jitterMinMs: 100,
    jitterMaxMs: 400,
    maxRetries: 1,
    initialDelayMs: 1000,
    retryStatuses: [429, 503, 504],
  },
  // IG is the loudest source of blocks in our logs — keep the
  // existing 250–1000ms window and full 2-retry budget. Touching
  // this is the highest-risk change.
  instagram: {
    jitterMinMs: DEFAULT_MIN_JITTER_MS,
    jitterMaxMs: DEFAULT_MAX_JITTER_MS,
    maxRetries: 2,
    initialDelayMs: 1500,
    retryStatuses: [429, 503, 504],
  },
  generic: {
    jitterMinMs: 100,
    jitterMaxMs: 400,
    maxRetries: 1,
    initialDelayMs: 1000,
    retryStatuses: [429, 503, 504],
  },
}

/**
 * Random sleep — picks a wait between min and max, evenly distributed.
 * Returns a Promise that resolves after the sleep. Call between
 * sequential scrape requests; pair with concurrency limits to keep
 * traffic looking human.
 */
export function politeJitter(
  minMs: number = DEFAULT_MIN_JITTER_MS,
  maxMs: number = DEFAULT_MAX_JITTER_MS,
): Promise<void> {
  const span = Math.max(0, maxMs - minMs)
  const ms = minMs + Math.floor(Math.random() * (span + 1))
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Platform-aware jitter. Resolves immediately for `youtube` (no
 * artificial delay) and uses tighter windows for low-risk hosts.
 * Use in place of bare `politeJitter()` whenever the call site
 * knows which platform it's hitting.
 */
export function politeJitterFor(platform: ScrapePlatform): Promise<void> {
  const p = POLITENESS_PROFILES[platform]
  if (p.jitterMaxMs <= 0) return Promise.resolve()
  return politeJitter(p.jitterMinMs, p.jitterMaxMs)
}

/**
 * Platform-aware backoff wrapper. Picks the retry budget + initial
 * delay from the platform profile. `youtube` skips retries entirely.
 * For one-off / non-platform calls, use `withScrapeBackoff` directly.
 */
export async function withScrapeBackoffFor<T>(
  platform: ScrapePlatform,
  fn: (attempt: number) => Promise<T>,
  overrides: Partial<ScrapeBackoffOptions> = {},
): Promise<T> {
  const profile = POLITENESS_PROFILES[platform]
  return withScrapeBackoff(fn, {
    maxRetries: profile.maxRetries,
    initialDelayMs: profile.initialDelayMs,
    retryStatuses: profile.retryStatuses,
    ...overrides,
  })
}

export interface ScrapeBackoffOptions {
  /** Max retry attempts (default 3 — so 4 total attempts including the first). */
  maxRetries?: number
  /** Starting backoff in ms; doubles each retry (default 1500). */
  initialDelayMs?: number
  /** Cap on the backoff between attempts (default 15s). */
  maxDelayMs?: number
  /** Status codes that trigger a retry. Default: 408, 429, 500, 502, 503, 504. */
  retryStatuses?: number[]
  /** Optional logger called once per retry — useful for telemetry. */
  onRetry?: (attempt: number, reason: string, delayMs: number) => void
}

const DEFAULT_RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504])

/**
 * Run `fn` with exponential backoff on rate-limit / transient errors.
 *
 * `fn` is the actual scrape call. It can either:
 *   • return a value (success — we pass through)
 *   • throw (network error — we retry)
 *   • return an object with `{ status: number, retryAfter?: number }`
 *     — we inspect status to decide whether to retry
 *
 * The helper is generic so it doesn't care if you wrap axios, fetch,
 * or a custom client. It just needs to inspect the response shape.
 *
 * Caller is responsible for deciding what "success" means — if you
 * want to retry on a 200 with empty body, write that check into `fn`
 * and throw to trigger the next retry.
 */
export async function withScrapeBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options: ScrapeBackoffOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3
  const initialDelayMs = options.initialDelayMs ?? 1500
  const maxDelayMs = options.maxDelayMs ?? 15_000
  const retryStatuses = options.retryStatuses
    ? new Set(options.retryStatuses)
    : DEFAULT_RETRY_STATUSES

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn(attempt)
      // Inspect status code if the result exposes one (axios-shape or
      // a custom { status } object). 2xx passes through; retryable
      // statuses trigger backoff. Other 4xx (404, 410, etc.) are
      // permanent — return immediately, don't retry.
      const status = (result as { status?: number } | null)?.status
      if (typeof status === 'number' && retryStatuses.has(status)) {
        if (attempt < maxRetries) {
          // Honor Retry-After header if present (axios surfaces this
          // as response.headers['retry-after']).
          const retryAfterRaw = (result as { headers?: Record<string, string> } | null)?.headers?.['retry-after']
          const retryAfterSec = retryAfterRaw ? parseInt(retryAfterRaw, 10) : NaN
          const delay = Number.isFinite(retryAfterSec)
            ? Math.min(maxDelayMs, retryAfterSec * 1000)
            : Math.min(maxDelayMs, initialDelayMs * Math.pow(2, attempt))
          options.onRetry?.(attempt + 1, `status ${status}`, delay)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
      }
      return result
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        const delay = Math.min(maxDelayMs, initialDelayMs * Math.pow(2, attempt))
        const reason = (err as Error)?.message ?? 'unknown network error'
        options.onRetry?.(attempt + 1, reason, delay)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
  // Should never reach here — the loop returns or throws above.
  throw lastError ?? new Error('withScrapeBackoff exhausted retries')
}
