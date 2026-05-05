/**
 * Persistence layer.
 *
 * All read/write of user data goes through here. Backend: Supabase.
 * Public function signatures match the original localStorage-backed
 * version, so call sites in page.tsx don't need to change.
 *
 * On first sign-in, migrateLocalStorageToSupabase() seeds the user's
 * Supabase row with anything found in their browser's localStorage.
 */

import { createClient } from './supabase/client'
import type {
  OutreachEntry, Creator, ScoreWeights, GuidanceEntry,
  ColConfig, OutreachColConfig, PlatformId,
} from './types'
import { DEFAULT_WEIGHTS } from './scoring'

const isClient = () => typeof window !== 'undefined'

async function userId(): Promise<string | null> {
  if (!isClient()) return null
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ── OutreachEntry mapping (camelCase ↔ snake_case) ─────────────────────────

function rowToOutreach(r: any): OutreachEntry {
  return {
    id: r.id,
    channelId: r.channel_id,
    channelName: r.channel_name,
    channelUrl: r.channel_url,
    description: r.description ?? '',
    email: r.email ?? '',
    product: r.product ?? '',
    reachedOut: !!r.reached_out,
    medium: (r.medium ?? '') as OutreachEntry['medium'],
    mediumOther: r.medium_other ?? '',
    headerUsed: r.header_used ?? '',
    status: (r.status ?? '') as OutreachEntry['status'],
    addedAt: Number(r.added_at) || 0,
    notes: r.notes ?? '',
    followUpDate: r.follow_up_date ?? '',
    dateReachedOut: r.date_reached_out ?? '',
    touchpoints: r.touchpoints ?? '',
    responseDate: r.response_date ?? '',
    subscribers: r.subscribers ?? '',
    avgViews: r.avg_views ?? 0,
    fitScore: r.fit_score ?? 0,
    linkedin: r.linkedin ?? '',
    contentNiche: r.content_niche ?? '',
    phone: r.phone ?? '',
    dealValue: r.deal_value ?? '',
    contractSent: !!r.contract_sent,
    meetingScheduled: r.meeting_scheduled ?? '',
  }
}

function outreachToRow(e: OutreachEntry, uid: string) {
  return {
    id: e.id,
    user_id: uid,
    channel_id: e.channelId,
    channel_name: e.channelName,
    channel_url: e.channelUrl,
    description: e.description,
    email: e.email,
    product: e.product,
    reached_out: e.reachedOut,
    medium: e.medium,
    medium_other: e.mediumOther,
    header_used: e.headerUsed,
    status: e.status,
    notes: e.notes,
    follow_up_date: e.followUpDate,
    date_reached_out: e.dateReachedOut,
    touchpoints: e.touchpoints,
    response_date: e.responseDate,
    subscribers: e.subscribers,
    avg_views: e.avgViews,
    fit_score: e.fitScore,
    linkedin: e.linkedin,
    content_niche: e.contentNiche,
    phone: e.phone,
    deal_value: e.dealValue,
    contract_sent: e.contractSent,
    meeting_scheduled: e.meetingScheduled,
    added_at: e.addedAt,
  }
}

// ── Outreach entries ────────────────────────────────────────────────────────

export async function getOutreach(): Promise<OutreachEntry[]> {
  const uid = await userId()
  if (!uid) {
    console.warn('[getOutreach] no user; returning []')
    return []
  }
  const supabase = createClient()
  const { data, error } = await supabase
    .from('outreach_entries')
    .select('*')
    .order('added_at', { ascending: false })
  if (error) console.error('[getOutreach] read failed:', error.message)
  console.log(`[getOutreach] returned ${data?.length ?? 0} rows`)
  return (data ?? []).map(rowToOutreach)
}

export async function saveOutreach(entries: OutreachEntry[]): Promise<void> {
  const uid = await userId()
  if (!uid) {
    console.warn('[saveOutreach] no user; skipping')
    return
  }
  const supabase = createClient()
  const newIds = new Set(entries.map(e => e.id))

  // Delete rows no longer in the list
  const { data: existing } = await supabase
    .from('outreach_entries')
    .select('id')
    .eq('user_id', uid)
  const toDelete = (existing ?? []).filter(r => !newIds.has(r.id)).map(r => r.id)
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from('outreach_entries').delete().in('id', toDelete)
    if (delErr) console.error('[saveOutreach] delete failed:', delErr.message)
  }

  // Upsert the rest
  if (entries.length > 0) {
    const { error: upErr } = await supabase
      .from('outreach_entries')
      .upsert(entries.map(e => outreachToRow(e, uid)), { onConflict: 'id' })
    if (upErr) console.error('[saveOutreach] upsert failed:', upErr.message, upErr)
  }
}

// ── Dismissed creators ──────────────────────────────────────────────────────

export async function getDismissed(): Promise<Creator[]> {
  const uid = await userId()
  if (!uid) {
    console.warn('[getDismissed] no user; returning []')
    return []
  }
  const supabase = createClient()
  const { data, error } = await supabase
    .from('dismissed_creators')
    .select('data, dismissed_at')
    .order('dismissed_at', { ascending: false })
  if (error) console.error('[getDismissed] read failed:', error.message)
  console.log(`[getDismissed] returned ${data?.length ?? 0} rows`)
  return (data ?? []).map(r => r.data as Creator)
}

export async function saveDismissed(items: Creator[]): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const supabase = createClient()
  const newIds = new Set(items.map(c => c.channelId))

  const { data: existing } = await supabase
    .from('dismissed_creators')
    .select('channel_id')
    .eq('user_id', uid)
  const toDelete = (existing ?? []).filter(r => !newIds.has(r.channel_id)).map(r => r.channel_id)
  if (toDelete.length > 0) {
    await supabase
      .from('dismissed_creators')
      .delete()
      .eq('user_id', uid)
      .in('channel_id', toDelete)
  }

  if (items.length > 0) {
    const { error: upErr } = await supabase
      .from('dismissed_creators')
      .upsert(
        items.map(c => ({ user_id: uid, channel_id: c.channelId, data: c })),
        { onConflict: 'user_id,channel_id' },
      )
    if (upErr) console.error('[saveDismissed] upsert failed:', upErr.message, upErr)
  }
}

// ── Column configurations ───────────────────────────────────────────────────

export async function getColConfig(): Promise<ColConfig[] | null> {
  const uid = await userId()
  if (!uid) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('user_preferences')
    .select('col_config')
    .eq('user_id', uid)
    .single()
  return (data?.col_config as ColConfig[] | null) ?? null
}

export async function saveColConfig(config: ColConfig[]): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const supabase = createClient()
  await supabase.from('user_preferences').update({ col_config: config }).eq('user_id', uid)
}

export async function getOutreachColConfig(): Promise<OutreachColConfig[] | null> {
  const uid = await userId()
  if (!uid) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('user_preferences')
    .select('outreach_col_config')
    .eq('user_id', uid)
    .single()
  return (data?.outreach_col_config as OutreachColConfig[] | null) ?? null
}

export async function saveOutreachColConfig(config: OutreachColConfig[]): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const supabase = createClient()
  await supabase.from('user_preferences').update({ outreach_col_config: config }).eq('user_id', uid)
}

// ── Per-platform scoring state (read-modify-write on platform_state JSONB) ──

async function getPlatformState(uid: string): Promise<Record<string, { weights?: ScoreWeights; narrative?: string; guidance?: GuidanceEntry[] }>> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_preferences')
    .select('platform_state')
    .eq('user_id', uid)
    .single()
  return (data?.platform_state as any) ?? {}
}

async function setPlatformState(uid: string, ps: Record<string, any>): Promise<void> {
  const supabase = createClient()
  await supabase.from('user_preferences').update({ platform_state: ps }).eq('user_id', uid)
}

export async function savePlatformWeights(platform: PlatformId, weights: ScoreWeights): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const ps = await getPlatformState(uid)
  ps[platform] = { ...(ps[platform] ?? {}), weights }
  await setPlatformState(uid, ps)
}

export async function savePlatformNarrative(platform: PlatformId, narrative: string): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const ps = await getPlatformState(uid)
  ps[platform] = { ...(ps[platform] ?? {}), narrative }
  await setPlatformState(uid, ps)
}

export async function savePlatformGuidance(platform: PlatformId, entries: GuidanceEntry[]): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const ps = await getPlatformState(uid)
  ps[platform] = { ...(ps[platform] ?? {}), guidance: entries }
  await setPlatformState(uid, ps)
}

export async function clearPlatformGuidance(platform: PlatformId): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const ps = await getPlatformState(uid)
  if (ps[platform]) {
    ps[platform] = { ...ps[platform], guidance: [] }
    await setPlatformState(uid, ps)
  }
}

export async function loadPlatformState(platform: PlatformId): Promise<{
  weights: ScoreWeights
  narrative: string
  guidance: GuidanceEntry[]
}> {
  const uid = await userId()
  if (!uid) return { weights: DEFAULT_WEIGHTS, narrative: '', guidance: [] }
  const ps = await getPlatformState(uid)
  const slot = ps[platform] ?? {}
  return {
    weights: (slot.weights as ScoreWeights | undefined) ?? DEFAULT_WEIGHTS,
    narrative: slot.narrative ?? '',
    guidance: (slot.guidance as GuidanceEntry[] | undefined) ?? [],
  }
}

// ── One-time localStorage → Supabase migration ──────────────────────────────
// Runs once per user on first sign-in. If the user already has Supabase data
// (any outreach row, or platform_state with content), we skip — they've
// already migrated or are starting fresh on a new device.

const PLATFORMS: PlatformId[] = ['youtube', 'instagram', 'tiktok', 'twitter', 'linkedin']
const BACKUP_KEY = 'creator-supabase-migration-backup'

function lsGet(key: string): string | null {
  if (!isClient()) return null
  try { return localStorage.getItem(key) } catch { return null }
}

/**
 * Snapshot all relevant localStorage keys into a single backup blob.
 * Stored under BACKUP_KEY so the original data is recoverable even if
 * migration fails halfway.
 */
function createMigrationBackup(): { snapshot: Record<string, string>; backupExists: boolean } {
  if (!isClient()) return { snapshot: {}, backupExists: false }
  const snapshot: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k === BACKUP_KEY) continue
      if (!k.startsWith('creator-') && !k.startsWith('outreach-')) continue
      const v = localStorage.getItem(k)
      if (v != null) snapshot[k] = v
    }
    if (Object.keys(snapshot).length > 0) {
      const existing = localStorage.getItem(BACKUP_KEY)
      // Only overwrite backup if we don't already have one — first backup is safest
      if (!existing) {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(snapshot))
      }
    }
  } catch { /* ignore */ }
  return { snapshot, backupExists: !!localStorage.getItem(BACKUP_KEY) }
}

export function hasMigrationBackup(): boolean {
  if (!isClient()) return false
  try { return !!localStorage.getItem(BACKUP_KEY) } catch { return false }
}

const SKIP_PROMPT_KEY = 'creator-supabase-migration-prompt-skipped'

export function getMigrationSkipped(): boolean {
  if (!isClient()) return false
  try { return localStorage.getItem(SKIP_PROMPT_KEY) === '1' } catch { return false }
}

export function setMigrationSkipped(): void {
  if (!isClient()) return
  try { localStorage.setItem(SKIP_PROMPT_KEY, '1') } catch { /* ignore */ }
}

/**
 * Count what's in localStorage waiting to be migrated. Used by the manual
 * "Import your saved data?" prompt. Returns zero counts if nothing's there.
 */
export function getPendingMigrationCounts(): { outreach: number; dismissed: number; hasAny: boolean } {
  if (!isClient()) return { outreach: 0, dismissed: 0, hasAny: false }
  let outreach = 0, dismissed = 0
  try {
    const o = lsGet('creator-outreach')
    if (o) {
      const arr = JSON.parse(o)
      if (Array.isArray(arr)) outreach = arr.length
    }
  } catch { /* ignore */ }
  try {
    const d = lsGet('creator-dismissed')
    if (d) {
      const arr = JSON.parse(d)
      if (Array.isArray(arr)) dismissed = arr.length
    }
  } catch { /* ignore */ }
  // hasAny also covers other migrate-able keys (preferences, platform state)
  let hasOther = false
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k === BACKUP_KEY || k === SKIP_PROMPT_KEY) continue
      if (k.startsWith('creator-') || k.startsWith('outreach-')) {
        hasOther = true
        break
      }
    }
  } catch { /* ignore */ }
  return { outreach, dismissed, hasAny: outreach > 0 || dismissed > 0 || hasOther }
}

/**
 * The user-triggered version of the migration. Same logic as the auto
 * migration but always runs (no "skip if Supabase has data" check),
 * called from the manual prompt. Returns a status the modal can display.
 */
export async function runManualMigration(): Promise<{ ok: boolean; message: string }> {
  const uid = await userId()
  if (!uid) return { ok: false, message: 'Not signed in.' }
  if (!isClient()) return { ok: false, message: 'Not running in a browser.' }

  // Take a backup first (no-op if one already exists)
  createMigrationBackup()

  let outreachSaved = 0, dismissedSaved = 0
  let messages: string[] = []

  try {
    const raw = lsGet('creator-outreach')
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length > 0) {
        await saveOutreach(arr as OutreachEntry[])
        outreachSaved = arr.length
      }
    }
  } catch (e: any) { messages.push(`Outreach error: ${e?.message || e}`) }

  try {
    const raw = lsGet('creator-dismissed')
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length > 0) {
        await saveDismissed(arr as Creator[])
        dismissedSaved = arr.length
      }
    }
  } catch (e: any) { messages.push(`Dismissed error: ${e?.message || e}`) }

  try {
    const raw = lsGet('creator-col-config')
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) await saveColConfig(arr as ColConfig[])
    }
  } catch { /* ignore */ }

  try {
    const raw = lsGet('outreach-col-config')
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) await saveOutreachColConfig(arr as OutreachColConfig[])
    }
  } catch { /* ignore */ }

  // Per-platform state
  const newPs: Record<string, any> = {}
  const legacyW = lsGet('creator-score-weights')
  const legacyN = lsGet('creator-score-narrative')
  const legacyG = lsGet('creator-guidance-entries')
  if (legacyW || legacyN || legacyG) {
    newPs.youtube = newPs.youtube ?? {}
    if (legacyW) try { newPs.youtube.weights = JSON.parse(legacyW) } catch {}
    if (legacyN) newPs.youtube.narrative = legacyN
    if (legacyG) try {
      const g = JSON.parse(legacyG)
      if (Array.isArray(g)) newPs.youtube.guidance = g
    } catch {}
  }
  for (const p of PLATFORMS) {
    const w = lsGet(`creator-score-weights-${p}`)
    const n = lsGet(`creator-score-narrative-${p}`)
    const g = lsGet(`creator-guidance-entries-${p}`)
    if (!w && !n && !g) continue
    newPs[p] = newPs[p] ?? {}
    if (w) try { newPs[p].weights = JSON.parse(w) } catch {}
    if (n) newPs[p].narrative = n
    if (g) try {
      const arr = JSON.parse(g)
      if (Array.isArray(arr)) newPs[p].guidance = arr
    } catch {}
  }
  if (Object.keys(newPs).length > 0) {
    try { await setPlatformState(uid, newPs) } catch { /* ignore */ }
  }

  // Mark prompt as handled so it doesn't pop again
  setMigrationSkipped()

  if (messages.length > 0) {
    return { ok: false, message: messages.join('; ') }
  }
  const parts: string[] = []
  if (outreachSaved > 0) parts.push(`${outreachSaved} outreach`)
  if (dismissedSaved > 0) parts.push(`${dismissedSaved} dismissed`)
  return {
    ok: true,
    message: parts.length > 0 ? `Imported ${parts.join(' + ')}.` : 'Settings imported.',
  }
}

export async function migrateLocalStorageToSupabase(): Promise<void> {
  const uid = await userId()
  if (!uid) {
    console.warn('[migration] no authenticated user; skipping')
    return
  }
  const supabase = createClient()

  // SAFETY NET 1: snapshot localStorage before any save in case migration fails
  const { snapshot } = createMigrationBackup()
  if (Object.keys(snapshot).length > 0) {
    console.info(`[migration] backup created: ${Object.keys(snapshot).length} keys preserved under "${BACKUP_KEY}"`)
  }

  // Skip if user already has data in Supabase
  const { data: existingOutreach, error: existErr } = await supabase
    .from('outreach_entries')
    .select('id')
    .eq('user_id', uid)
    .limit(1)
  if (existErr) {
    console.warn('[migration] read check failed:', existErr.message)
  }
  if (existingOutreach && existingOutreach.length > 0) {
    console.info('[migration] supabase already has outreach rows; skipping')
    return
  }

  const { data: prefRow } = await supabase
    .from('user_preferences')
    .select('platform_state')
    .eq('user_id', uid)
    .single()
  const psNotEmpty = prefRow?.platform_state && Object.keys(prefRow.platform_state).length > 0
  if (psNotEmpty) {
    console.info('[migration] supabase already has platform state; skipping')
    return
  }
  console.info('[migration] running localStorage → Supabase migration')

  // Track expected vs. actual counts for SAFETY NET 2 (verification)
  let expectedOutreach = 0
  let expectedDismissed = 0

  // Outreach
  try {
    const raw = lsGet('creator-outreach')
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed) && parsed.length > 0) {
      expectedOutreach = parsed.length
      console.info(`[migration] migrating ${parsed.length} outreach entries`)
      await saveOutreach(parsed as OutreachEntry[])
    }
  } catch (e) { console.warn('[migration] outreach failed:', e) }

  // Dismissed
  try {
    const raw = lsGet('creator-dismissed')
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed) && parsed.length > 0) {
      expectedDismissed = parsed.length
      console.info(`[migration] migrating ${parsed.length} dismissed creators`)
      await saveDismissed(parsed as Creator[])
    }
  } catch (e) { console.warn('[migration] dismissed failed:', e) }

  // Column configs
  try {
    const raw = lsGet('creator-col-config')
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) await saveColConfig(parsed as ColConfig[])
  } catch (e) { console.warn('[migration] col config failed:', e) }

  try {
    const raw = lsGet('outreach-col-config')
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) await saveOutreachColConfig(parsed as OutreachColConfig[])
  } catch (e) { console.warn('[migration] outreach col config failed:', e) }

  // Per-platform state — handle both legacy un-suffixed keys (assume youtube)
  // and the current per-platform-suffixed keys.
  const newPs: Record<string, any> = {}

  // Legacy keys → youtube
  const legacyW = lsGet('creator-score-weights')
  const legacyN = lsGet('creator-score-narrative')
  const legacyG = lsGet('creator-guidance-entries')
  if (legacyW || legacyN || legacyG) {
    newPs.youtube = newPs.youtube ?? {}
    if (legacyW) try { newPs.youtube.weights = JSON.parse(legacyW) } catch {}
    if (legacyN) newPs.youtube.narrative = legacyN
    if (legacyG) try {
      const g = JSON.parse(legacyG)
      if (Array.isArray(g)) newPs.youtube.guidance = g
    } catch {}
  }

  // Current per-platform keys
  for (const p of PLATFORMS) {
    const w = lsGet(`creator-score-weights-${p}`)
    const n = lsGet(`creator-score-narrative-${p}`)
    const g = lsGet(`creator-guidance-entries-${p}`)
    if (!w && !n && !g) continue
    newPs[p] = newPs[p] ?? {}
    if (w) try { newPs[p].weights = JSON.parse(w) } catch {}
    if (n) newPs[p].narrative = n
    if (g) try {
      const arr = JSON.parse(g)
      if (Array.isArray(arr)) newPs[p].guidance = arr
    } catch {}
  }

  if (Object.keys(newPs).length > 0) {
    console.info(`[migration] migrating platform state for ${Object.keys(newPs).join(', ')}`)
    await setPlatformState(uid, newPs)
  }

  // SAFETY NET 2: verify counts in Supabase match what we expected
  try {
    const { count: actualOutreach } = await supabase
      .from('outreach_entries').select('id', { count: 'exact', head: true })
    const { count: actualDismissed } = await supabase
      .from('dismissed_creators').select('channel_id', { count: 'exact', head: true })
    if (expectedOutreach !== (actualOutreach ?? 0) || expectedDismissed !== (actualDismissed ?? 0)) {
      console.error(
        `[migration] count mismatch! outreach: expected ${expectedOutreach}, got ${actualOutreach ?? 0}; ` +
        `dismissed: expected ${expectedDismissed}, got ${actualDismissed ?? 0}. ` +
        `Backup preserved under "${BACKUP_KEY}" — use "Retry migration" in the menu.`,
      )
    } else {
      console.info(`[migration] verified: outreach=${actualOutreach}, dismissed=${actualDismissed}`)
    }
  } catch (e) {
    console.warn('[migration] verification check failed:', e)
  }

  console.info('[migration] complete')
}

/**
 * SAFETY NET 3: manual retry from the backup snapshot we made before migration.
 * Use this if the auto-migration silently failed (e.g. data didn't show up).
 * Reads from the backup blob (not live localStorage) so it's idempotent.
 */
export async function retryMigrationFromBackup(): Promise<{ ok: boolean; message: string }> {
  const uid = await userId()
  if (!uid) return { ok: false, message: 'Not signed in.' }
  if (!isClient()) return { ok: false, message: 'Not running in a browser.' }

  let backup: Record<string, string>
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return { ok: false, message: 'No backup found. Migration was never run on this browser.' }
    backup = JSON.parse(raw)
  } catch {
    return { ok: false, message: 'Backup is corrupted and unreadable.' }
  }

  let restored: string[] = []

  try {
    if (backup['creator-outreach']) {
      const arr = JSON.parse(backup['creator-outreach'])
      if (Array.isArray(arr) && arr.length > 0) {
        await saveOutreach(arr as OutreachEntry[])
        restored.push(`${arr.length} outreach`)
      }
    }
    if (backup['creator-dismissed']) {
      const arr = JSON.parse(backup['creator-dismissed'])
      if (Array.isArray(arr) && arr.length > 0) {
        await saveDismissed(arr as Creator[])
        restored.push(`${arr.length} dismissed`)
      }
    }
    if (backup['creator-col-config']) {
      const arr = JSON.parse(backup['creator-col-config'])
      if (Array.isArray(arr)) await saveColConfig(arr as ColConfig[])
    }
    if (backup['outreach-col-config']) {
      const arr = JSON.parse(backup['outreach-col-config'])
      if (Array.isArray(arr)) await saveOutreachColConfig(arr as OutreachColConfig[])
    }

    // Per-platform state from backup
    const ps: Record<string, any> = {}
    for (const p of PLATFORMS) {
      const w = backup[`creator-score-weights-${p}`]
      const n = backup[`creator-score-narrative-${p}`]
      const g = backup[`creator-guidance-entries-${p}`]
      if (!w && !n && !g) continue
      ps[p] = ps[p] ?? {}
      if (w) try { ps[p].weights = JSON.parse(w) } catch {}
      if (n) ps[p].narrative = n
      if (g) try {
        const arr = JSON.parse(g)
        if (Array.isArray(arr)) ps[p].guidance = arr
      } catch {}
    }
    if (Object.keys(ps).length > 0) {
      await setPlatformState(uid, ps)
      restored.push('platform state')
    }
  } catch (e: any) {
    return { ok: false, message: `Retry failed: ${e?.message || e}` }
  }

  return {
    ok: true,
    message: restored.length > 0 ? `Restored ${restored.join(', ')}.` : 'Backup was empty — nothing to restore.',
  }
}

// Legacy alias kept so existing callers don't break — now a no-op since
// migration is handled in migrateLocalStorageToSupabase.
export async function migrateLegacyKeys(): Promise<void> {
  // intentionally empty
}
