/**
 * All persistence calls go through this module so the storage backend can be
 * swapped (localStorage today, Supabase later) without changing call sites.
 *
 * Every function is async — even though localStorage is synchronous — so the
 * Supabase migration becomes a one-file change rather than a sprawling refactor.
 */

import type {
  OutreachEntry, Creator, ScoreWeights, GuidanceEntry,
  ColConfig, OutreachColConfig, PlatformId,
} from './types'
import { DEFAULT_WEIGHTS } from './scoring'

const isClient = () => typeof window !== 'undefined'

function safeGet(key: string): string | null {
  if (!isClient()) return null
  try { return localStorage.getItem(key) } catch { return null }
}

function safeSet(key: string, value: string): void {
  if (!isClient()) return
  try { localStorage.setItem(key, value) } catch { /* ignore quota/incognito errors */ }
}

function safeRemove(key: string): void {
  if (!isClient()) return
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

// ── Outreach entries ────────────────────────────────────────────────────────

export async function getOutreach(): Promise<OutreachEntry[]> {
  const raw = safeGet('creator-outreach')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export async function saveOutreach(entries: OutreachEntry[]): Promise<void> {
  safeSet('creator-outreach', JSON.stringify(entries))
}

// ── Dismissed creators ──────────────────────────────────────────────────────

export async function getDismissed(): Promise<Creator[]> {
  const raw = safeGet('creator-dismissed')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export async function saveDismissed(items: Creator[]): Promise<void> {
  safeSet('creator-dismissed', JSON.stringify(items))
}

// ── Column configurations ───────────────────────────────────────────────────

export async function getColConfig(): Promise<ColConfig[] | null> {
  const raw = safeGet('creator-col-config')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

export async function saveColConfig(config: ColConfig[]): Promise<void> {
  safeSet('creator-col-config', JSON.stringify(config))
}

export async function getOutreachColConfig(): Promise<OutreachColConfig[] | null> {
  const raw = safeGet('outreach-col-config')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

export async function saveOutreachColConfig(config: OutreachColConfig[]): Promise<void> {
  safeSet('outreach-col-config', JSON.stringify(config))
}

// ── Per-platform scoring state ──────────────────────────────────────────────

export async function savePlatformWeights(platform: PlatformId, weights: ScoreWeights): Promise<void> {
  safeSet(`creator-score-weights-${platform}`, JSON.stringify(weights))
}

export async function savePlatformNarrative(platform: PlatformId, narrative: string): Promise<void> {
  safeSet(`creator-score-narrative-${platform}`, narrative)
}

export async function savePlatformGuidance(platform: PlatformId, entries: GuidanceEntry[]): Promise<void> {
  safeSet(`creator-guidance-entries-${platform}`, JSON.stringify(entries))
}

export async function clearPlatformGuidance(platform: PlatformId): Promise<void> {
  safeRemove(`creator-guidance-entries-${platform}`)
}

export async function loadPlatformState(platform: PlatformId): Promise<{
  weights: ScoreWeights
  narrative: string
  guidance: GuidanceEntry[]
}> {
  let weights: ScoreWeights = DEFAULT_WEIGHTS
  let narrative = ''
  let guidance: GuidanceEntry[] = []
  try {
    const raw = safeGet(`creator-score-weights-${platform}`)
    const w = raw ? JSON.parse(raw) : null
    if (w) weights = w
  } catch { /* ignore */ }
  narrative = safeGet(`creator-score-narrative-${platform}`) || ''
  try {
    const raw = safeGet(`creator-guidance-entries-${platform}`)
    const g = raw ? JSON.parse(raw) : null
    if (Array.isArray(g)) guidance = g
  } catch { /* ignore */ }
  return { weights, narrative, guidance }
}

// ── One-time legacy key migration ───────────────────────────────────────────
// Pre-platform-toggle, the keys had no platform suffix. Migrate them to the
// "youtube" namespace once on first load so existing users don't lose data.

export async function migrateLegacyKeys(): Promise<void> {
  if (!isClient()) return
  const legacyWeights = safeGet('creator-score-weights')
  if (legacyWeights && !safeGet('creator-score-weights-youtube')) {
    safeSet('creator-score-weights-youtube', legacyWeights)
    safeRemove('creator-score-weights')
  }
  const legacyNarrative = safeGet('creator-score-narrative')
  if (legacyNarrative && !safeGet('creator-score-narrative-youtube')) {
    safeSet('creator-score-narrative-youtube', legacyNarrative)
    safeRemove('creator-score-narrative')
  }
  const legacyGuidance = safeGet('creator-guidance-entries')
  if (legacyGuidance && !safeGet('creator-guidance-entries-youtube')) {
    safeSet('creator-guidance-entries-youtube', legacyGuidance)
    safeRemove('creator-guidance-entries')
  }
}
