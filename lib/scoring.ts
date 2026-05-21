import type { Creator, ScoreWeights, GuidanceEntry, SortCol, SortDir, SortKey } from './types'
import { parseRelativeDays, parseSubscriberCount } from './format'
import { DEFAULT_GUIDANCE_WEIGHT, computeEntryRatio, GUIDANCE_PRESETS } from './guidance'

export const DEFAULT_WEIGHTS: ScoreWeights = { recency: 25, views: 20, reachability: 20, relevance: 15, quality: 10 }

export const WEIGHT_META: { key: keyof ScoreWeights; label: string; description: string }[] = [
  { key: 'recency',     label: 'Recency',          description: 'How recently they posted' },
  { key: 'views',       label: 'Avg Views',         description: 'View count sweet spot (10K–50K ideal)' },
  { key: 'reachability',label: 'Reachability',      description: 'Email and LinkedIn availability' },
  { key: 'relevance',   label: 'Relevance',         description: 'Content match to your search' },
  { key: 'quality',     label: 'Audience Quality',  description: 'Views-to-subscriber engagement ratio' },
]

export function computeFitScore(c: Creator, weights: ScoreWeights = DEFAULT_WEIGHTS, guidanceEntries: GuidanceEntry[] = []): number {
  // c.subscribers is a string ("10K", "1.2M", "10000") — Number()
  // returns NaN for the abbreviated forms. Use parseSubscriberCount.
  const subs = parseSubscriberCount(c.subscribers) ?? 0
  const penalty = subs >= 750000 ? 20 : subs >= 500000 ? 10 : 0

  if (guidanceEntries.length > 0) {
    const guidanceTotal = guidanceEntries.reduce((sum, e) => sum + (e.weight ?? DEFAULT_GUIDANCE_WEIGHT), 0)
    if (guidanceTotal === 0) return 0
    let guidancePts = 0
    for (const entry of guidanceEntries) {
      guidancePts += computeEntryRatio(entry, c) * (entry.weight ?? DEFAULT_GUIDANCE_WEIGHT)
    }
    const raw = (guidancePts / guidanceTotal) * 100
    return Math.min(100, Math.max(0, Math.round(raw - penalty)))
  }

  const wTotal = weights.recency + weights.views + weights.reachability + weights.relevance + weights.quality
  const norm = wTotal > 0 ? 100 / wTotal : 1

  const days = parseRelativeDays(c.videoDates?.[0] || '')
  const recencyRatio = days === Infinity ? 10/30 : days <= 7 ? 1 : days <= 30 ? 22/30 : days <= 60 ? 14/30 : days <= 90 ? 7/30 : 0

  const v = c.avgViews
  const viewsRatio = v >= 10000 && v < 50000 ? 1 : v >= 1000 && v < 10000 ? 20/25 : v >= 50000 && v < 100000 ? 18/25 : v >= 100000 && v < 500000 ? 10/25 : v >= 500000 ? 3/25 : v > 0 ? 5/25 : 0

  const reachRatio = c.email && c.linkedin ? 1 : c.email ? 15/20 : c.linkedin ? 5/20 : 0

  // 'url' / 'handle' = direct lookup. The user typed the exact account
  // — relevance is by definition perfect, don't drag the score down.
  let relRatio = (c.matchedVia === 'url' || c.matchedVia === 'handle')
    ? 1
    : c.matchedVia === 'name' ? 10/15 : 2/15
  if (c.videoTitles?.length > 0) relRatio = Math.min(1, relRatio + 5/15)
  // Continuous keyword-relevance bonus on top of the matchedVia
  // categorical baseline (2026-05-21 per Dylan — "divorce attorney"
  // searches returning "youth coach" channels signaled that the
  // categorical relevance signal was too coarse). c.relevanceScore is
  // the raw "name × 4 + title" count from the server search. We
  // normalize by 20 (a strong keyword match for a 2-3 term query) and
  // cap the bonus at +0.33 so a strong-name-match channel can saturate
  // toward 1.0 even without a url/handle direct lookup.
  if (typeof c.relevanceScore === 'number' && c.relevanceScore > 0) {
    const bonus = Math.min(0.33, c.relevanceScore / 20)
    relRatio = Math.min(1, relRatio + bonus)
  }

  let qualRatio = 5/10
  if (subs > 0) {
    const r = c.avgViews / subs
    qualRatio = r >= 0.10 ? 1 : r >= 0.05 ? 7/10 : r >= 0.02 ? 4/10 : 1/10
  }

  const raw = (
    recencyRatio   * weights.recency      +
    viewsRatio     * weights.views        +
    reachRatio     * weights.reachability +
    relRatio       * weights.relevance    +
    qualRatio      * weights.quality
  ) * norm

  return Math.min(100, Math.max(0, Math.round(raw - penalty)))
}

export function computeFitScoreBreakdown(c: Creator, weights: ScoreWeights = DEFAULT_WEIGHTS, guidanceEntries: GuidanceEntry[] = []): Array<{ label: string; pts: number; max: number; note: string; isGuidance?: boolean }> {
  const items: Array<{ label: string; pts: number; max: number; note: string; isGuidance?: boolean }> = []
  // See computeFitScore — must use parseSubscriberCount, not Number,
  // because c.subscribers is a string that may be "10K"/"1.2M".
  const subs = parseSubscriberCount(c.subscribers) ?? 0

  if (guidanceEntries.length > 0) {
    const guidanceTotal = guidanceEntries.reduce((sum, e) => sum + (e.weight ?? DEFAULT_GUIDANCE_WEIGHT), 0)
    const norm = guidanceTotal > 0 ? 100 / guidanceTotal : 1
    for (const entry of guidanceEntries) {
      const w = entry.weight ?? DEFAULT_GUIDANCE_WEIGHT
      const ratio = computeEntryRatio(entry, c)
      const pts = Math.round(ratio * w * norm)
      const max = Math.round(w * norm)
      const preset = GUIDANCE_PRESETS.find(p => p.entry.text === entry.text)
      const label = preset ? `${preset.emoji} ${preset.label}` : (entry.summary?.slice(0, 30) || 'Custom criterion')
      const note = ratio === 1 ? 'Matched' : ratio > 0 ? 'Partial match' : 'Not matched'
      items.push({ label, pts, max, note, isGuidance: true })
    }
    if (subs >= 750000)      items.push({ label: 'Large channel penalty', pts: -20, max: 0, note: '750K+ subs' })
    else if (subs >= 500000) items.push({ label: 'Large channel penalty', pts: -10, max: 0, note: '500K–750K subs' })
    return items
  }

  const wTotal = weights.recency + weights.views + weights.reachability + weights.relevance + weights.quality
  const norm = wTotal > 0 ? 100 / wTotal : 1

  const days = parseRelativeDays(c.videoDates?.[0] || '')
  let rRatio = 0, rNote = ''
  if (days === Infinity) { rRatio = 10/30; rNote = 'No post date found' }
  else if (days <= 7)  { rRatio = 1;      rNote = c.videoDates?.[0] || '' }
  else if (days <= 30) { rRatio = 22/30;  rNote = c.videoDates?.[0] || '' }
  else if (days <= 60) { rRatio = 14/30;  rNote = c.videoDates?.[0] || '' }
  else if (days <= 90) { rRatio = 7/30;   rNote = c.videoDates?.[0] || '' }
  else                 { rRatio = 0;      rNote = c.videoDates?.[0] || 'Over 90 days ago' }
  items.push({ label: 'Recency', pts: Math.round(rRatio * weights.recency * norm), max: Math.round(weights.recency * norm), note: rNote })

  const v = c.avgViews
  let vRatio = 0, vNote = ''
  if      (v >= 10000  && v < 50000)  { vRatio = 1;     vNote = '10K–50K sweet spot' }
  else if (v >= 1000   && v < 10000)  { vRatio = 20/25; vNote = '1K–10K growing' }
  else if (v >= 50000  && v < 100000) { vRatio = 18/25; vNote = '50K–100K solid' }
  else if (v >= 100000 && v < 500000) { vRatio = 10/25; vNote = '100K–500K large' }
  else if (v >= 500000)               { vRatio = 3/25;  vNote = '500K+ very large' }
  else if (v > 0)                     { vRatio = 5/25;  vNote = 'Under 1K views' }
  items.push({ label: 'Avg Views', pts: Math.round(vRatio * weights.views * norm), max: Math.round(weights.views * norm), note: vNote })

  let cRatio = 0, cNote = ''
  if (c.email && c.linkedin) { cRatio = 1;     cNote = 'Email + LinkedIn' }
  else if (c.email)          { cRatio = 15/20; cNote = 'Email found' }
  else if (c.linkedin)       { cRatio = 5/20;  cNote = 'LinkedIn only' }
  else                       { cRatio = 0;     cNote = 'No contact info' }
  items.push({ label: 'Reachability', pts: Math.round(cRatio * weights.reachability * norm), max: Math.round(weights.reachability * norm), note: cNote })

  let relRatio: number
  let relNote: string
  if (c.matchedVia === 'url' || c.matchedVia === 'handle') {
    // Direct lookup — user typed the exact account.
    relRatio = 1
    relNote = c.matchedVia === 'url' ? 'Direct URL lookup' : 'Direct handle lookup'
  } else if (c.matchedVia === 'name') {
    relRatio = 10/15
    relNote = 'Channel name matched'
  } else {
    relRatio = 2/15
    relNote = 'Related content match'
  }
  if (c.videoTitles?.length > 0) { relRatio = Math.min(1, relRatio + 5/15); relNote += ' + video titles' }
  items.push({ label: 'Relevance', pts: Math.round(relRatio * weights.relevance * norm), max: Math.round(weights.relevance * norm), note: relNote })

  let qRatio = 5/10, qNote = 'No subscriber data'
  if (subs > 0) {
    const ratio = c.avgViews / subs
    if      (ratio >= 0.10) { qRatio = 1;    qNote = `${(ratio*100).toFixed(0)}% views/subs ratio` }
    else if (ratio >= 0.05) { qRatio = 7/10; qNote = `${(ratio*100).toFixed(0)}% views/subs ratio` }
    else if (ratio >= 0.02) { qRatio = 4/10; qNote = `${(ratio*100).toFixed(1)}% views/subs ratio` }
    else                    { qRatio = 1/10; qNote = `${(ratio*100).toFixed(1)}% views/subs ratio (low)` }
  }
  items.push({ label: 'Audience Quality', pts: Math.round(qRatio * weights.quality * norm), max: Math.round(weights.quality * norm), note: qNote })

  if (subs >= 750000)      items.push({ label: 'Large channel penalty', pts: -20, max: 0, note: '750K+ subs' })
  else if (subs >= 500000) items.push({ label: 'Large channel penalty', pts: -10, max: 0, note: '500K–750K subs' })

  return items
}

export function fitScoreMeta(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Strong Fit',   color: 'text-green-400' }
  if (score >= 50) return { label: 'Possible Fit', color: 'text-yellow-400' }
  if (score >= 25) return { label: 'Weak Fit',     color: 'text-orange-400' }
  return              { label: 'Poor Fit',      color: 'text-red-400' }
}

export function contactPriority(c: Creator): number {
  if (c.email) return 3
  if (c.linkedin) return 2
  if (c.enriching) return 1
  return 0
}

/**
 * Per-column comparator. Returns negative / 0 / positive in the
 * "natural ascending" sense — caller flips for desc. Extracted from
 * sortCreators so the multi-key version can chain comparators.
 */
function compareByCol(a: Creator, b: Creator, col: SortCol, weights: ScoreWeights, guidanceEntries: GuidanceEntry[]): number {
  const presence = (has: boolean) => has ? 1 : 0
  // Presence columns: rows with the field rank ABOVE rows without —
  // intentionally inverted (b - a) so "asc" still feels like "best
  // first". The caller then flips again for desc.
  if (col === 'email')          return presence(!!b.email)     - presence(!!a.email)
  if (col === 'linkedin')       return presence(!!b.linkedin)  - presence(!!a.linkedin)
  if (col === 'website')        return presence(!!b.website)   - presence(!!a.website)
  if (col === 'instagram')      return presence(!!b.instagram) - presence(!!a.instagram)
  if (col === 'twitter')        return presence(!!b.twitter)   - presence(!!a.twitter)
  if (col === 'tiktok')         return presence(!!b.tiktok)    - presence(!!a.tiktok)
  if (col === 'fitScore')       return computeFitScore(a, weights, guidanceEntries) - computeFitScore(b, weights, guidanceEntries)
  if (col === 'avgViews')       return a.avgViews - b.avgViews
  if (col === 'channelName')    return a.channelName.localeCompare(b.channelName)
  if (col === 'subscribers')    return (parseSubscriberCount(a.subscribers) ?? 0) - (parseSubscriberCount(b.subscribers) ?? 0)
  if (col === 'lastVideo' || col === 'lastShort') {
    const dates = col === 'lastVideo' ? [a.videoDates?.[0] || '', b.videoDates?.[0] || ''] : [a.shortDates?.[0] || '', b.shortDates?.[0] || '']
    const da = parseRelativeDays(dates[0])
    const db = parseRelativeDays(dates[1])
    if (da === Infinity && db === Infinity) return 0
    if (da === Infinity) return 1
    if (db === Infinity) return -1
    return da - db
  }
  return 0
}

const PRESENCE_COLS: ReadonlySet<SortCol> = new Set(['email', 'linkedin', 'website', 'instagram', 'twitter', 'tiktok'])

/**
 * Multi-column sort. Pass either a single col/dir pair (legacy) or
 * an array of SortKey for chained sorts.
 *
 * Multi-key behaviour: sorts[0] is the highest-priority key. The
 * comparator iterates in order and returns the first non-zero
 * comparison. Stable on channel name as a final tie-break.
 *
 * `emailFirst` still applies as the absolute top-level sort —
 * creators with a discovered email always rank above those without,
 * regardless of which columns are sort-chained, so the high-value
 * leads stay surfaced.
 */
export function sortCreators(
  list: Creator[],
  colOrSorts: SortCol | SortKey[],
  dir: SortDir = 'desc',
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  guidanceEntries: GuidanceEntry[] = [],
  emailFirst: boolean = true,
): Creator[] {
  const sorts: SortKey[] = Array.isArray(colOrSorts)
    ? colOrSorts
    : [{ col: colOrSorts, dir }]

  return [...list].sort((a, b) => {
    if (emailFirst) {
      const aHas = a.email ? 1 : 0
      const bHas = b.email ? 1 : 0
      if (aHas !== bHas) return bHas - aHas
    }

    for (const { col, dir } of sorts) {
      let cmp = compareByCol(a, b, col, weights, guidanceEntries)
      // Presence-only ties get a name-asc subsort so the "has X" and
      // "missing X" groups don't look randomly shuffled.
      if (cmp === 0 && PRESENCE_COLS.has(col)) {
        cmp = a.channelName.localeCompare(b.channelName)
      }
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
    }

    // Fully tied — final stable subsort by channel name.
    return a.channelName.localeCompare(b.channelName)
  })
}
