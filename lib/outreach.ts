'use client'

/**
 * Outreach-domain helpers — filtering, follow-up cadence math, and
 * social-platform message composition.
 *
 * Extracted from app/page.tsx (the 6,200-line monolith) as part of
 * the architectural debt cleanup. None of these depend on app state;
 * they're pure logic + the optional `toast` integration for clipboard
 * feedback. Co-locating them here lets multiple components import
 * them without dragging in the rest of page.tsx.
 */

import { toast } from 'sonner'
import type { OutreachEntry } from './types'

// ── Filtering ──────────────────────────────────────────────────────

/**
 * Substring filter across the OutreachEntry fields a user is most
 * likely to type when searching their own pipeline. Case-insensitive
 * match across name / email / notes / product / niche / channel ID.
 *
 * Whitespace-only / empty query returns the input unchanged so this
 * is cheap to call universally — the search box can fire on every
 * keystroke without forcing a special-case at the callsite.
 */
export function filterOutreachByKeyword(list: OutreachEntry[], rawKeyword: string): OutreachEntry[] {
  const q = rawKeyword.trim().toLowerCase()
  if (!q) return list
  return list.filter(e =>
    (e.channelName || '').toLowerCase().includes(q) ||
    (e.email || '').toLowerCase().includes(q) ||
    (e.notes || '').toLowerCase().includes(q) ||
    (e.product || '').toLowerCase().includes(q) ||
    (e.contentNiche || '').toLowerCase().includes(q) ||
    (e.headerUsed || '').toLowerCase().includes(q) ||
    (e.channelId || '').toLowerCase().includes(q),
  )
}

// ── Follow-up cadence ─────────────────────────────────────────────

/**
 * Progressive follow-up cadence — most replies come from touch 2 / 3,
 * not touch 5+. Tighter intervals early, looser later.
 *
 * Touch 0/1 → 3 days  (initial bump)
 * Touch 2   → 7 days  (week-out check)
 * Touch 3   → 14 days (two-week)
 * Touch 4+  → 21 days (final attempt rhythm)
 */
export function nextFollowUpDays(touchpoints: number): number {
  if (touchpoints <= 1) return 3
  if (touchpoints === 2) return 7
  if (touchpoints === 3) return 14
  return 21
}

/** Human label paired with nextFollowUpDays — used in tooltips and
 *  follow-up row labels so the UI explains what the cadence reset
 *  will produce. */
export function followUpStageLabel(touchpoints: number): string {
  if (touchpoints <= 1) return 'First follow-up'
  if (touchpoints === 2) return 'Second follow-up'
  if (touchpoints === 3) return 'Third follow-up'
  return 'Final attempt'
}

// ── Social platform message templates ──────────────────────────────

/**
 * Instagram DM template — IG has no `mailto:`-equivalent, so the UX is:
 *   1. Click on Instagram cell opens the IG profile in a new tab
 *   2. Same click copies this template to the clipboard
 *   3. User pastes into the DM box manually
 *
 * `[insert specific thing]` and `[your product]` are intentional
 * placeholders the user fills before sending.
 */
export function composeInstagramDm(channelName: string): string {
  const name = (channelName || '').trim() || 'there'
  // First whitespace-separated word for a "first name"-style greeting.
  // "Vince Lymburn" → "Vince", "CoinDesk" → "CoinDesk",
  // "Zebu Live | UK's Flagship Web3 Summit" → "Zebu".
  const firstName = name.split(/\s+/)[0] || name
  return `Hey ${firstName},

Just discovered ${name} on Instagram and loved [insert specific thing].

I'm building [your product] and would love to share what we're up to if you're open to a quick chat.

Either way, keep up the great work!`
}

/** Click handler for Instagram cells: copy the templated DM to the
 *  clipboard and toast it. Fires alongside the link's default
 *  target="_blank" navigation, so the IG profile opens in a new tab
 *  AND the DM template is ready to paste in one click. */
export function copyInstagramDm(channelName: string) {
  const dm = composeInstagramDm(channelName)
  if (!navigator.clipboard?.writeText) {
    toast.error('Clipboard not available — copy DM manually from settings')
    return
  }
  navigator.clipboard.writeText(dm).then(
    () => toast.success('DM template copied', {
      description: `Paste in Instagram DM to ${channelName || 'creator'}`,
    }),
    () => toast.error('Failed to copy DM template'),
  )
}

/** LinkedIn-specific message template — slightly more business-formal
 *  than the IG DM. Same flow: click the LinkedIn cell → opens profile
 *  in a new tab + writes this template to the clipboard so the user
 *  can paste it directly into a connection note or DM. */
export function composeLinkedInMessage(channelName: string): string {
  const name = (channelName || '').trim() || 'there'
  const firstName = name.split(/\s+/)[0] || name
  return `Hi ${firstName},

Came across ${name} on LinkedIn and really liked [insert specific post/topic].

I'm building [your product] and saw a potential fit for what you do. Would love to connect and share what we're up to if it's of interest.

Best,
[your name]`
}

export function copyLinkedInMessage(channelName: string) {
  const msg = composeLinkedInMessage(channelName)
  if (!navigator.clipboard?.writeText) {
    toast.error('Clipboard not available — copy message manually')
    return
  }
  navigator.clipboard.writeText(msg).then(
    () => toast.success('LinkedIn message copied', {
      description: `Paste in connection note or DM to ${channelName || 'creator'}`,
    }),
    () => toast.error('Failed to copy message'),
  )
}

// ── Bounced-email recovery ─────────────────────────────────────────

/**
 * Mark a creator's email as bounced/bad in the durable contacts
 * cache. Fire-and-forget — we don't block the UI on the round-trip.
 * Posts to /api/contacts/mark-bounced which inserts a new
 * creator_enrichment snapshot with email_bounced=true. That row
 * then forces a fresh re-fetch the next time anyone enriches this
 * channel, so we never serve the bad email again.
 */
export async function markEmailBounced(
  channelId: string,
  email: string,
  channelName: string,
): Promise<void> {
  if (!channelId) {
    toast.error("No channel ID — can't mark this email")
    return
  }
  try {
    const res = await fetch('/api/contacts/mark-bounced', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channelId, email }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as { error?: string }))
      toast.error(`Couldn't mark email — ${j.error || `HTTP ${res.status}`}`)
      return
    }
    toast.success(`${channelName || 'Email'} marked bad`, {
      description: 'Cache cleared — next enrichment will re-fetch from scratch.',
    })
  } catch (e: unknown) {
    toast.error(`Couldn't mark email — ${(e as Error)?.message || e}`)
  }
}
