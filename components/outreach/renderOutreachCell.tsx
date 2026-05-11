'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { Creator, OutreachEntry, OutreachColConfig, UserProfile } from '@/lib/types'
import {
  formatSubscribers,
  buildOutreachEmail,
  buildOutreachContent,
  formatAddedAtRelative,
} from '@/lib/format'
import { fitScoreMeta } from '@/lib/scoring'
import {
  parseLocalDate,
  isoDaysFromNow,
  daysAgo,
  daysFromNow,
} from '@/lib/dates'
import {
  copyInstagramDm,
  copyLinkedInMessage,
  markEmailBounced,
  nextFollowUpDays,
} from '@/lib/outreach'
import { AutoTextarea } from '@/components/ui'
import { guardOutreachClick } from '@/components/creators/renderCell'
import { EmailEditToggle } from '@/components/outreach/EmailEditToggle'

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

// Follow-up date cell — shows a colored urgency pill and opens a popover
// with a manual date picker plus quick cadence buttons (Tomorrow / +3d /
// +1w / +2w / +1m) and a smart "Use cadence" button that picks the right
// next-step interval based on how many touches the lead has had.
function FollowUpDateCell({ entry, onUpdate }: {
  entry: OutreachEntry
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const tps = parseInt(entry.touchpoints || '0', 10) || 0
  const cadenceDays = nextFollowUpDays(tps + 1)
  const isUnset = !entry.followUpDate
  const dateObj = parseLocalDate(entry.followUpDate)
  const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() })()
  const isOverdue = !!dateObj && (() => { const d = new Date(dateObj); d.setHours(0, 0, 0, 0); return d.getTime() < todayMs })()
  const isToday = !!dateObj && (() => { const d = new Date(dateObj); d.setHours(0, 0, 0, 0); return d.getTime() === todayMs })()

  const pillClass = isUnset
    ? 'bg-muted/50 text-muted-foreground border-border hover:border-border'
    : isOverdue
      ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40 hover:border-red-300 dark:hover:border-red-400'
      : isToday
        ? 'bg-amber-50 dark:bg-yellow-500/15 text-amber-800 dark:text-yellow-300 border-amber-200 dark:border-yellow-500/40 hover:border-amber-300 dark:hover:border-yellow-400'
        : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30 hover:border-blue-300 dark:hover:border-blue-400'

  const label = isUnset
    ? '+ set'
    : isOverdue
      ? `${daysAgo(entry.followUpDate)} late`
      : isToday
        ? 'today'
        : `in ${daysFromNow(entry.followUpDate)}d`

  function setDate(iso: string) {
    onUpdate(entry.id, 'followUpDate', iso)
    setOpen(false)
  }

  function setRelative(days: number) {
    setDate(isoDaysFromNow(days))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title={isUnset ? 'No follow-up date — click to set one' : `Follow-up: ${entry.followUpDate}`}
        className={`w-full text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors text-center ${pillClass}`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-64 rounded-lg border border-border bg-card shadow-2xl p-3 text-xs normal-case font-normal">
          {/* Smart "Use cadence" — top action */}
          <button
            onClick={() => setRelative(cadenceDays)}
            className="w-full mb-2 px-3 py-1.5 text-[11px] font-medium text-purple-100 bg-purple-600/40 hover:bg-purple-600/60 border border-purple-500/50 rounded-md transition-colors flex items-center justify-between"
            title="Set to today + the smart cadence step based on this lead's current touch count"
          >
            <span>Use cadence</span>
            <span className="text-[10px] text-purple-700 dark:text-purple-300/80">+{cadenceDays}d (touch {tps + 1})</span>
          </button>

          {/* Quick presets */}
          <div className="grid grid-cols-2 gap-1 mb-2">
            {[
              { label: 'Tomorrow', days: 1 },
              { label: '+3 days', days: 3 },
              { label: '+1 week', days: 7 },
              { label: '+2 weeks', days: 14 },
              { label: '+1 month', days: 30 },
            ].map(p => (
              <button
                key={p.label}
                onClick={() => setRelative(p.days)}
                className="px-2 py-1 text-[11px] text-foreground/80 bg-muted/60 hover:bg-muted hover:text-foreground border border-border hover:border-border rounded transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Manual date picker */}
          <div className="border-t border-border pt-2">
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Pick a specific date</label>
            <input
              type="date"
              value={entry.followUpDate || ''}
              onChange={ev => onUpdate(entry.id, 'followUpDate', ev.target.value)}
              className="w-full bg-muted border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Clear */}
          {!isUnset && (
            <button
              onClick={() => setDate('')}
              className="w-full mt-2 px-3 py-1 text-[11px] text-muted-foreground hover:text-red-700 dark:text-red-300 border border-border hover:border-red-500/50 rounded transition-colors"
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// priority: email=3, linkedin only=2, enriching=1, nothing=0
export function renderOutreachCell(
  col: OutreachColConfig,
  e: OutreachEntry,
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void,
  profile: UserProfile | null,
  searching: boolean,
  onSearchContacts: (id: string) => void,
): React.ReactNode {
  const id = col.id
  switch (id) {
    case 'favorite':
      return (
        <button
          onClick={() => onUpdate(e.id, 'favorite', !e.favorite)}
          title={e.favorite ? 'Unstar' : 'Mark as favorite'}
          className={`mt-0.5 transition-colors ${e.favorite ? 'text-amber-700 dark:text-yellow-400 hover:text-amber-700 dark:text-yellow-300' : 'text-muted-foreground/50 hover:text-yellow-500'}`}
          aria-label={e.favorite ? 'Unstar' : 'Mark as favorite'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill={e.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.176 0l-3.366 2.445c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.363-1.118L2.046 9.384c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.302-3.957z" />
          </svg>
        </button>
      )
    case 'channelName':
      return (
        <div className="flex items-start gap-1.5 w-full">
          <AutoTextarea value={e.channelName} onChange={v => onUpdate(e.id, 'channelName', v)} className="text-blue-800 dark:text-blue-400 font-medium flex-1" />
          {e.unipileThreadId && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-thread-modal', { detail: { entryId: e.id, label: e.channelName } }))}
              title="View full conversation thread"
              aria-label="View conversation thread"
              className="mt-0.5 text-muted-foreground/70 hover:text-purple-600 dark:hover:text-purple-300 transition-colors text-sm leading-none"
            >
              💬
            </button>
          )}
        </div>
      )
    case 'channelUrl':
      return (
        <a href={e.channelUrl} target="_blank" className="mt-0.5 block">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-500">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 3.993L9 16z"/>
          </svg>
        </a>
      )
    case 'email':
      return (
        <div className="flex flex-col gap-1">
          {e.email && (
            <div className="flex items-start gap-1.5">
              <a
                href={buildOutreachEmail({ channelName: e.channelName, email: e.email, videoTitles: [], description: e.description } as unknown as Creator, profile, e.trackingId)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={ev => {
                  // 2026-05-10 — recipient guard runs FIRST. If the
                  // address is empty / invalid / equals the user's
                  // own login email, we block the navigation and
                  // skip the click-to-track status flip too — no
                  // outbound = no status change.
                  if (!guardOutreachClick(ev, e.email, profile?.userEmail)) return
                  // Phase 2 — if the user has connected Gmail via
                  // Unipile, intercept the click and open the
                  // SendPreviewModal instead of navigating to a
                  // compose URL. Sends programmatically with reply
                  // tracking, eliminating the multi-account bugs.
                  const content = buildOutreachContent(
                    { channelName: e.channelName, email: e.email, videoTitles: [], description: e.description } as unknown as Creator,
                    profile,
                    undefined, // No [CO-#xxx] tag — Unipile uses real threading
                  )
                  if (maybeOpenUnipileSend(ev, profile, {
                    entryId: e.id,
                    to: e.email,
                    subject: content.subject,
                    body: content.body,
                    recipientLabel: e.channelName,
                  })) return
                  // Phase 1 — click-to-track (legacy compose-URL path).
                  if (e.status === 'Not Outreached' || e.status === '') {
                    onUpdate(e.id, 'status', 'No Response')
                  }
                }}
                className="text-emerald-700 dark:text-green-400 hover:underline text-xs break-all flex-1"
              >
                {e.email}
              </a>
              {/* Mark email bad — flips creator_enrichment.email_bounced
                  so the cache forces a re-fetch next time. Confirms before
                  firing so we don\\'t flag good emails on a fat-finger. */}
              <button
                type="button"
                title="Mark email bad — clears it from the cache so the next enrichment runs fresh"
                onClick={() => {
                  if (!confirm(`Mark ${e.email} as bad?\n\nThe cache will clear and next enrichment will re-fetch from scratch.`)) return
                  void markEmailBounced(e.channelId, e.email, e.channelName)
                }}
                className="shrink-0 mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                aria-label="Mark email bad"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 7l1 13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2l1-13" />
                  <path d="M8 7V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3" />
                  <line x1="3" y1="7" x2="21" y2="7" />
                </svg>
              </button>
            </div>
          )}
          {/* When the email exists we don't repeat it as plain text
              below the green link — that was a confusing duplicate.
              Instead show a small "Edit email" toggle that swaps in
              an inline textarea on click. When the email is BLANK,
              fall through to the textarea + Find-email path so the
              user can paste/type one. */}
          {e.email ? (
            <EmailEditToggle
              email={e.email}
              onChange={v => onUpdate(e.id, 'email', v)}
            />
          ) : (
            <>
              <AutoTextarea
                value={e.email}
                onChange={v => onUpdate(e.id, 'email', v)}
                placeholder="Add email..."
                className="text-muted-foreground"
              />
              <button
                onClick={() => onSearchContacts(e.id)}
                disabled={searching}
                title="Deep search — checks website (incl. /press, /partnerships, /sponsor), Linktree-style bio pages, social bios, and multiple DDG queries. Takes 10-20s."
                className="self-start mt-0.5 text-[10px] text-purple-700 dark:text-purple-400 hover:text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:border-purple-500/60 rounded px-2 py-0.5 transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {searching ? 'Searching…' : '🔍 Find email'}
              </button>
            </>
          )}
        </div>
      )
    case 'description':
      return <AutoTextarea value={e.description} onChange={v => onUpdate(e.id, 'description', v)} placeholder="—" className="text-muted-foreground" />
    case 'product':
      return <AutoTextarea value={e.product} onChange={v => onUpdate(e.id, 'product', v)} placeholder="Add product..." className="text-foreground" />
    case 'reachedOut':
      return <input type="checkbox" checked={e.reachedOut} onChange={ev => onUpdate(e.id, 'reachedOut', ev.target.checked)} className="w-4 h-4 rounded accent-purple-500 cursor-pointer mt-0.5" />
    case 'medium':
      return (
        <div className="flex flex-col gap-1">
          <select value={e.medium} onChange={ev => onUpdate(e.id, 'medium', ev.target.value)} className="bg-muted border border-border rounded px-2 py-0.5 text-xs text-foreground focus:outline-none focus:border-purple-500 w-full">
            <option value="">—</option>
            <option value="Email">Email</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Other">Other</option>
          </select>
          {e.medium === 'Other' && <AutoTextarea value={e.mediumOther} onChange={v => onUpdate(e.id, 'mediumOther', v)} placeholder="specify..." className="text-foreground" />}
        </div>
      )
    case 'headerUsed':
      return <AutoTextarea value={e.headerUsed} onChange={v => onUpdate(e.id, 'headerUsed', v)} placeholder="Subject line used..." className="text-foreground" />
    case 'status': {
      // "Needs classification" hint: when the inbound webhook stamped
      // responseDate but the user hasn't moved status off "No Response"
      // (or earlier states) yet — they got a reply and need to read +
      // classify as Open / Successful / Rejected. Surfaces as a small
      // mail badge above the dropdown.
      const needsClassification =
        !!e.responseDate &&
        (e.status === 'No Response' ||
          e.status === 'Not Outreached' ||
          e.status === '')
      return (
        <div className="flex flex-col gap-0.5">
          {needsClassification && (
            <span
              className="inline-flex items-center gap-1 self-start text-[9px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 rounded px-1.5 py-0.5"
              title={`Reply received ${e.responseDate}. Pick Open / Successful / Rejected after reading.`}
            >
              📬 New reply
            </span>
          )}
          <select value={e.status || 'Not Outreached'} onChange={ev => onUpdate(e.id, 'status', ev.target.value)}
            className={`w-full rounded px-2 py-0.5 text-xs focus:outline-none border ${e.status === 'Successful' ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300' : e.status === 'Open' ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300' : e.status === 'Rejected' ? 'bg-red-50 dark:bg-red-900/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300' : e.status === 'No Response' ? 'bg-muted border-border text-muted-foreground' : 'bg-muted border-border text-muted-foreground'}`}>
            <option value="Not Outreached">Not Outreached</option>
            <option value="Open">Open</option>
            <option value="No Response">No Response</option>
            <option value="Successful">Successful</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      )
    }
    case 'notes':
      return <AutoTextarea value={e.notes || ''} onChange={v => onUpdate(e.id, 'notes', v)} placeholder="Notes..." className="text-foreground/80" />
    case 'followUpDate':
      return <FollowUpDateCell entry={e} onUpdate={onUpdate} />
    case 'openCount':
      return (
        <span className="text-xs tabular-nums" title={e.lastOpenedAt ? `Last opened ${new Date(e.lastOpenedAt).toLocaleString()}` : 'No opens tracked yet'}>
          {e.openCount ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{e.openCount}×</span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
        </span>
      )
    case 'autoFollowup':
      // Phase 7 — toggle the cron-auto-followup behaviour per row.
      // Disabled when the user has no Unipile account; the cron skips
      // those rows anyway but disabling the UI signals why.
      return (
        <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none" title={profile?.unipileAccountId ? 'Auto-send a follow-up when Follow Up Date hits and no reply has been received.' : 'Connect Gmail in Profile to enable auto-follow-ups.'}>
          <input
            type="checkbox"
            checked={!!e.autoFollowup}
            disabled={!profile?.unipileAccountId}
            onChange={ev => onUpdate(e.id, 'autoFollowup', ev.target.checked)}
            className="accent-purple-600 disabled:opacity-40"
          />
          <span className={profile?.unipileAccountId ? 'text-foreground/80' : 'text-muted-foreground/60'}>
            {e.autoFollowup ? 'On' : 'Off'}
          </span>
        </label>
      )
    case 'dateReachedOut':
    case 'responseDate':
    case 'meetingScheduled':
      return <input type="date" value={(e[id] as string) || ''} onChange={ev => onUpdate(e.id, id, ev.target.value)} className="bg-muted border border-border rounded px-2 py-0.5 text-xs text-foreground focus:outline-none focus:border-purple-500 w-full" />
    case 'touchpoints':
      return <input type="number" min={0} value={e.touchpoints || ''} onChange={ev => onUpdate(e.id, 'touchpoints', ev.target.value)} placeholder="0" className="w-full bg-transparent text-foreground focus:outline-none focus:bg-muted rounded px-1 text-xs" />
    case 'subscribers':
      return <span className="text-xs text-muted-foreground">{formatSubscribers(e.subscribers || '')}</span>
    case 'avgViews':
      return <span className="text-xs text-muted-foreground">{e.avgViews ? e.avgViews.toLocaleString() : '—'}</span>
    case 'fitScore': {
      const { label, color } = fitScoreMeta(e.fitScore || 0)
      return <span className={`text-xs font-bold ${color}`}>{e.fitScore || 0} <span className="font-normal opacity-70">{label}</span></span>
    }
    case 'addedAt':
      // Relative time ("3m ago", "2h ago", "5d ago"), with the full
      // local timestamp on hover. Empty addedAt (legacy rows) shows
      // an em-dash so sorting still pushes them to the bottom.
      return e.addedAt ? (
        <span
          className="text-xs text-muted-foreground tabular-nums"
          title={new Date(e.addedAt).toLocaleString()}
        >
          {formatAddedAtRelative(e.addedAt)}
        </span>
      ) : <span className="text-muted-foreground/50">—</span>

    case 'linkedin':
      // Click LinkedIn → opens profile + copies templated message.
      // Same pattern as Instagram (LinkedIn has no DM deep-link).
      return e.linkedin ? (
        <a
          href={e.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => copyLinkedInMessage(e.channelName)}
          title="Open LinkedIn + copy message template to clipboard"
          className="text-blue-800 dark:text-blue-400 hover:underline text-xs"
        >
          Message
        </a>
      ) : (
        <AutoTextarea value={e.linkedin || ''} onChange={v => onUpdate(e.id, 'linkedin', v)} placeholder="Add URL..." className="text-muted-foreground" />
      )
    case 'instagram':
      // Instagram link: clicking opens the profile AND copies a
      // templated DM to the clipboard (per Dylan: "click on the
      // instagram it pulls up templated language to copy and paste").
      // The browser's default link target="_blank" still navigates;
      // onClick runs in parallel.
      return e.instagram ? (
        <a
          href={e.instagram}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => copyInstagramDm(e.channelName)}
          title="Open IG + copy DM template to clipboard"
          className="text-pink-700 dark:text-pink-400 hover:underline text-xs"
        >
          DM
        </a>
      ) : (
        <AutoTextarea value={e.instagram || ''} onChange={v => onUpdate(e.id, 'instagram', v)} placeholder="Add IG URL..." className="text-muted-foreground" />
      )
    case 'twitter':
      return e.twitter ? <a href={e.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-800 dark:text-blue-400 hover:underline text-xs">link</a> : <AutoTextarea value={e.twitter || ''} onChange={v => onUpdate(e.id, 'twitter', v)} placeholder="Add X URL..." className="text-muted-foreground" />
    case 'tiktok':
      return e.tiktok ? <a href={e.tiktok} target="_blank" rel="noopener noreferrer" className="text-blue-800 dark:text-blue-400 hover:underline text-xs">link</a> : <AutoTextarea value={e.tiktok || ''} onChange={v => onUpdate(e.id, 'tiktok', v)} placeholder="Add TikTok URL..." className="text-muted-foreground" />
    case 'website':
      return e.website ? <a href={e.website} target="_blank" rel="noopener noreferrer" className="text-blue-800 dark:text-blue-400 hover:underline text-xs">link</a> : <AutoTextarea value={e.website || ''} onChange={v => onUpdate(e.id, 'website', v)} placeholder="Add website..." className="text-muted-foreground" />
    case 'contentNiche':
      return <AutoTextarea value={e.contentNiche || ''} onChange={v => onUpdate(e.id, 'contentNiche', v)} placeholder="e.g. golf, finance..." className="text-foreground" />
    case 'phone':
      return <AutoTextarea value={e.phone || ''} onChange={v => onUpdate(e.id, 'phone', v)} placeholder="Add phone..." className="text-foreground" />
    case 'dealValue':
      return <AutoTextarea value={e.dealValue || ''} onChange={v => onUpdate(e.id, 'dealValue', v)} placeholder="$..." className="text-foreground" />
    case 'contractSent':
      return <input type="checkbox" checked={!!e.contractSent} onChange={ev => onUpdate(e.id, 'contractSent', ev.target.checked)} className="w-4 h-4 rounded accent-blue-500 cursor-pointer mt-0.5" />
    default:
      return null
  }
}
