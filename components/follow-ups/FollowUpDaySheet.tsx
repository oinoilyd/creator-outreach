'use client'

import React from 'react'
import type { Creator, OutreachEntry, UserProfile } from '@/lib/types'
import {
  buildOutreachEmail,
  buildOutreachContent,
  formatAddedAtRelative,
} from '@/lib/format'
import { parseLocalDate } from '@/lib/dates'
import {
  copyInstagramDm,
  copyLinkedInMessage,
} from '@/lib/outreach'
import { guardOutreachClick } from '@/components/creators/renderCell'

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
  // Sends from the Follow-up Day Sheet are always follow-ups — same
  // reasoning as FollowUpRow. Pass isFollowUp:true so the preview
  // modal renders "Send follow-up" labels.
  window.dispatchEvent(new CustomEvent('open-send-modal', { detail: { ...payload, isFollowUp: true } }))
  return true
}

/**
 * Expanded "details for this day" panel that drops below the calendar
 * grid when the user clicks a day with follow-ups. Shows each lead
 * with quick-action buttons (email / IG / LinkedIn) and an "Open
 * details" button that fires onOpenEntry → LeadDetailModal.
 */
export function FollowUpDaySheet({
  dateIso,
  entries,
  overdueEntries = [],
  onClose,
  onOpenEntry,
  profile,
}: {
  dateIso: string
  entries: OutreachEntry[]
  /** Overdue follow-ups (past dates, still in flight). Only passed
   *  when this sheet represents TODAY — surfaced as a section above
   *  today's regular follow-ups so missed deadlines stop vanishing
   *  from view. Dylan 2026-06-08. */
  overdueEntries?: OutreachEntry[]
  onClose: () => void
  onOpenEntry: (id: string) => void
  profile: UserProfile | null
}) {
  const dateLabel = (() => {
    const d = parseLocalDate(dateIso)
    if (!d) return dateIso
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  })()
  // Inline row renderer — used by both the "Overdue" section (today
  // only) and today's regular follow-up list. Extracted as a closure
  // so it captures `profile` + handlers without prop drilling.
  function renderRow(e: OutreachEntry) {
    const igHandle = e.instagram?.replace('@', '').trim()
    const igUrl = igHandle ? `https://instagram.com/${igHandle}` : null
    const emailHref = e.email
      ? buildOutreachEmail(
          {
            channelName: e.channelName,
            email: e.email,
            videoTitles: [],
            description: e.description,
          } as unknown as Creator,
          profile,
          e.trackingId,
        )
      : null
    return (
      <li
        key={e.id}
        className="rounded-lg border border-border bg-card/40 p-3 flex items-center justify-between gap-3 flex-wrap"
      >
        {/* Row body — same layout for overdue + today. The
            "Overdue by Xd" pill inside computes itself based on
            the entry's followUpDate. */}
        {/* eslint-disable-next-line @typescript-eslint/no-use-before-define -- row renderer references self via key */}
        {renderRowBody(e, emailHref, igUrl)}
      </li>
    )
  }
  function renderRowBody(e: OutreachEntry, emailHref: string | null, igUrl: string | null) {
    return (
      <>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={e.channelUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline truncate"
            >
              {e.channelName || 'Unnamed'}
            </a>
            <span
              className={`text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border ${
                e.status === 'Open'
                  ? 'border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-500/10'
                  : e.status === 'No Response'
                  ? 'border-yellow-500/40 text-yellow-700 dark:text-yellow-300 bg-yellow-500/10'
                  : 'border-border text-muted-foreground bg-muted'
              }`}
            >
              {e.status === 'Open'
                ? 'Warm'
                : e.status === 'No Response'
                ? 'Pending Response'
                : e.status || 'Not Outreached'}
            </span>
            {(() => {
              const today = new Date(); today.setHours(0, 0, 0, 0)
              const DAY = 86_400_000
              const reached = parseLocalDate(e.dateReachedOut)
              const reachedDays = reached
                ? Math.round((today.getTime() - reached.getTime()) / DAY)
                : null
              const ghosted =
                e.status === 'No Response' && (reachedDays === null || reachedDays >= 30)
              let label = 'No follow-up set'
              let tone = 'border-border text-muted-foreground bg-muted/40'
              if (ghosted) {
                label = 'Ghosted'
                tone = 'border-purple-500/40 text-purple-700 dark:text-purple-300 bg-purple-500/10'
              } else {
                const fu = parseLocalDate(e.followUpDate)
                if (fu) {
                  fu.setHours(0, 0, 0, 0)
                  const diffDays = Math.round((fu.getTime() - today.getTime()) / DAY)
                  if (diffDays < 0) {
                    label = `Overdue by ${Math.abs(diffDays)}d`
                    tone = 'border-red-500/40 text-red-700 dark:text-red-300 bg-red-500/10'
                  } else if (diffDays === 0) {
                    label = 'Due today'
                    tone = 'border-red-500/40 text-red-700 dark:text-red-300 bg-red-500/10'
                  } else if (diffDays <= 7) {
                    label = `Follow up in ${diffDays}d`
                    tone = 'border-amber-500/40 text-amber-700 dark:text-yellow-300 bg-amber-500/10'
                  } else {
                    label = `Follow up in ${diffDays}d`
                    tone = 'border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-500/10'
                  }
                }
              }
              return (
                <span
                  className={`text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border ${tone}`}
                >
                  {label}
                </span>
              )
            })()}
          </div>
          {(() => {
            const tps = parseInt(e.touchpoints || '0', 10) || 0
            const reachedTs = e.dateReachedOut ? parseLocalDate(e.dateReachedOut)?.getTime() ?? 0 : 0
            const autoFuTs = e.lastAutoFollowupAt ?? 0
            const lastTouchTs = Math.max(reachedTs, autoFuTs)
            if (!lastTouchTs) return null
            const daysSince = Math.round((Date.now() - lastTouchTs) / 86_400_000)
            const label = tps >= 1 ? `Last followed up ${daysSince}d ago` : `Reached ${daysSince}d ago`
            return (
              <span className="inline-block mt-1.5 text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                {label}
              </span>
            )
          })()}
          <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-2">
            {e.medium && <span>via {e.medium}</span>}
            {!!e.addedAt && <span>· Added {formatAddedAtRelative(e.addedAt)}</span>}
          </div>
          {e.notes && (
            <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
              {e.notes}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {emailHref && (
            <a
              href={emailHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={ev => {
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
              title="Send follow-up. If Gmail is connected via Unipile, opens preview modal; otherwise opens your Gmail compose."
              className="text-[11px] font-medium px-2.5 py-1 rounded border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              📧 Email
            </a>
          )}
          {igUrl && (
            <a
              href={igUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => copyInstagramDm(e.channelName, profile)}
              title="Open Instagram + copy DM template to clipboard"
              className="text-[11px] font-medium px-2.5 py-1 rounded border border-pink-500/40 text-pink-700 dark:text-pink-400 hover:bg-pink-500/10 transition-colors inline-flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              IG DM
            </a>
          )}
          {e.linkedin && (
            <a
              href={e.linkedin}
              target="_blank"
              rel="noreferrer"
              onClick={() => copyLinkedInMessage(e.channelName, profile)}
              title="Open LinkedIn + copy message template to clipboard"
              className="text-[11px] font-medium px-2.5 py-1 rounded border border-blue-500/40 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              in LinkedIn
            </a>
          )}
          <button
            type="button"
            onClick={() => onOpenEntry(e.id)}
            className="text-[11px] font-medium px-2.5 py-1 rounded border border-purple-500/40 text-purple-700 dark:text-purple-400 hover:bg-purple-500/10 transition-colors"
          >
            Open details →
          </button>
        </div>
      </>
    )
  }

  return (
    <section className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
      <header className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {dateLabel}
          <span className="ml-2 text-muted-foreground font-normal">
            · {entries.length} follow-up{entries.length === 1 ? '' : 's'}
          </span>
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg leading-none px-1"
          aria-label="Close day"
        >
          ×
        </button>
      </header>

      {/* OVERDUE section — only renders when this sheet was opened
          for TODAY and there are past-due in-flight follow-ups.
          Subtle amber tint differentiates from today's purple sheet
          but stays understated. Empty state hidden when no overdue. */}
      {overdueEntries.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-amber-700 dark:text-amber-300">
              ⚠ Overdue
            </span>
            <span className="text-[11px] text-muted-foreground">
              {overdueEntries.length} follow-up{overdueEntries.length === 1 ? '' : 's'} missed and still pending
            </span>
          </div>
          <ul className="space-y-2">
            {overdueEntries.map(renderRow)}
          </ul>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">
          {overdueEntries.length > 0
            ? 'No follow-ups scheduled for today (overdue items above need attention).'
            : 'No follow-ups scheduled for this day.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map(renderRow)}
        </ul>
      )}
    </section>
  )
}
