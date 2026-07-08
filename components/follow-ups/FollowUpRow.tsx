'use client'

import React, { memo, useRef, useState } from 'react'
import type { Creator, OutreachEntry, UserProfile } from '@/lib/types'
import { Star, Mail } from 'lucide-react'
import {
  buildEntryEmailHref,
  buildEntryEmailContent,
  isFollowUpCompose,
  entryTouchCount,
  formatAddedAtRelative,
} from '@/lib/format'
import { resolveFollowUpConfig } from '@/lib/templates'
import { emitEmailClick } from '@/components/outreach/PendingResponsePrompt'
import {
  parseLocalDate,
  isoDaysFromNow,
  daysAgo,
  daysFromNow,
  calendarDaysSince,
} from '@/lib/dates'
import {
  nextFollowUpIso,
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
  // Every send fired from inside a Follow-up row is BY DEFINITION a
  // follow-up, not a fresh outreach. Pass isFollowUp:true so the
  // preview modal renders "Send follow-up" instead of "Send outreach".
  window.dispatchEvent(new CustomEvent('open-send-modal', { detail: { ...payload, isFollowUp: true } }))
  return true
}

// memo'd in Phase 3a — biggest perf win. FollowUpRow is rendered in a
// list and re-renders on every parent state change (typing in search,
// hovering, theme tick) unless memoized. Parent must useCallback the
// handler props for memo to be effective.
export const FollowUpRow = memo(function FollowUpRow({ entry: e, bucket, onUpdate, onMarkFollowedUp, onOpen, profile }: {
  entry: OutreachEntry
  bucket: FUBucket
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
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

  // Smart date label per bucket. Reworded 2026-07-07: "Follow up in Xd"
  // read as an ACTION and collided with the "Log follow-up" button next
  // to it (Dylan couldn't tell them apart). "Due in Xd" is unambiguous
  // schedule STATUS — the pill shows when it's due; the button logs a
  // send. Every label keeps its semantic so the pill stands alone.
  const dateLabel = (() => {
    if (bucket === 'ghosted') return 'Ghosted'
    if (bucket === 'unset') return 'No date'
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
    return `Due in ${days}d`
  })()

  // What action does this row prompt? "Next:" makes it explicit that the
  // stage names the UPCOMING send — which is also the template the email
  // button will compose.
  const stageHint = bucket === 'ghosted'
    ? `Marked No Response · ${tps} touch${tps === 1 ? '' : 'es'}`
    : tps >= 4
      ? `Next: Final attempt · ${tps} touch${tps === 1 ? '' : 'es'} so far`
      : `Next: ${stage} · ${tps} touch${tps === 1 ? '' : 'es'} so far`

  const dealValue = parseFloat(String(e.dealValue || '').replace(/[^0-9.]/g, '')) || 0

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
                href={buildEntryEmailHref(
                  {
                    channelName: e.channelName,
                    email: e.email,
                    videoTitles: [],
                    description: e.description,
                  } as unknown as Creator,
                  profile,
                  e,
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => {
                  ev.stopPropagation()
                  if (!guardOutreachClick(ev, e.email, profile?.userEmail)) return
                  const content = buildEntryEmailContent(
                    { channelName: e.channelName, email: e.email, videoTitles: [], description: e.description } as unknown as Creator,
                    profile,
                    { ...e, trackingId: undefined },
                  )
                  if (maybeOpenUnipileSend(ev, profile, {
                    entryId: e.id,
                    to: e.email,
                    subject: content.subject,
                    body: content.body,
                    recipientLabel: e.channelName,
                  })) return
                  // Compose-URL path — when the user returns from Gmail,
                  // the PendingResponsePrompt offers to log the touch so
                  // the stage advances without a separate "Followed up".
                  if (isFollowUpCompose(e)) {
                    emitEmailClick({
                      rowId: e.id,
                      channelName: e.channelName,
                      kind: 'followup',
                      nextTouch: entryTouchCount(e) + 1,
                    })
                  }
                }}
                title={`Composes the ${stage.toLowerCase()} template to ${e.email}. Opens your Gmail compose (or the preview modal if Gmail is connected). After you send and return, a prompt offers to log the touch.`}
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
          {/* Per-lead follow-up template set — only shown when the user
              keeps more than one set, so default-only users see no
              clutter. Drives which set this lead's follow-ups use
              (manual button + auto-sender both read followUpSetId). */}
          {(() => {
            const cfg = resolveFollowUpConfig(profile?.followUpConfig)
            if (cfg.sets.length <= 1) return null
            const current = cfg.sets.find(s => s.id === e.followUpSetId)?.id ?? cfg.defaultId
            return (
              <select
                value={current}
                onClick={ev => ev.stopPropagation()}
                onChange={ev => onUpdate(e.id, 'followUpSetId', ev.target.value)}
                title="Which follow-up template set this lead uses"
                className="mt-1 max-w-[170px] text-[10px] bg-muted/40 border border-border rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/40 cursor-pointer"
              >
                {cfg.sets.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.id === cfg.defaultId ? ' · default' : ''}
                  </option>
                ))}
              </select>
            )
          })()}
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
            // Whole calendar days, floored to local midnight — a touch
            // earlier *today* reads "today", not "1d ago". tps<=1 is only
            // the initial outreach (no follow-up sent yet) → "Reached".
            const daysSince = calendarDaysSince(lastTouchTs)
            const when = daysSince === 0 ? 'today' : `${daysSince}d ago`
            const label = tps >= 2 ? `Last followed up ${when}` : `Reached ${when}`
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

        {/* Due-date STATUS pill — shows when the next follow-up is due;
            click to reschedule (moves the date only, never logs a touch).
            The action next to it — "Log follow-up" — is what records a
            send. Distinct jobs, distinct wording. */}
        <div className="relative shrink-0">
          <button
            onClick={() => setDatePopoverOpen(v => !v)}
            title={`Scheduled${e.followUpDate ? ` for ${e.followUpDate}` : ''} — click to reschedule. Moves the date only; use "Log follow-up" after you actually send one.`}
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

        {/* Actions — both ghosted and active variants use the same slot
            structure so total width matches and right edges align.
            Slot layout (left → right):
              [text button] [{ icon, icon }]
            Active:  Log follow-up | { ✓ (hover), 👻 (hover) }
            Ghosted: Re-engage · ✕ | { spacer, spacer }
            2026-07-07: the standalone Snooze icon was removed — the
            due-date pill's reschedule popover covers deferring, so the
            row is down to ONE schedule control + ONE log action. */}
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
              {/* Hover-slot spacers — keep total cluster width matching
                  the active variant so right edges align across rows. */}
              <div className="flex items-center gap-1" aria-hidden>
                <span className="w-5 h-5 shrink-0" />
                <span className="w-5 h-5 shrink-0" />
              </div>
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
                      // Saved manual cadence wins verbatim; the smart
                      // fallback goes through nextFollowUpIso so it keeps
                      // the business-day rule + matches markFollowedUp.
                      const status = savedStatus || e.status || 'Open'
                      onMarkFollowedUp(e, {
                        date: savedDays != null ? isoDaysFromNow(savedDays) : nextFollowUpIso(tps + 1),
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
                  title={`Sent the ${stage.toLowerCase()}? Log it — advances to touch ${tps + 1} and schedules the next one. Single click: pick status + date. Double click: instant with your last-used cadence.`}
                  className="text-[10px] font-semibold text-white bg-purple-600 hover:bg-purple-500 border border-purple-500 rounded px-2 py-0.5 shadow-sm transition-colors"
                >
                  Log follow-up
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
})
