'use client'

import React from 'react'
import { toast } from 'sonner'
import type { Creator, ColId, ScoreWeights, UserProfile } from '@/lib/types'
import { buildOutreachEmail, formatSubscribers, recipientIssue } from '@/lib/format'
import { copyInstagramDm, copyLinkedInMessage, copyDmForPlatform } from '@/lib/outreach'
import { InstagramCell } from '@/components/InstagramCell'
import { Spinner } from '@/components/ui'
import { FitScoreCell } from './FitScoreCell'
import { InstagramMetricCell } from './InstagramMetricCell'

/**
 * Guard fired by every outreach email link's onClick before navigation.
 *
 * Background: on 2026-05-10 Dylan sent a "test" outreach from an
 * Outreach row and the email landed in his OWN signup inbox instead
 * of the creator's — root cause was a missing recipient where Gmail's
 * compose form auto-filled the To with a recent contact (himself).
 * Now: any click whose recipient is empty / invalid / equals the
 * signed-in user's own email is BLOCKED at the click, with an
 * explanatory toast. The href still resolves to '' from composeUrl
 * so accidentally bypassing the handler (eg. middle-click) also
 * fails closed.
 *
 * Returns true when the navigation should proceed.
 */
export function guardOutreachClick(
  ev: React.MouseEvent<HTMLAnchorElement>,
  toEmail: string | undefined | null,
  userEmail: string | null | undefined,
): boolean {
  const issue = recipientIssue(toEmail, userEmail)
  if (issue === null) return true
  ev.preventDefault()
  ev.stopPropagation()
  if (issue === 'self') {
    toast.error('Blocked: that email is YOUR signup address', {
      description:
        "We refused to open compose because the recipient matches your own login email — sending here would email yourself, not the creator. Open the row, check the Email field, and replace it with the creator's real address.",
      duration: 9000,
    })
  } else if (issue === 'empty') {
    toast.warning('No email on file for this creator', {
      description:
        'Click "🔍 Find email" to deep-search, or paste an address into the Email column manually.',
      duration: 6000,
    })
  } else {
    toast.error(`Invalid recipient: "${(toEmail ?? '').slice(0, 60)}"`, {
      description:
        "That doesn't look like a real email address. Edit the Email field on this row to fix it before sending.",
      duration: 7000,
    })
  }
  return false
}

export function renderCell(
  id: ColId,
  c: Creator,
  weights: ScoreWeights,
  narrative: string,
  profile: UserProfile | null,
  searching: boolean,
  onDeepSearch: (channelId: string) => void,
  onUpdateInstagram?: (channelId: string, igUrl: string) => void,
): React.ReactNode {
  switch (id) {
    case 'fitScore': {
      return <FitScoreCell key={id} c={c} weights={weights} narrative={narrative} />
    }
    case 'avgViews':    return (
      <td key={id} className="px-4 py-3">
        {c.avgViews > 0
          ? c.avgViews.toLocaleString()
          : <span className="text-muted-foreground/40" title="View count not yet available — likely a fetch limit or a channel YouTube couldn't surface stats for">—</span>}
      </td>
    )
    case 'subscribers': return <td key={id} className="px-4 py-3 text-foreground/80">{formatSubscribers(c.subscribers)}</td>
    // What the creator SELLS — short AI summary (course, product,
    // service). Filled in by Phase D enrichment; truncated with the full
    // text on hover. Em-dash when nothing sellable was detected OR while
    // the background pass is still working (it just appears in place).
    case 'product': return (
      <td key={id} className="px-4 py-3 align-top">
        {c.productSummary
          ? <span className="block whitespace-normal break-words text-xs leading-snug text-foreground/80" title={c.productSummary}>{c.productSummary}</span>
          : <span className="text-muted-foreground/40" title="No product detected from this creator's channel (or still checking).">—</span>}
      </td>
    )
    case 'lastVideo': return (
      <td key={id} className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {c.videoDates?.[0]
          ? <><div>{c.videoDates[0]}</div>{c.videoDates[1] && <div className="text-muted-foreground/70">{c.videoDates[1]}</div>}</>
          : <span className="text-muted-foreground/50">—</span>}
      </td>
    )
    case 'lastShort': return (
      <td key={id} className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {c.shortDates?.[0]
          ? <><div>{c.shortDates[0]}</div>{c.shortDates[1] && <div className="text-muted-foreground/70">{c.shortDates[1]}</div>}</>
          : <span className="text-muted-foreground/50">—</span>}
      </td>
    )
    case 'email': return (
      <td key={id} className="px-4 py-3 text-xs">
        {c.email ? (
          <a
            href={buildOutreachEmail(c, profile)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={ev => guardOutreachClick(ev, c.email, profile?.userEmail)}
            title={c.email}
            className="block truncate text-emerald-700 dark:text-green-400 hover:underline"
          >{c.email}</a>
        ) : c.enriching ? (
          <span className="flex items-center gap-1 text-muted-foreground"><Spinner />looking...</span>
        ) : (
          <button
            onClick={() => onDeepSearch(c.channelId)}
            disabled={searching}
            title="Deep search — checks website (incl. /press, /partnerships, /sponsor), Linktree-style bio pages, social bios, and multiple DDG queries. Takes 10-20s."
            className="text-[10px] text-purple-700 dark:text-purple-400 hover:text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:border-purple-500/60 rounded px-2 py-0.5 transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {searching ? 'Searching…' : '🔍 Find email'}
          </button>
        )}
      </td>
    )
    case 'linkedin':  return <td key={id} className="px-4 py-3">{c.linkedin  ? <a href={c.linkedin}  target="_blank" rel="noopener noreferrer" onClick={() => copyLinkedInMessage(c.channelName, profile)} title="Open LinkedIn + copy message template" className="text-blue-800 dark:text-blue-400 hover:underline">Message</a> : '—'}</td>
    case 'website':   return <td key={id} className="px-4 py-3">{c.website   ? <a href={c.website}   target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'instagram': return (
      <td key={id} className="px-4 py-3">
        <InstagramCell
          channelName={c.channelName}
          instagramUrl={c.instagram}
          onCopyDm={() => copyInstagramDm(c.channelName, profile)}
          onUpdateInstagram={onUpdateInstagram ? (url) => onUpdateInstagram(c.channelId, url) : undefined}
        />
      </td>
    )
    case 'twitter':   return <td key={id} className="px-4 py-3">{c.twitter   ? <a href={c.twitter}   target="_blank" rel="noopener noreferrer" onClick={() => copyDmForPlatform('x_dm', c.channelName, profile)} title="Open X + copy DM template" className="text-blue-800 dark:text-blue-400 hover:underline">Message</a> : '—'}</td>
    case 'tiktok':    return <td key={id} className="px-4 py-3">{c.tiktok    ? <a href={c.tiktok}    target="_blank" rel="noopener noreferrer" onClick={() => copyDmForPlatform('tiktok_dm', c.channelName, profile)} title="Open TikTok + copy DM template" className="text-blue-800 dark:text-blue-400 hover:underline">Message</a> : '—'}</td>
    // YouTube channel link — Dylan 2026-06-09. Surfaces the YT channel
    // alongside other socials, useful when searching a non-YouTube
    // platform and you want quick context on the creator's YT footprint.
    case 'youtube':   return <td key={id} className="px-4 py-3">{c.channelUrl ? <a href={c.channelUrl} target="_blank" rel="noopener noreferrer" title="Open YouTube channel" className="text-red-700 dark:text-red-400 hover:underline">Channel</a> : '—'}</td>
    case 'igFollowers': return <td key={id} className="px-4 py-3 text-xs tabular-nums"><InstagramMetricCell instagramUrl={c.instagram} field="followers" /></td>
    case 'igPosts':     return <td key={id} className="px-4 py-3 text-xs tabular-nums"><InstagramMetricCell instagramUrl={c.instagram} field="posts" /></td>
  }
}
