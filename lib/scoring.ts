import type { Creator, ScoreWeights, GuidanceEntry, SortCol, SortDir } from './types'
import { parseRelativeDays } from './format'
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
  const subs = Number(c.subscribers)
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

  let relRatio = c.matchedVia === 'name' ? 10/15 : 2/15
  if (c.videoTitles?.length > 0) relRatio = Math.min(1, relRatio + 5/15)

  let qualRatio = 5/10
  if (subs > 0 && !isNaN(subs)) {
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
  const subs = Number(c.subscribers)

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

  let relRatio = c.matchedVia === 'name' ? 10/15 : 2/15
  let relNote = c.matchedVia === 'name' ? 'Channel name matched' : 'Related content match'
  if (c.videoTitles?.length > 0) { relRatio = Math.min(1, relRatio + 5/15); relNote += ' + video titles' }
  items.push({ label: 'Relevance', pts: Math.round(relRatio * weights.relevance * norm), max: Math.round(weights.relevance * norm), note: relNote })

  let qRatio = 5/10, qNote = 'No subscriber data'
  if (subs > 0 && !isNaN(subs)) {
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

export function sortCreators(list: Creator[], col: SortCol, dir: SortDir, weights: ScoreWeights = DEFAULT_WEIGHTS, guidanceEntries: GuidanceEntry[] = [], emailFirst: boolean = true): Creator[] {
  return [...list].sort((a, b) => {
    // Email-first primary sort: creators with a discovered email always
    // rank above those without, regardless of which column the user is
    // sorting by. Toggleable via the emailFirst flag (default on per
    // user request — "ones with email start at the top, can be
    // filtered out of but that should default").
    if (emailFirst) {
      const aHas = a.email ? 1 : 0
      const bHas = b.email ? 1 : 0
      if (aHas !== bHas) return bHas - aHas
    }

    if (col === 'email') {
      const pri = contactPriority(b) - contactPriority(a)
      if (pri !== 0) return pri
      return a.channelName.localeCompare(b.channelName)
    }
    let cmp = 0
    if (col === 'fitScore') cmp = computeFitScore(a, weights, guidanceEntries) - computeFitScore(b, weights, guidanceEntries)
    else if (col === 'avgViews') cmp = a.avgViews - b.avgViews
    else if (col === 'channelName') cmp = a.channelName.localeCompare(b.channelName)
    else if (col === 'subscribers') cmp = (Number(a.subscribers) || 0) - (Number(b.subscribers) || 0)
    else if (col === 'lastVideo') {
      const da = parseRelativeDays(a.videoDates?.[0] || '')
      const db = parseRelativeDays(b.videoDates?.[0] || '')
      if (da === Infinity && db === Infinity) cmp = 0
      else if (da === Infinity) return 1
      else if (db === Infinity) return -1
      else cmp = da - db
    }
    else if (col === 'lastShort') {
      const da = parseRelativeDays(a.shortDates?.[0] || '')
      const db = parseRelativeDays(b.shortDates?.[0] || '')
      if (da === Infinity && db === Infinity) cmp = 0
      else if (da === Infinity) return 1
      else if (db === Infinity) return -1
      else cmp = da - db
    }
    else if (col === 'website') cmp = (b.website ? 1 : 0) - (a.website ? 1 : 0)
    else if (col === 'linkedin') {
      const pri = contactPriority(b) - contactPriority(a)
      if (pri !== 0) return pri
      return a.channelName.localeCompare(b.channelName)
    }
    else if (col === 'instagram') cmp = (b.instagram ? 1 : 0) - (a.instagram ? 1 : 0)
    else if (col === 'twitter') cmp = (b.twitter ? 1 : 0) - (a.twitter ? 1 : 0)
    else if (col === 'tiktok') cmp = (b.tiktok ? 1 : 0) - (a.tiktok ? 1 : 0)
    return dir === 'asc' ? cmp : -cmp
  })
}
