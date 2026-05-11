'use client'

import React, { useState, useEffect } from 'react'
import type { OutreachEntry, UserProfile } from '@/lib/types'
import { Flame } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Section } from '@/components/shared/Section'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import {
  parseLocalDate,
  todayIso,
  isoDaysFromNow,
} from '@/lib/dates'
import { nextFollowUpDays } from '@/lib/outreach'
import { FollowUpsViewToggle, type FUView } from '@/components/follow-ups/FollowUpsViewToggle'
import { FollowUpCalendar } from '@/components/follow-ups/FollowUpCalendar'
import { FUStat } from '@/components/follow-ups/FUStat'
import { FollowUpRow } from '@/components/follow-ups/FollowUpRow'

// Lazy-loaded calendar variants — each only renders after the user
// switches into its view, so they don't ride along on the initial JS
// bundle. `ssr: false` because these are interactive client surfaces.
const FollowUpWeekStrip = dynamic(
  () => import('@/components/FollowUpWeekStrip').then(m => m.FollowUpWeekStrip),
  { ssr: false },
)
const FollowUpGantt = dynamic(
  () => import('@/components/FollowUpGantt').then(m => m.FollowUpGantt),
  { ssr: false },
)
const FollowUpSplit = dynamic(
  () => import('@/components/FollowUpSplit').then(m => m.FollowUpSplit),
  { ssr: false },
)

// Priority bucketing — derived from how close the follow-up date is.
// High = overdue or due today. Medium = 1-7 days out. Low = 8+ days out.
// `unset` and `ghosted` are special states, not priorities.
type FUBucket = 'high' | 'medium' | 'low' | 'unset' | 'ghosted'

export function OutreachFollowUps({ entries, onUpdate, onOpenEntry, profile }: {
  entries: OutreachEntry[]
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onOpenEntry: (id: string) => void
  profile: UserProfile | null
}) {
  const [sort, setSort] = useState<'urgency' | 'pipeline' | 'touchpoints'>('urgency')
  const [showLater, setShowLater] = useState(false)
  const [showUnset, setShowUnset] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium'>('all')
  const [showGhosted, setShowGhosted] = useState(false)
  // View toggle for the Follow-ups tab. Per Dylan 2026-05-10, the
  // single 'calendar' option was expanded into 4 calendar variants so
  // each user can pick the one that fits their workflow:
  //   list     — original priority-bucket list (default)
  //   month    — month-grid (the original "calendar" view)
  //   week     — 7-day strip with tall tiles + expanded day sheet
  //   gantt    — 3-week horizontal timeline, bars span Sent→FU
  //   split    — mini-month-cal sidebar + always-visible day agenda
  // Persisted to localStorage so each user keeps their preferred view
  // across sessions.
  const [view, setView] = useState<FUView>(() => {
    if (typeof window === 'undefined') return 'list'
    const saved = window.localStorage.getItem('follow-ups-view')
    if (saved === 'list' || saved === 'month' || saved === 'week' || saved === 'gantt' || saved === 'split') return saved
    return 'list'
  })
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('follow-ups-view', view)
  }, [view])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const DAY = 86_400_000
  // 2026-05-10 per Dylan: "no response after immediate outreach isn't
  // low priority — it just puts the next follow-up a little bit out.
  // Stay in active priority until ~a month passes with no reply, THEN
  // demote to ghosted. Some creators take weeks to respond, and the
  // in-between time should trigger another follow-up instead of writing
  // them off." So entries flip into the ghosted bucket only after this
  // many days since the original outreach. Before that, they bucket by
  // follow-up date like a normal Open row.
  //
  // Pipeline item: lift this to a per-user setting (some users prefer
  // 21 days, some 45). 30 is the current default.
  const GHOSTED_THRESHOLD_DAYS = 30

  // Helper — true when a 'No Response' entry has aged past the
  // ghosted threshold (or is missing dateReachedOut, which we treat
  // as old/legacy and conservatively put in ghosted).
  function isTrulyGhosted(e: OutreachEntry): boolean {
    if (e.status !== 'No Response') return false
    const reached = parseLocalDate(e.dateReachedOut)
    if (!reached) return true  // legacy entry with no reach-out date → ghosted
    const daysSince = Math.round((todayMs - reached.getTime()) / DAY)
    return daysSince >= GHOSTED_THRESHOLD_DAYS
  }

  // Active queue = Open OR recently-sent (status=No Response, <14d).
  // Truly ghosted = No Response AND >= 14 days since outreach. Treated
  // as a separate bucket below the main priority queue.
  const open = entries.filter(e => e.status === 'Open' || (e.status === 'No Response' && !isTrulyGhosted(e)))
  const ghosted = entries.filter(e => isTrulyGhosted(e))

  function bucketOf(e: OutreachEntry): FUBucket {
    // Only flip into 'ghosted' once 14 days have passed without a reply.
    if (isTrulyGhosted(e)) return 'ghosted'
    const d = parseLocalDate(e.followUpDate)
    if (!d) return 'unset'
    const tDay = new Date(d); tDay.setHours(0, 0, 0, 0)
    const diffDays = Math.round((tDay.getTime() - todayMs) / DAY)
    if (diffDays <= 0) return 'high'   // overdue OR due today
    if (diffDays <= 7) return 'medium' // due in next week
    return 'low'                        // 8+ days out
  }

  function dealValueNum(e: OutreachEntry): number {
    return parseFloat(String(e.dealValue || '').replace(/[^0-9.]/g, '')) || 0
  }
  function urgencyScore(e: OutreachEntry): number {
    // Lower = more urgent; overdue items are most negative.
    const d = parseLocalDate(e.followUpDate)
    if (!d) return Number.MAX_SAFE_INTEGER - 1
    const t = new Date(d); t.setHours(0, 0, 0, 0)
    return Math.round((t.getTime() - todayMs) / DAY)
  }

  function applySort(list: OutreachEntry[]): OutreachEntry[] {
    const sorted = [...list]
    if (sort === 'pipeline') sorted.sort((a, b) => dealValueNum(b) - dealValueNum(a))
    else if (sort === 'touchpoints') sorted.sort((a, b) => (Number(b.touchpoints) || 0) - (Number(a.touchpoints) || 0))
    else sorted.sort((a, b) => urgencyScore(a) - urgencyScore(b))
    return sorted
  }

  // Group rows up front
  const groups: Record<FUBucket, OutreachEntry[]> = {
    high: [], medium: [], low: [], unset: [], ghosted: [],
  }
  for (const e of open) groups[bucketOf(e)].push(e)
  for (const e of ghosted) groups.ghosted.push(e)
  for (const k of Object.keys(groups) as FUBucket[]) groups[k] = applySort(groups[k])

  // Top stats
  const pipelineValue = open.reduce((s, e) => s + dealValueNum(e), 0)
  // 2026-05-10 per Dylan: "At-risk" should ONLY be ghosted entries
  // (no response 30+ days), not high-priority follow-ups. A lead that's
  // overdue by 2 days isn't at risk — the user just needs to send the
  // next follow-up. At-risk means the deal is actually slipping away,
  // which is what 30+ days of silence signals.
  const atRiskValue = groups.ghosted.reduce((s, e) => s + dealValueNum(e), 0)
  const totalTouches = open.reduce((s, e) => s + (parseInt(e.touchpoints || '0', 10) || 0), 0)

  // Headline summary line — single sentence
  const headline = (() => {
    const h = groups.high.length, m = groups.medium.length, u = groups.unset.length
    if (open.length === 0) return "You don't have any active follow-ups yet."
    if (h === 0 && m === 0 && u === 0) return "All caught up — nothing high or medium priority right now."
    const parts: string[] = []
    if (h > 0) parts.push(`${h} high priority`)
    if (m > 0) parts.push(`${m} medium`)
    if (parts.length === 0 && u > 0) parts.push(`${u} without a date`)
    return parts.length > 0 ? `${parts.join(' · ')} need your attention.` : 'All caught up.'
  })()

  // Sort pills as a reusable slot — passed into the first Section's
  // headerRight so they sit inline with the 'High priority — Overdue
  // or due today — act first' header (per Dylan 2026-05-10: aligned
  // with section header, not floating above it).
  const sortPills = (
    <div className="flex bg-card/60 rounded-md p-0.5 border border-border">
      {([
        { id: 'urgency', label: 'Urgency' },
        { id: 'pipeline', label: 'Pipeline $' },
        { id: 'touchpoints', label: 'Touches' },
      ] as { id: typeof sort; label: string }[]).map(opt => (
        <button
          key={opt.id}
          onClick={() => setSort(opt.id)}
          className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
            sort === opt.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >{opt.label}</button>
      ))}
    </div>
  )

  function snooze(e: OutreachEntry, days: number) {
    const base = parseLocalDate(e.followUpDate) ?? new Date()
    base.setDate(base.getDate() + days)
    onUpdate(e.id, 'followUpDate', `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`)
  }
  function markFollowedUp(e: OutreachEntry, opts?: { date?: string; status?: string }) {
    // Increment touchpoints, push date (use override if provided), update status.
    const next = (parseInt(e.touchpoints || '0', 10) || 0) + 1
    onUpdate(e.id, 'touchpoints', String(next))
    onUpdate(e.id, 'dateReachedOut', todayIso())
    if (opts?.status && opts.status !== e.status) {
      onUpdate(e.id, 'status', opts.status)
    }
    // followUpDate last so it doesn't get clobbered by status auto-set rules.
    const newDate = opts?.date ?? isoDaysFromNow(nextFollowUpDays(next))
    onUpdate(e.id, 'followUpDate', newDate)
  }

  if (open.length === 0 && ghosted.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-blue-800 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">No follow-ups yet</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Once you reach out to a creator and set their status to <span className="text-blue-800 dark:text-blue-400">Open</span>, they'll appear here with a follow-up date 3 days out — then 7, 14, 21 as you keep pinging.
        </p>
      </div>
    )
  }

  // Calendar variants — each renders the SAME entries (open + ghosted)
  // through a different layout. List remains the default. Per Dylan
  // 2026-05-10: ship 4 calendar shapes alongside the list so users can
  // pick the workflow that fits.
  if (view === 'month') {
    return (
      <div className="space-y-4">
        <FollowUpsViewToggle current={view} onChange={setView} />
        <FollowUpCalendar
          entries={[...open, ...ghosted]}
          onUpdate={onUpdate}
          onOpenEntry={onOpenEntry}
          profile={profile}
        />
      </div>
    )
  }
  if (view === 'week') {
    return (
      <div className="space-y-4">
        <FollowUpsViewToggle current={view} onChange={setView} />
        <FollowUpWeekStrip
          entries={[...open, ...ghosted]}
          onOpenEntry={onOpenEntry}
          profile={profile}
        />
      </div>
    )
  }
  if (view === 'gantt') {
    return (
      <div className="space-y-4">
        <FollowUpsViewToggle current={view} onChange={setView} />
        <FollowUpGantt
          entries={[...open, ...ghosted]}
          onOpenEntry={onOpenEntry}
          profile={profile}
        />
      </div>
    )
  }
  if (view === 'split') {
    return (
      <div className="space-y-4">
        <FollowUpsViewToggle current={view} onChange={setView} />
        <FollowUpSplit
          entries={[...open, ...ghosted]}
          onOpenEntry={onOpenEntry}
          profile={profile}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FollowUpsViewToggle current={view} onChange={setView} />
      {/* Headline + 4 priority-aware stats */}
      <div>
        <p className="text-sm text-foreground/80">{headline}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <FUStat
            label="High priority"
            value={groups.high.length}
            accent={groups.high.length > 0 ? 'red' : 'gray'}
            sub={
              open.length > 0
                ? `${Math.round((groups.high.length / open.length) * 100)}% of queue`
                : 'none right now'
            }
            onClick={() => setPriorityFilter(f => f === 'high' ? 'all' : 'high')}
            active={priorityFilter === 'high'}
          />
          <FUStat
            label="Medium"
            value={groups.medium.length}
            accent={groups.medium.length > 0 ? 'yellow' : 'gray'}
            sub={groups.medium.length > 0 ? 'due this week' : 'nothing this week'}
            onClick={() => setPriorityFilter(f => f === 'medium' ? 'all' : 'medium')}
            active={priorityFilter === 'medium'}
          />
          <FUStat
            label="At-risk $"
            value={atRiskValue > 0 ? `$${atRiskValue.toLocaleString()}` : '—'}
            accent={atRiskValue > 0 ? 'red' : 'gray'}
            sub={
              atRiskValue > 0
                ? `${groups.ghosted.length} ghosted (30+ days no reply)`
                : 'nothing has gone cold'
            }
            // Click opens the Ghosted section instead of filtering — the
            // ghosted bucket is its own collapsible at the bottom of the
            // Follow-ups list, so make that visible when the user wants
            // to see what's at risk.
            onClick={() => setShowGhosted(v => !v)}
            active={showGhosted}
          />
          <FUStat
            label="Pipeline $"
            value={pipelineValue > 0 ? `$${pipelineValue.toLocaleString()}` : '—'}
            accent="green"
            sub={
              open.length > 0
                ? `${open.length} active · ${totalTouches} touch${totalTouches === 1 ? '' : 'es'}`
                : undefined
            }
            onClick={() => setPriorityFilter('all')}
            active={priorityFilter === 'all'}
          />
        </div>
        {priorityFilter !== 'all' && (
          <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
            <span>Showing only <span className="text-foreground font-medium">{priorityFilter} priority</span> leads.</span>
            <button onClick={() => setPriorityFilter('all')} className="text-purple-700 dark:text-purple-400 hover:text-purple-700 dark:text-purple-300 underline-offset-2 hover:underline">Clear filter</button>
          </div>
        )}
      </div>

      {/* Sort-aware rendering branch.
          When sort === 'urgency', we group leads into priority
          buckets (High / Medium / Low / Unset / Ghosted) — that's
          the default workflow view.
          When sort === 'pipeline' or 'touchpoints', the bucketing
          stops making sense (the user wants to see highest-value
          or most-touched leads at top, regardless of urgency). We
          flatten everything into a single sorted list.
      */}
      {sort !== 'urgency' ? (
        (() => {
          // Build the flat list. Priority filter still applies for
          // 'high' / 'medium'; otherwise include open + ghosted.
          let flat: OutreachEntry[] = []
          if (priorityFilter === 'high') flat = [...groups.high]
          else if (priorityFilter === 'medium') flat = [...groups.medium]
          else flat = [...open, ...ghosted]
          // Re-apply the chosen sort against the flat list (already
          // sorted within each bucket, but cross-bucket ordering
          // matters here).
          flat = applySort(flat)
          if (flat.length === 0) {
            return (
              <Section title={sort === 'pipeline' ? 'Sorted by pipeline value' : 'Sorted by touch count'} accent="blue" count={0} icon={<span className="text-base">∅</span>}>
                <div className="text-xs text-muted-foreground italic px-1 py-2">
                  No leads match the current filter.
                </div>
              </Section>
            )
          }
          const totalValue = flat.reduce((s, e) => s + dealValueNum(e), 0)
          return (
            <Section
              title={sort === 'pipeline' ? 'By pipeline $ (high to low)' : 'By touches (most to least)'}
              accent="blue"
              count={flat.length}
              subtitle={
                sort === 'pipeline'
                  ? totalValue > 0
                    ? `Total pipeline: $${totalValue.toLocaleString()}`
                    : 'No deal values set yet — fill them in to use this sort.'
                  : 'Highest-touch leads first. Useful for spotting who needs the next nudge.'
              }
              icon={<span className="text-base">{sort === 'pipeline' ? '💰' : '🔥'}</span>}
            >
              {flat.map(e => (
                <FollowUpRow
                  key={e.id}
                  entry={e}
                  bucket={bucketOf(e)}
                  onUpdate={onUpdate}
                  onSnooze={snooze}
                  onMarkFollowedUp={markFollowedUp}
                  onOpen={onOpenEntry}
                  profile={profile}
                />
              ))}
            </Section>
          )
        })()
      ) : (
        <>
      {/* Section: High priority (overdue + today).
          Carries the sort pills in its headerRight slot so they sit
          inline with the first section heading instead of as a
          standalone row above. */}
      {(priorityFilter === 'all' || priorityFilter === 'high') && (
        groups.high.length > 0 ? (
          <Section
            title="High priority"
            accent="red"
            count={groups.high.length}
            subtitle="Overdue or due today — act first"
            icon={<Flame className="w-4 h-4 text-red-500" />}
            headerRight={sortPills}
          >
            {groups.high.map(e => (
              <FollowUpRow
                key={e.id}
                entry={e}
                bucket="high"
                onUpdate={onUpdate}
                onSnooze={snooze}
                onMarkFollowedUp={markFollowedUp}
                onOpen={onOpenEntry}
                profile={profile}
              />
            ))}
          </Section>
        ) : (
          <Section
            title="High priority"
            accent="green"
            count={0}
            icon={<span className="text-base">✓</span>}
            headerRight={sortPills}
          >
            <div className="text-xs text-muted-foreground italic px-1 py-2">
              Nothing urgent. {groups.medium.length > 0 ? `${groups.medium.length} medium-priority lead${groups.medium.length === 1 ? '' : 's'} below.` : 'You\'re fully caught up.'}
            </div>
          </Section>
        )
      )}

      {/* Section: Medium priority (1-7 days out) */}
      {(priorityFilter === 'all' || priorityFilter === 'medium') && groups.medium.length > 0 && (
        <Section
          title="Medium priority"
          accent="yellow"
          count={groups.medium.length}
          subtitle="Due in the next 7 days — plan for these"
          icon={<span className="text-base">📅</span>}
        >
          {groups.medium.map(e => (
            <FollowUpRow
              key={e.id}
              entry={e}
              bucket="medium"
              onUpdate={onUpdate}
              onSnooze={snooze}
              onMarkFollowedUp={markFollowedUp}
              onOpen={onOpenEntry}
              profile={profile}
            />
          ))}
        </Section>
      )}

      {/* Section: Low priority (8+ days out, collapsed) — hidden during filter */}
      {priorityFilter === 'all' && groups.low.length > 0 && (
        <CollapsibleSection
          title="Low priority"
          count={groups.low.length}
          subtitle="More than a week out — no action needed yet"
          open={showLater}
          onToggle={() => setShowLater(v => !v)}
        >
          {groups.low.map(e => (
            <FollowUpRow
              key={e.id}
              entry={e}
              bucket="low"
              onUpdate={onUpdate}
              onSnooze={snooze}
              onMarkFollowedUp={markFollowedUp}
              onOpen={onOpenEntry}
              profile={profile}
            />
          ))}
        </CollapsibleSection>
      )}

      {/* Section: No follow-up date set (collapsed) */}
      {priorityFilter === 'all' && groups.unset.length > 0 && (
        <CollapsibleSection
          title="No follow-up date"
          count={groups.unset.length}
          subtitle="Open status but no date — set one to schedule a ping"
          open={showUnset}
          onToggle={() => setShowUnset(v => !v)}
        >
          {groups.unset.map(e => (
            <FollowUpRow
              key={e.id}
              entry={e}
              bucket="unset"
              onUpdate={onUpdate}
              onSnooze={snooze}
              onMarkFollowedUp={markFollowedUp}
              onOpen={onOpenEntry}
              profile={profile}
            />
          ))}
        </CollapsibleSection>
      )}

      {/* Section: Ghosted leads (No Response) — separate from main queue */}
      {priorityFilter === 'all' && groups.ghosted.length > 0 && (
        <CollapsibleSection
          title="Ghosted"
          count={groups.ghosted.length}
          subtitle="No reply 30+ days after outreach. Optional re-engagement."
          open={showGhosted}
          onToggle={() => setShowGhosted(v => !v)}
        >
          {groups.ghosted.map(e => (
            <FollowUpRow
              key={e.id}
              entry={e}
              bucket="ghosted"
              onUpdate={onUpdate}
              onSnooze={snooze}
              onMarkFollowedUp={markFollowedUp}
              onOpen={onOpenEntry}
              profile={profile}
            />
          ))}
        </CollapsibleSection>
      )}
        </>
      )}
    </div>
  )
}
