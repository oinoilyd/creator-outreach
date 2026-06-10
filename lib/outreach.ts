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

import { applyTemplate, resolveTemplate, type Platform } from './templates'
import type { UserProfile } from './types'

/**
 * Build the standard template variables block from a recipient channel
 * name + the sender's profile. Used by every per-platform DM composer
 * so the variable substitution is consistent across surfaces.
 *
 * The {content} variable falls back to a generic "your recent post"
 * phrase because DM contexts rarely have specific video titles or
 * descriptions tied to the row — the email path that does have those
 * builds vars itself.
 */
function templateVarsFromChannel(channelName: string, profile?: UserProfile | null) {
  const name = (channelName || '').trim() || 'there'
  const firstName = name.split(/\s+/)[0] || name
  const senderFull = (profile?.fullName ?? '').trim()
  const senderFirst = senderFull.split(/\s+/)[0] || 'me'
  const pitch = (profile?.pitchLine ?? '').trim()
  const linkedin = (profile?.linkedinUrl ?? '').trim()
  return {
    name: firstName,
    channel: name,
    content: 'your recent post',
    pitch: pitch ? pitch.replace(/[.!?]+\s*$/, '') + '.' : 'I think I can support what you\'re building.',
    sender_first: senderFirst,
    sender_full: senderFull,
    linkedin,
  }
}

/**
 * Per-platform DM template composer. Looks up the user's saved
 * template for `platform` (Templates modal in the hamburger menu)
 * and substitutes {name}, {channel}, {content}, etc. Falls back to
 * the bundled default in lib/templates.ts when the user hasn't
 * customized that platform yet.
 *
 * Used by the clipboard-copy handlers below; the click on a creator
 * cell opens the profile URL + pastes the rendered template.
 */
export function composeDmForPlatform(
  platform: Platform,
  channelName: string,
  profile?: UserProfile | null,
): string {
  const template = resolveTemplate(platform, getProfileTemplateOverride(platform, profile))
  return applyTemplate(template, templateVarsFromChannel(channelName, profile))
}

function getProfileTemplateOverride(platform: Platform, profile?: UserProfile | null): string | null | undefined {
  switch (platform) {
    case 'email':       return profile?.emailTemplate
    case 'ig_dm':       return profile?.igDmTemplate
    case 'linkedin_dm': return profile?.linkedinDmTemplate
    case 'x_dm':        return profile?.xDmTemplate
    case 'tiktok_dm':   return profile?.tiktokDmTemplate
  }
}

/**
 * Instagram DM — back-compat wrapper. Existing callers pass just
 * channelName; the new optional `profile` parameter enables the
 * user's saved IG template + variable substitution. Falls through
 * to the bundled default if profile is missing or has no override.
 */
export function composeInstagramDm(channelName: string, profile?: UserProfile | null): string {
  return composeDmForPlatform('ig_dm', channelName, profile)
}

/** Click handler for Instagram cells: copy the templated DM to the
 *  clipboard and toast it. Fires alongside the link's default
 *  target="_blank" navigation, so the IG profile opens in a new tab
 *  AND the DM template is ready to paste in one click. */
export function copyInstagramDm(channelName: string, profile?: UserProfile | null) {
  const dm = composeInstagramDm(channelName, profile)
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

/** LinkedIn-specific message template — uses the user's saved template
 *  if set, else the bundled default. Same flow: click the LinkedIn
 *  cell → opens profile in a new tab + writes this template to the
 *  clipboard. */
export function composeLinkedInMessage(channelName: string, profile?: UserProfile | null): string {
  return composeDmForPlatform('linkedin_dm', channelName, profile)
}

export function copyLinkedInMessage(channelName: string, profile?: UserProfile | null) {
  const msg = composeLinkedInMessage(channelName, profile)
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

/**
 * Copy a DM template for an arbitrary platform (X DM, TikTok DM, etc.).
 * Wraps composeDmForPlatform + the clipboard + toast pattern from above
 * so any new "DM cell" can wire to one function.
 *
 * Not yet called from any cell — X + TikTok send surfaces are a
 * planned follow-up (see /admin/roadmap). The function exists now so
 * the Templates modal isn't a dangling UI surface for those platforms.
 */
export function copyDmForPlatform(
  platform: Platform,
  channelName: string,
  profile?: UserProfile | null,
) {
  const msg = composeDmForPlatform(platform, channelName, profile)
  if (!navigator.clipboard?.writeText) {
    toast.error('Clipboard not available — copy DM manually')
    return
  }
  const platformLabel = ({
    email: 'Email',
    ig_dm: 'Instagram DM',
    linkedin_dm: 'LinkedIn DM',
    x_dm: 'X DM',
    tiktok_dm: 'TikTok DM',
  } as Record<Platform, string>)[platform]
  navigator.clipboard.writeText(msg).then(
    () => toast.success(`${platformLabel} template copied`, {
      description: `Paste to ${channelName || 'creator'}`,
    }),
    () => toast.error(`Failed to copy ${platformLabel} template`),
  )
}

// ── Bounced-email recovery ─────────────────────────────────────────
// markEmailBounced + its /api/contacts/mark-bounced route removed in
// the 2026-06-10 audit. The trash icon that called it was already
// gone (2026-06-09), so the function was dead code AND the route was
// a cross-user cache-poisoning vector (any authed user could flag any
// channel's email bad in the shared creator_enrichment cache). If
// email-bad flagging returns, rebuild it with an ownership check.
