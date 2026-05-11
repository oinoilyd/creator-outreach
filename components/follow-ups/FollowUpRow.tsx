'use client'

import React, { useRef, useState } from 'react'
import type { Creator, OutreachEntry, UserProfile } from '@/lib/types'
import { Star, Mail } from 'lucide-react'
import {
  buildOutreachEmail,
  buildOutreachContent,
  formatAddedAtRelative,
} from '@/lib/format'
import {
  parseLocalDate,
  isoDaysFromNow,
  daysAgo,
  daysFromNow,
} from '@/lib/dates'
import {
  nextFollowUpDays,
  followUpStageLabel,
} from '@/lib/outreach'
import { guardOutreachClick } from '@/components/creators/renderCell'
import { CadencePopover, FollowedUpPopover } from '@/components/CadencePopover'
import { PipelineChip } from '@/components/outreach/PipelineChip'

// Priority bucketing — derived from how close the follow-up date is.
// High = overdue or due today. Medium = 1-7 days out. Low = 8+ days out.
// `unset` and `ghosted` are special states, not priorities.
export type FUBucket = 'high' | 'medium' | 'low' | 'unset' | 'ghosted'

/**
 * Phase 2 click interceptor — when the user has a Unipile-connected
 * Gmail, we route "send email" through our backend (programmatic send,
 * preview modal, real reply tracking) instead of the compose-URL flow.
 *
 * Dispatches a CustomEvent('open-send-modal', { detail }) that Home()
 * listens for. Returns true if it intercepted (caller should preventDefault).
 */
function maybeOpenUnipileSend(
  ev: React.MouseEvent<HTMLAnchorElement>,
  profile: UserProfile | null,
  payload: { entryId: string; to: string; subject: string; body: string; recipientLabel?: string },
): boolean {
  if (!profile?.unipileAccountId) return false
  ev.preventDefault()
  ev.stopPropagation()
  window.dispatchEvent(new CustomEvent('open-send-modal', { detail: payload }))
  return true
}

export function FollowUpRow({ entry: e, bucket, onUpdate, onSnooze, onMarkFollowedUp, onOpen, profile }: {
  entry: OutreachEntry
  bucket: FUBucket
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onSnooze: (e: OutreachEntry, days: number) => void
  onMarkFollowedUp: (e: OutreachEntry, opts?: { date?: string; status?: string }) => void
  onOpen: (id: string) => void
  /** Profile drives the compose URL (mailClient + authuser hint). */
  profile: UserProfile | null
}) {
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)
  const [followedUpOpen, setFollowedUpOpen] = useState(false)
  // Single vs double-click detector for the "Followed up" button.
  // Single click → opens the popover (manual cadence + status pick).
  // Double click → applies the user's last-saved cadence + status
  // immediately, no popover. First-time double-click before any
  // manual choice falls back to the default cadence.
  const followedUpClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initials = (e.channelName || '?')
    .trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?'

  const tps = parseInt(e.touchpoints || '0', 10) || 0
  const stage = followUpStageLabel(tps)

  // Per-bucket styling
  const accent: 'red' | 'yellow' | 'blue' | 'gray' =
    bucket === 'high' ? 'red'
    : bucket === 'medium' ? 'yellow'
    : bucket === 'low' ? 'blue'
    : 'gray'

  const dotColor = { red: 'bg-red-500', yellow: 'bg-yellow-500', blue: 'bg-blue-500', gray: 'bg-gray-500' }[accent]
  const datePillClass = {
    red: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40',
    yellow: 'bg-amber-50 dark:bg-yellow-500/15 text-amber-800 dark:text-yellow-300 border-amber-200 dark:border-yellow-500/40',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
    gray: 'bg-muted/30 text-muted-foreground border-border',
  }[accent]

  // Smart date label per bucket. Self-explanatory wording per Dylan's
  // 2026-05-10 feedback ("'15d' alone doesn't tell you whether it's till
  // next follow-up or since last contact"). Every label now includes the
  // semantic — "Follow up in Xd" / "Overdue by Xd" / "Due today" — so the
  // pill stands alone.
  const dateLabel = (() => {
    if (bucket === 'ghosted') return 'Ghosted'
    if (bucket === 'unset') return 'No follow-up set'
    const days = daysFromNow(e.followUpDate)
    if (bucket === 'high') {
      // Either overdue or due today — daysFromNow returns 0 for both, so we
      // need to check directly with parseLocalDate.
      const d = parseLocalDate(e.followUpDate)
      if (d) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        d.setHours(0, 0, 0, 0)
        if (d.getTime() < today.getTime()) return `Overdue by ${daysAgo(e.followUpDate)}`
      }
      return 'Due today'
    }
    return `Follow up in ${days}d`
  })()

  // What action does this row prompt?
  const stageHint = bucket === 'ghosted'
    ? `Marked No Response · ${tps} touch${tps === 1 ? '' : 'es'}`
    : tps >= 4
      ? `Final attempt · ${tps} touch${tps === 1 ? '' : 'es'} so far`
      : `${stage} · ${tps} touch${tps === 1 ? '' : 'es'} so far`

  const dealValue = parseFloat(String(e.dealValue || '').replace(/[^0-9.]/g, '')) || 0

  // Suggested snooze days = next cadence step (so "Snooze" matches the cadence)
  const snoozeDays = nextFollowUpDays(tps)

  return (
    <div className="group/row bg-card/40 border border-border hover:border-border/80 hover:bg-card/60 rounded-lg transition-all hover:shadow-md hover:shadow-black/5">
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-foreground text-[10px] font-semibold flex items-center justify-center">
            {initials}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-border ${dotColor}`} title={e.status} />
        </div>

        {/* Identity + stage + indicators.
            Refactored 2026-05-09: the channel name is its own
            click-to-open-detail button. The email / LinkedIn icons
            live OUTSIDE that button as separate clickable links so
            users can fire the compose URL directly without having
            to open the detail modal first. Favorite icon stays
            inert (just a status indicator). */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpen(e.id)}
              className="text-[12px] font-medium text-foreground truncate text-left hover:underline"
              title="Open lead details"
            >
              {e.channelName}
            </button>
            {e.favorite && (
              <Star
                className="w-3 h-3 text-amber-700 dark:text-yellow-400 shrink-0 fill-current"
                aria-label="Favorited"
              />
            )}
            {e.email && (
              <a
                href={buildOutreachEmail(
                  {
                    channelName: e.channelName,
                    email: e.email,
                    videoTitles: [],
                    description: e.description,
                  } as unknown as Creator,
                  profile,
                  e.trackingId,
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => {
                  ev.stopPropagation()
                  if (!guardOutreachClick(ev, e.email, profile?.userEmail)) return
                  const content = buildOutreachContent(
                    { channelName: e.channelName, email: e.email, videoTitles: [], description: e.description } as unknown as Creator,
                    profile,
                    undefined,
                  )
                  maybeOpenUnipileSend(ev, profile, {
                    entryId: e.id,
                    to: e.email,
                    subject: content.subject,
                    body: content.body,
                    recipientLabel: e.channelName,
                  })
                }}
                title={`Send outreach to ${e.email}. If Gmail is connected via Unipile, opens preview modal; otherwise opens your Gmail compose.`}
                aria-label={`Email ${e.email}`}
                className="inline-flex items-center text-emerald-700 dark:text-emerald-400/80 hover:text-emerald-500 transition-colors shrink-0"
              >
                <Mail className="w-3 h-3" />
              </a>
            )}
            {e.linkedin && (
              <a
                href={e.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => ev.stopPropagation()}
                title="Open LinkedIn"
                className="text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:text-blue-500 shrink-0 transition-colors"
              >
                in
              </a>
            )}
          </div>
          <button
            onClick={() => onOpen(e.id)}
            className="text-[10px] text-muted-foreground truncate text-left w-full hover:text-foreground/80 transition-colors"
            title="Open lead details"
          >
            <span className="text-foreground/80">{stageHint}</span>
            {e.medium && <span> · via {e.medium}</span>}
            {e.addedAt && <span> · Added {formatAddedAtRelative(e.addedAt)}</span>}
          </button>
          {/* "Last followed up" chip — added per Dylan 2026-05-10 as a
              distinct visual element. markFollowedUp() updates
              dateReachedOut on every manual follow-up; the cron stamps
              last_auto_followup_at. Take max of both for the most
              recent touch. Touchpoints=0 means "reached but never
              followed up yet" — show "Reached Xd ago" instead. */}
          {(() => {
            const reachedTs = e.dateReachedOut ? parseLocalDate(e.dateReachedOut)?.getTime() ?? 0 : 0
            const autoFuTs = e.lastAutoFollowupAt ?? 0
            const lastTouchTs = Math.max(reachedTs, autoFuTs)
            if (!lastTouchTs) return null
            const daysSince = Math.round((Date.now() - lastTouchTs) / 86_400_000)
            const label = tps >= 1 ? `Last followed up ${daysSince}d ago` : `Reached ${daysSince}d ago`
            return (
              <span className="inline-block mt-1 text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                {label}
              </span>
            )
          })()}
        </div>

        {/* Pipeline value chip — inline editable. Click the chip to type
            a new value. Empty / zero shows a faint $ placeholder. */}
        <PipelineChip
          value={e.dealValue || ''}
          onChange={v => onUpdate(e.id, 'dealValue', v)}
        />

        {/* Date pill — clickable to open cadence popover */}
        <div className="relative shrink-0">
          <button
            onClick={() => setDatePopoverOpen(v => !v)}
            title="Click to change follow-up date"
            className={`text-[10px] uppercase tracking-wider font-medium px-2 py-1 rounded border shadow-sm transition-all hover:scale-105 ${datePillClass}`}
          >
            {dateLabel}
          </button>
          {datePopoverOpen && (
            <CadencePopover
              currentDate={e.followUpDate || ''}
              touchpoints={tps}
              onPick={(iso) => { onUpdate(e.id, 'followUpDate', iso); setDatePopoverOpen(false) }}
              onClose={() => setDatePopoverOpen(false)}
              align="right"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {bucket === 'ghosted' ? (
            <>
              <button
                onClick={() => onUpdate(e.id, 'status', 'Open')}
                title="Re-engage — moves back to active queue with a fresh date"
                className="text-[10px] font-medium text-purple-800 dark:text-purple-200 hover:text-foreground bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded px-2 py-0.5 transition-colors"
              >
                Re-engage
              </button>
              <button
                onClick={() => onUpdate(e.id, 'status', 'Rejected')}
                title="Confirm dead lead"
                className="w-5 h-5 flex items-center justify-center text-[10px] text-red-700 dark:text-red-400 hover:text-foreground border border-red-500/30 hover:bg-red-600/30 hover:border-red-500 rounded transition-colors"
              >✕</button>
            </>
          ) : (
            <>
              {/* Primary action — single click opens manual popover,
                  double click applies the last-saved cadence + status
                  immediately. The setTimeout-based detector defers
                  the single-click action by 250ms so a fast second
                  click can pre-empt it cleanly. */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (followedUpClickTimerRef.current) {
                      // Second click within the 250ms window → double click
                      clearTimeout(followedUpClickTimerRef.current)
                      followedUpClickTimerRef.current = null
                      // Read last-saved cadence + status from localStorage.
                      // Fallback to the smart cadence + current status when
                      // the user hasn't manually confirmed any follow-up yet.
                      const savedDays = (() => {
                        if (typeof window === 'undefined') return null
                        const v = parseInt(localStorage.getItem('followedUp:lastCadenceDays') || '', 10)
                        return Number.isFinite(v) && v > 0 && v < 365 ? v : null
                      })()
                      const savedStatus = typeof window !== 'undefined'
                        ? localStorage.getItem('followedUp:lastStatus') || ''
                        : ''
                      const days = savedDays ?? nextFollowUpDays(tps + 1)
                      const status = savedStatus || e.status || 'Open'
                      onMarkFollowedUp(e, {
                        date: isoDaysFromNow(days),
                        status,
                      })
                      return
                    }
                    // First click — defer the popover open in case a
                    // second click follows.
                    followedUpClickTimerRef.current = setTimeout(() => {
                      followedUpClickTimerRef.current = null
                      setFollowedUpOpen(v => !v)
                    }, 250)
                  }}
                  title="Single click: pick next date + status manually. Double click: apply your last-used cadence (defaults to the smart cadence the first time)."
                  className="text-[10px] font-medium text-purple-800 dark:text-purple-200 hover:text-foreground bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded px-2 py-0.5 transition-colors"
                >
                  Followed up
                </button>
                {followedUpOpen && (
                  <FollowedUpPopover
                    touchpoints={tps}
                    currentStatus={e.status}
                    onConfirm={({ date, status }) => {
                      // Persist the user's manual choice so the next
                      // double-click on any row in this browser uses
                      // these values. Days is computed from today —
                      // local-time, not UTC, to match the date input.
                      if (typeof window !== 'undefined' && date) {
                        const today = new Date(); today.setHours(0, 0, 0, 0)
                        const picked = parseLocalDate(date)
                        if (picked) {
                          picked.setHours(0, 0, 0, 0)
                          const days = Math.round((picked.getTime() - today.getTime()) / 86_400_000)
                          if (days > 0 && days < 365) {
                            localStorage.setItem('followedUp:lastCadenceDays', String(days))
                          }
                        }
                        if (status) localStorage.setItem('followedUp:lastStatus', status)
                      }
                      onMarkFollowedUp(e, { date, status })
                      setFollowedUpOpen(false)
                    }}
                    onClose={() => setFollowedUpOpen(false)}
                    align="right"
                  />
                )}
              </div>
              {/* Snooze — always visible, icon only */}
              <button
                onClick={() => onSnooze(e, snoozeDays)}
                title={`Snooze ${snoozeDays}d (next cadence step)`}
                className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground border border-white/10 hover:border-white/30 rounded transition-colors"
                aria-label="Snooze"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
              {/* Secondary actions — hover-revealed for cleaner default look */}
              <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                <button
                  onClick={() => onUpdate(e.id, 'status', 'Successful')}
                  title="They said yes"
                  className="w-5 h-5 flex items-center justify-center text-[10px] text-emerald-700 dark:text-emerald-400 hover:text-foreground border border-emerald-500/30 hover:bg-emerald-600/30 hover:border-emerald-500 rounded transition-colors"
                >✓</button>
                <button
                  onClick={() => onUpdate(e.id, 'status', 'No Response')}
                  title="Ghost — move to No Response queue"
                  className="w-5 h-5 flex items-center justify-center text-[10px] text-muted-foreground hover:text-foreground border border-white/10 hover:border-white/30 rounded transition-colors"
                  aria-label="Ghost"
                >👻</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
