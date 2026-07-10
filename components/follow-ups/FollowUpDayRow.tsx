'use client'

import React from 'react'
import type { Creator, OutreachEntry, UserProfile } from '@/lib/types'
import {
  buildEntryEmailHref,
  buildEntryEmailContent,
  isFollowUpCompose,
  entryTouchCount,
} from '@/lib/format'
import { copyInstagramDm, copyLinkedInMessage } from '@/lib/outreach'
import {
  priColor, fmtFollow, moneyShort, dealValueNum, lastTouchedDaysAgo,
} from '@/components/follow-up-shared'
import { guardOutreachClick } from '@/components/creators/renderCell'
import { emitEmailClick } from '@/components/outreach/PendingResponsePrompt'

/**
 * FollowUpDayRow — THE row for "leads on this day" lists under the
 * calendar views (month day sheet + week day panel).
 *
 * Why (Dylan 2026-07-10): the month view's day sheet and the week
 * view's day panel each had their own row markup. The month one had
 * grown four stacked micro-pills, two meta lines and a notes preview
 * per lead ("awful"); the week one was clean but had no actions at
 * all. This is the unified shape — the week view's single-line look
 * (dot · name · due label · $ · last-touch) carrying the day sheet's
 * quick actions (email / IG / LinkedIn / details) as a compact
 * cluster on the right. One component, both calendars, identical.
 *
 * Row click opens the lead detail; the action buttons stopPropagation
 * so they don't double-open it.
 */

/**
 * Phase 2 click interceptor — when the user has a Unipile-connected
 * Gmail, we route "send email" through our backend (programmatic send,
 * preview modal, real reply tracking) instead of the compose-URL flow.
 * Sends from a day row are follow-ups whenever the entry has touches —
 * isFollowUp mirrors the compose-side stage decision.
 */
function maybeOpenUnipileSend(
  ev: React.MouseEvent<HTMLAnchorElement>,
  profile: UserProfile | null,
  payload: { entryId: string; to: string; subject: string; body: string; recipientLabel?: string; isFollowUp: boolean },
): boolean {
  if (!profile?.unipileAccountId) return false
  ev.preventDefault()
  ev.stopPropagation()
  window.dispatchEvent(new CustomEvent('open-send-modal', { detail: payload }))
  return true
}

export function FollowUpDayRow({
  entry: e,
  profile,
  onOpenEntry,
}: {
  entry: OutreachEntry
  profile: UserProfile | null
  onOpenEntry: (id: string) => void
}) {
  const p = priColor(e)
  const lt = lastTouchedDaysAgo(e)
  const igHandle = e.instagram?.replace('@', '').trim()
  const igUrl = igHandle ? `https://instagram.com/${igHandle}` : null
  const emailHref = e.email
    ? buildEntryEmailHref(
        {
          channelName: e.channelName,
          email: e.email,
          videoTitles: [],
          description: e.description,
        } as unknown as Creator,
        profile,
        e,
      )
    : null

  return (
    <li
      onClick={() => onOpenEntry(e.id)}
      className={`rounded-lg border ${p.tint} p-3 flex items-center gap-3 flex-wrap cursor-pointer hover:bg-card/50 transition-colors`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${p.dot}`} />
      <span className="text-sm font-medium flex-1 truncate min-w-[120px]" title={e.channelName}>
        {e.channelName || 'Unnamed'}
      </span>
      <span className={`text-[10px] uppercase tracking-wider font-bold shrink-0 ${p.text}`}>{fmtFollow(e)}</span>
      {dealValueNum(e) > 0 && (
        <span className="text-sm font-mono text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0">
          {moneyShort(e.dealValue)}
        </span>
      )}
      {lt && <span className="text-[10px] text-muted-foreground shrink-0">{lt.label}</span>}

      {/* Quick actions — compact, right-aligned. stopPropagation on each
          so a button click doesn't ALSO fire the row's open-detail. */}
      <span className="flex items-center gap-1.5 flex-wrap ml-auto">
        {emailHref && (
          <a
            href={emailHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={ev => {
              ev.stopPropagation()
              if (!guardOutreachClick(ev, e.email, profile?.userEmail)) return
              const content = buildEntryEmailContent(
                { channelName: e.channelName, email: e.email, videoTitles: [], description: e.description } as unknown as Creator,
                profile,
                { ...e, trackingId: undefined },
              )
              const isFu = isFollowUpCompose(e)
              if (maybeOpenUnipileSend(ev, profile, {
                entryId: e.id,
                to: e.email,
                subject: content.subject,
                body: content.body,
                recipientLabel: e.channelName,
                isFollowUp: isFu,
              })) return
              // Compose-URL path — after the user returns from Gmail,
              // the PendingResponsePrompt asks to log the touch.
              if (isFu) {
                emitEmailClick({
                  rowId: e.id,
                  channelName: e.channelName,
                  kind: 'followup',
                  nextTouch: entryTouchCount(e) + 1,
                })
              }
            }}
            title="Send email. If Gmail is connected via Unipile, opens the preview modal; otherwise opens your Gmail compose."
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
            onClick={ev => { ev.stopPropagation(); copyInstagramDm(e.channelName, profile) }}
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
            onClick={ev => { ev.stopPropagation(); copyLinkedInMessage(e.channelName, profile) }}
            title="Open LinkedIn + copy message template to clipboard"
            className="text-[11px] font-medium px-2.5 py-1 rounded border border-blue-500/40 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            in LinkedIn
          </a>
        )}
        <button
          type="button"
          onClick={ev => { ev.stopPropagation(); onOpenEntry(e.id) }}
          className="text-[11px] font-medium px-2.5 py-1 rounded border border-purple-500/40 text-purple-700 dark:text-purple-400 hover:bg-purple-500/10 transition-colors"
        >
          Open details →
        </button>
      </span>
    </li>
  )
}
