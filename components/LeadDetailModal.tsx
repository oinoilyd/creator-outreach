'use client'

import { motion } from 'motion/react'
import { useEffect, useId, useRef } from 'react'
import type { Creator, OutreachEntry, UserProfile } from '@/lib/types'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { buildOutreachEmail, buildOutreachContent, recipientIssue } from '@/lib/format'
import { copyInstagramDm, copyLinkedInMessage } from '@/lib/outreach'

export function LeadDetailModal({ entry, onUpdate, onClose, profile }: {
  entry: OutreachEntry
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onClose: () => void
  /** Passed-through so we can decide between Unipile send vs compose-URL
   *  fallback for the primary CTA. NULL = no profile loaded yet → just
   *  use the compose-URL path. */
  profile?: UserProfile | null
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Focus trap + return-focus + escape-to-close. Renders only when
  // open (controlled by parent), so passing `true` is correct here.
  useFocusTrap(dialogRef, true)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const initials = (entry.channelName || '?')
    .trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?'

  const tps = parseInt(entry.touchpoints || '0', 10) || 0
  const dealValue = parseFloat(String(entry.dealValue || '').replace(/[^0-9.]/g, '')) || 0

  // Primary outreach CTA — picks the modality based on what's available.
  // Per Dylan 2026-05-10: prefer Email if a valid email exists, else IG
  // if an Instagram handle exists, else LinkedIn if a profile URL exists,
  // else don't show the button at all.
  //
  // This is ADDITIVE — every other email/IG/LinkedIn trigger in the app
  // (row icons, day-sheet rows, follow-ups, etc.) keeps working. This
  // CTA just adds one more entry point for users who navigated into the
  // lead's detail view first.
  type Modality = 'email' | 'instagram' | 'linkedin' | null
  const emailIsValid = recipientIssue(entry.email, profile?.userEmail) === null
  const igHandle = entry.instagram?.replace('@', '').trim() || ''
  const igUrl = igHandle ? (igHandle.startsWith('http') ? igHandle : `https://instagram.com/${igHandle}`) : ''
  const liUrl = (entry.linkedin || '').trim()
  const modality: Modality =
    emailIsValid ? 'email'
    : igUrl ? 'instagram'
    : liUrl ? 'linkedin'
    : null

  // A lead is in 'follow-up' state when prior outreach has happened —
  // reachedOut flag set OR an initial dateReachedOut timestamp exists.
  // Drives the SendPreviewModal labels (Send outreach → Send follow-up).
  const isFollowUp = !!(entry.reachedOut || (entry.dateReachedOut && entry.dateReachedOut.trim().length > 0))

  function handleCta() {
    if (modality === 'email') {
      // Match the row-click flow: if Unipile is connected, dispatch the
      // event that Home() listens for and opens the SendPreviewModal.
      // Otherwise open the compose-URL (mailto / Gmail web compose).
      const content = buildOutreachContent(
        { channelName: entry.channelName, email: entry.email, videoTitles: [], description: entry.description } as unknown as Creator,
        profile,
        undefined,
      )
      if (profile?.unipileAccountId && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('open-send-modal', {
          detail: {
            entryId: entry.id,
            to: entry.email,
            subject: content.subject,
            body: content.body,
            recipientLabel: entry.channelName,
            isFollowUp,
          },
        }))
        onClose()  // close the detail modal so the send preview is unobstructed
        return
      }
      const href = buildOutreachEmail(
        { channelName: entry.channelName, email: entry.email, videoTitles: [], description: entry.description } as unknown as Creator,
        profile,
        entry.trackingId,
      )
      if (href) window.open(href, '_blank', 'noopener,noreferrer')
      // Auto-flip status to 'No Response' on first click — same rule
      // as the row-level email click handler in app/page.tsx.
      if (entry.status === 'Not Outreached' || !entry.status) {
        onUpdate(entry.id, 'status', 'No Response')
      }
    } else if (modality === 'instagram') {
      window.open(igUrl, '_blank', 'noopener,noreferrer')
      copyInstagramDm(entry.channelName)
    } else if (modality === 'linkedin') {
      window.open(liUrl, '_blank', 'noopener,noreferrer')
      copyLinkedInMessage(entry.channelName)
    }
  }

  const statusColor = {
    'Successful': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    'Rejected': 'bg-red-500/15 text-red-300 border-red-500/40',
    'Open': 'bg-blue-500/15 text-blue-300 border-blue-500/40',
    'No Response': 'bg-gray-500/15 text-foreground/80 border-border/40',
    'Not Outreached': 'bg-muted/40 text-muted-foreground border-border',
    '': 'bg-muted/40 text-muted-foreground border-border',
  }[entry.status] || 'bg-muted/40 text-muted-foreground border-border'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-2xl max-h-[92vh] overflow-y-auto focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white text-sm font-semibold flex items-center justify-center shrink-0" aria-hidden>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-foreground truncate">{entry.channelName || '(unnamed)'}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${statusColor}`}>
                {entry.status || 'Not Outreached'}
              </span>
              {entry.favorite && <span className="text-[10px] text-yellow-400">★ Favorite</span>}
              {entry.channelUrl && (
                <a href={entry.channelUrl} target="_blank" className="text-[11px] text-blue-400 hover:underline">
                  YouTube ↗
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close lead details"
            className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0 w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
          >✕</button>
        </div>

        {/* Primary outreach CTA — picks the available channel.
            See modality selection above for priority logic. Hidden
            entirely when no contact method is available. */}
        {modality && (
          <div className="px-5 pt-4 pb-4 border-b border-border">
            <button
              type="button"
              onClick={handleCta}
              className={`w-full inline-flex items-center justify-between gap-3 rounded-xl px-5 py-3.5 font-semibold text-white shadow-md transition-all ${
                modality === 'email'    ? 'bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-purple-500/20' :
                modality === 'instagram'? 'bg-gradient-to-br from-pink-500 to-orange-500 hover:from-pink-400 hover:to-orange-400 shadow-pink-500/20' :
                                          'bg-gradient-to-br from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 shadow-blue-500/20'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {modality === 'email' && (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <span className="text-sm">{isFollowUp ? 'Send follow-up email' : 'Send outreach email'}</span>
                  </>
                )}
                {modality === 'instagram' && (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                    <span className="text-sm">Send Instagram DM</span>
                  </>
                )}
                {modality === 'linkedin' && (
                  <>
                    <span className="text-base font-bold leading-none">in</span>
                    <span className="text-sm">Open LinkedIn DM</span>
                  </>
                )}
              </span>
              <span className="text-xs opacity-80">
                {modality === 'email'    && (profile?.unipileAccountId ? 'preview & send →' : 'opens compose →')}
                {modality === 'instagram'&& 'opens IG + copies template →'}
                {modality === 'linkedin' && 'opens LinkedIn + copies template →'}
              </span>
            </button>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
              {modality === 'email' && `Uses your outreach template${profile?.subjectTemplate ? '' : ' + the default subject line'}.`}
              {modality === 'instagram' && 'No email on file. Opens Instagram and copies the templated DM to your clipboard — paste in the chat.'}
              {modality === 'linkedin' && 'No email or Instagram on file. Opens LinkedIn and copies the templated message to your clipboard.'}
            </p>
          </div>
        )}

        {/* Channel-level stats */}
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-border">
          <Stat label="Subscribers" value={entry.subscribers || '—'} />
          <Stat label="Avg views" value={entry.avgViews ? entry.avgViews.toLocaleString() : '—'} />
          <Stat label="Fit score" value={entry.fitScore ? Math.round(entry.fitScore).toString() : '—'} />
          <Stat label="Deal value" value={dealValue > 0 ? `$${dealValue.toLocaleString()}` : '—'} highlight={dealValue > 0} />
        </div>

        {/* Outreach status section */}
        <div className="p-5 border-b border-border space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Outreach status</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={entry.status || 'Not Outreached'}
                onChange={e => onUpdate(entry.id, 'status', e.target.value)}
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500"
              >
                <option value="Not Outreached">Not Outreached</option>
                <option value="Open">Open</option>
                <option value="No Response">No Response</option>
                <option value="Successful">Successful</option>
                <option value="Rejected">Rejected</option>
              </select>
            </Field>
            <Field label="Medium">
              <select
                value={entry.medium}
                onChange={e => onUpdate(entry.id, 'medium', e.target.value)}
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500"
              >
                <option value="">—</option>
                <option value="Email">Email</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Date reached out">
              <input type="date" value={entry.dateReachedOut || ''} onChange={e => onUpdate(entry.id, 'dateReachedOut', e.target.value)} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500" />
            </Field>
            <Field label="Follow-up date">
              <input type="date" value={entry.followUpDate || ''} onChange={e => onUpdate(entry.id, 'followUpDate', e.target.value)} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500" />
            </Field>
            <Field label="Response date">
              <input type="date" value={entry.responseDate || ''} onChange={e => onUpdate(entry.id, 'responseDate', e.target.value)} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500" />
            </Field>
            <Field label="# Touchpoints">
              <input type="number" min={0} value={entry.touchpoints || '0'} onChange={e => onUpdate(entry.id, 'touchpoints', e.target.value)} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500" />
            </Field>
          </div>
          {entry.headerUsed && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Subject line / opener used</div>
              <div className="text-xs text-foreground/80 bg-muted/40 border border-border rounded px-3 py-2">{entry.headerUsed}</div>
            </div>
          )}
        </div>

        {/* Contact + socials — every field editable */}
        <div className="p-5 border-b border-border space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Contact</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/*
              Placeholders read as obvious empty-state hints ("Not set
              — add an email" etc.) and render in italic + faded so an
              empty field can't be mistaken for a filled-in real value.
              Per Dylan 2026-05-10: previous placeholders ("hello@example.com",
              "https://linkedin.com/in/…", "+1 555 123 4567") looked like
              real data and made the modal feel pre-filled.
            */}
            <Field label="Email">
              <input
                type="email"
                value={entry.email}
                onChange={e => onUpdate(entry.id, 'email', e.target.value)}
                placeholder="Not set — add an email"
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500 placeholder:italic placeholder:text-muted-foreground/45"
              />
            </Field>
            <Field label="LinkedIn">
              <input
                type="url"
                value={entry.linkedin}
                onChange={e => onUpdate(entry.id, 'linkedin', e.target.value)}
                placeholder="Not set — paste LinkedIn URL"
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500 placeholder:italic placeholder:text-muted-foreground/45"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={entry.phone}
                onChange={e => onUpdate(entry.id, 'phone', e.target.value)}
                placeholder="Not set — add a phone number"
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500 placeholder:italic placeholder:text-muted-foreground/45"
              />
            </Field>
            <Field label="Website">
              <input
                type="url"
                value={entry.website}
                onChange={e => onUpdate(entry.id, 'website', e.target.value)}
                placeholder="Not set — paste website URL"
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500 placeholder:italic placeholder:text-muted-foreground/45"
              />
            </Field>
            <Field label="Instagram">
              <input
                type="url"
                value={entry.instagram}
                onChange={e => onUpdate(entry.id, 'instagram', e.target.value)}
                placeholder="Not set — paste Instagram URL"
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500 placeholder:italic placeholder:text-muted-foreground/45"
              />
            </Field>
            <Field label="Twitter / X">
              <input
                type="url"
                value={entry.twitter}
                onChange={e => onUpdate(entry.id, 'twitter', e.target.value)}
                placeholder="Not set — paste X / Twitter URL"
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500 placeholder:italic placeholder:text-muted-foreground/45"
              />
            </Field>
            <Field label="TikTok">
              <input
                type="url"
                value={entry.tiktok}
                onChange={e => onUpdate(entry.id, 'tiktok', e.target.value)}
                placeholder="Not set — paste TikTok URL"
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500 placeholder:italic placeholder:text-muted-foreground/45"
              />
            </Field>
            <Field label="Product / pitch">
              <input
                type="text"
                value={entry.product}
                onChange={e => onUpdate(entry.id, 'product', e.target.value)}
                placeholder="Not set — what are you pitching?"
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500 placeholder:italic placeholder:text-muted-foreground/45"
              />
            </Field>
          </div>
          {tps > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Touch history</span>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(tps, 10) }).map((_, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-purple-500/70" />
                ))}
              </div>
              <span className="text-muted-foreground">{tps} touch{tps === 1 ? '' : 'es'}</span>
            </div>
          )}
        </div>

        {/* Notes (always editable) */}
        <div className="p-5 border-b border-border">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Notes</div>
          <textarea
            value={entry.notes || ''}
            onChange={e => onUpdate(entry.id, 'notes', e.target.value)}
            placeholder="No notes yet — what's the angle?"
            rows={3}
            className="w-full bg-muted border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500 resize-none placeholder:italic placeholder:text-muted-foreground/45"
          />
        </div>

        {/* Description (read-only-ish) */}
        {entry.description && (
          <div className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Channel description</div>
            <div className="text-xs text-muted-foreground leading-relaxed max-h-32 overflow-y-auto bg-muted/30 border border-border rounded px-3 py-2 whitespace-pre-wrap">
              {entry.description}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground/80 hover:text-foreground border border-border hover:border-border rounded-lg transition-colors">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-muted/40 border border-border rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${highlight ? 'text-emerald-300' : 'text-foreground'}`}>{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}

