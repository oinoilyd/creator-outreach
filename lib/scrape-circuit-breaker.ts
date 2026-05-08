/**
 * Lightweight in-process circuit breaker for external scrape sources
 * (Instagram public profiles, DuckDuckGo). Prevents cascading
 * failures when the upstream rate-limits or IP-bans Vercel.
 *
 * Per-source state:
 *   - failureWindow: last N failure timestamps
 *   - openUntil: timestamp until which calls should short-circuit
 *
 * If `failureCountInWindow(source) >= threshold`, the breaker opens
 * for `cooldownMs`. While open, `shouldSkip()` returns true and the
 * caller bypasses the fetch.
 *
 * NB: per-instance, not shared across Vercel function instances. Good
 * enough for "stop hammering when one user runs into a 429 wall."
 */

interface BreakerState {
  failures: number[] // ts of recent failures, ms epoch
  openUntil: number  // 0 = closed, >0 = closed-until ts
}

const state: Map<string, BreakerState> = new Map()

const DEFAULT_FAILURE_WINDOW_MS = 60_000  // 1 min sliding window
const DEFAULT_FAILURE_THRESHOLD = 5
const DEFAULT_COOLDOWN_MS = 10 * 60_000   // 10 min cooldown

function getState(source: string): BreakerState {
  let s = state.get(source)
  if (!s) {
    s = { failures: [], openUntil: 0 }
    state.set(source, s)
  }
  return s
}

/**
 * Returns true if the circuit is open and the caller should skip the
 * external call entirely.
 */
export function shouldSkip(source: string): boolean {
  const s = getState(source)
  if (s.openUntil === 0) return false
  if (Date.now() < s.openUntil) return true
  // Cooldown elapsed — reset.
  s.openUntil = 0
  s.failures = []
  return false
}

/**
 * Mark a failure for `source`. If we cross the threshold, the
 * breaker opens for `cooldownMs`.
 */
export function recordFailure(
  source: string,
  opts: { windowMs?: number; threshold?: number; cooldownMs?: number } = {},
): void {
  const s = getState(source)
  const now = Date.now()
  const windowMs = opts.windowMs ?? DEFAULT_FAILURE_WINDOW_MS
  const threshold = opts.threshold ?? DEFAULT_FAILURE_THRESHOLD
  const cooldownMs = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS

  const cutoff = now - windowMs
  s.failures = [...s.failures.filter(t => t > cutoff), now]

  if (s.failures.length >= threshold) {
    s.openUntil = now + cooldownMs
    console.warn(`[circuit-breaker] ${source} OPEN until ${new Date(s.openUntil).toISOString()} (${s.failures.length} failures in ${windowMs}ms)`)
  }
}

/** Mark a success — resets the failure window. */
export function recordSuccess(source: string): void {
  const s = getState(source)
  s.failures = []
}

/** Sleep helper for inter-request delays in scrape loops. */
export function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
