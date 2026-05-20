'use client'

/**
 * WrapUpEngagementModal — modal opened when the user clicks the
 * Completed lifecycle button on an active-client engagement.
 *
 * Captures the data a CRM should capture at close:
 *   • Final value (what was actually paid — may differ from budget)
 *   • Completion date (defaults to today)
 *   • 1-5 star rating
 *   • Repeat likelihood (Definitely / Likely / Maybe / No)
 *   • Optional extras: testimonial + public-use checkbox, referrals,
 *     deliverable URLs, free-form wrap-up note
 *
 * Submitting calls lib/storage.wrapUpEngagement() which:
 *   1. Patches lifecycle to 'completed' + saves the structured fields
 *   2. Composes a snapshot block ([Wrap-up · DATE] + contract +
 *      testimonial + referrals + deliverables + note) into client_notes
 *      so historical records survive 7-day signed-URL expiry
 *   3. For Definitely/Likely repeats, auto-creates a follow-on
 *      outreach_entries row for the same channel (Likely gets the
 *      pending_confirmation pill)
 *
 * Renders on TOP of ActiveClientDetailModal — the engagement context
 * stays visible behind it.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { OutreachEntry, ClientRepeatLikelihood } from '@/lib/types'
import type { WrapUpPayload } from '@/lib/storage'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import {
  X as XIcon, Loader2, Star, ChevronDown,
  Repeat, AlertCircle,
} from 'lucide-react'

interface WrapUpEngagementModalProps {
  entry: OutreachEntry
  onSubmit: (payload: WrapUpPayload) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
}

const REPEAT_OPTIONS: { id: ClientRepeatLikelihood; label: string; description: string; accent: 'green' | 'blue' | 'amber' | 'gray' }[] = [
  { id: 'definitely', label: 'Definitely',  description: 'Next project already in motion', accent: 'green' },
  { id: 'likely',     label: 'Likely',      description: 'Happy client, no specific plans yet', accent: 'blue' },
  { id: 'maybe',      label: 'Maybe',       description: 'Could go either way — needs nurturing', accent: 'amber' },
  { id: 'no',         label: 'No',          description: 'One-off project, no repeat expected', accent: 'gray' },
]

const FOLLOWUP_DAYS: Record<ClientRepeatLikelihood, number | null> = {
  definitely: 30,
  likely:     60,
  maybe:      120,
  no:         null,
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function WrapUpEngagementModal({ entry, onSubmit, onClose }: WrapUpEngagementModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(dialogRef, true)

  // Required fields
  const [finalValue, setFinalValue] = useState<string>(
    typeof entry.clientBudgetAmount === 'number' ? String(entry.clientBudgetAmount) : '',
  )
  const [completionDate, setCompletionDate] = useState<string>(todayIso())
  const [rating, setRating] = useState<number>(0)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [repeat, setRepeat] = useState<ClientRepeatLikelihood | null>(null)

  // Optional extras
  const [extrasOpen, setExtrasOpen] = useState<boolean>(false)
  const [testimonial, setTestimonial] = useState<string>('')
  const [testimonialPublic, setTestimonialPublic] = useState<boolean>(false)
  const [referrals, setReferrals] = useState<string>('')
  const [deliverableUrls, setDeliverableUrls] = useState<string>('')
  const [wrapUpNote, setWrapUpNote] = useState<string>('')

  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Escape closes (unless mid-submit).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const channel = entry.channelName || '(unnamed engagement)'

  // Validation — required fields must be filled.
  const valid = useMemo(() => {
    if (!completionDate) return false
    if (rating < 1 || rating > 5) return false
    if (!repeat) return false
    return true
  }, [completionDate, rating, repeat])

  const followupCopy = useMemo(() => {
    if (!repeat) return null
    const days = FOLLOWUP_DAYS[repeat]
    if (repeat === 'definitely') {
      return `A new outreach row will be created for ${channel} with a follow-up date in ${days} days. You'll see it in your Outreach pipeline.`
    }
    if (repeat === 'likely') {
      return `A new outreach row will be created for ${channel} with a "Pending — confirm next engagement?" pill (follow-up date in ${days} days). Click the pill later to confirm or deny.`
    }
    if (repeat === 'maybe') {
      return `No automatic outreach row will be created. The engagement is logged as completed.`
    }
    return `Engagement closes as one-off. No new outreach row created.`
  }, [repeat, channel])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || !repeat) return
    setError(null)
    setSubmitting(true)
    const valueNum = finalValue.trim() === '' ? null : Number(finalValue)
    if (valueNum != null && Number.isNaN(valueNum)) {
      setError('Final value is not a valid number.')
      setSubmitting(false)
      return
    }
    const result = await onSubmit({
      finalValue: valueNum,
      completionDate,
      rating,
      repeatLikelihood: repeat,
      testimonial: testimonial.trim() || undefined,
      testimonialPublic,
      referrals: referrals.trim() || undefined,
      deliverableUrls: deliverableUrls.trim() || undefined,
      wrapUpNote: wrapUpNote.trim() || undefined,
    })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error || 'Save failed.')
      return
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={() => { if (!submitting) onClose() }}
    >
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-xl max-h-[92vh] overflow-y-auto focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-border flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[16px] font-semibold text-foreground">
                Wrap up engagement
              </h2>
              <p className="text-[12.5px] text-muted-foreground/85 mt-0.5 truncate">
                Closing out <span className="font-semibold text-foreground/90">{channel}</span> — capture the close + set up the future.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40"
              aria-label="Close"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Required: outcome */}
          <div className="px-5 py-4 space-y-4 border-b border-border">
            <SectionTitle>Outcome</SectionTitle>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="wrap-final-value">Final value</FieldLabel>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground tabular-nums">
                    {entry.clientBudgetCurrency || 'USD'}
                  </span>
                  <input
                    id="wrap-final-value"
                    type="text"
                    inputMode="decimal"
                    value={finalValue}
                    onChange={e => setFinalValue(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder={typeof entry.clientBudgetAmount === 'number' ? String(entry.clientBudgetAmount) : '0'}
                    disabled={submitting}
                    className="w-full bg-background border border-border rounded-md pl-12 pr-2.5 py-1.5 text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
                  />
                </div>
                <FieldHint>
                  Pre-filled from your budget. Update if you ended up at a different number.
                </FieldHint>
              </div>

              <div>
                <FieldLabel htmlFor="wrap-completion-date">Completion date</FieldLabel>
                <input
                  id="wrap-completion-date"
                  type="date"
                  value={completionDate}
                  onChange={e => setCompletionDate(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
                />
                <FieldHint>Editable for retroactive entries.</FieldHint>
              </div>
            </div>

            {/* Rating */}
            <div>
              <FieldLabel>How did this engagement go?</FieldLabel>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => {
                  const filled = (hoverRating || rating) >= star
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      disabled={submitting}
                      className="p-1 -ml-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50 transition-transform hover:scale-110"
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      aria-pressed={rating === star}
                    >
                      <Star
                        className={[
                          'w-6 h-6 transition-colors',
                          filled
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-muted-foreground/40',
                        ].join(' ')}
                        aria-hidden
                      />
                    </button>
                  )
                })}
                <span className="ml-3 text-[11.5px] text-muted-foreground/85 tabular-nums">
                  {rating > 0 ? `${rating} / 5` : 'unrated'}
                </span>
              </div>
            </div>
          </div>

          {/* Required: future */}
          <div className="px-5 py-4 space-y-3 border-b border-border">
            <SectionTitle>
              <Repeat className="w-3.5 h-3.5" />
              Repeat business
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {REPEAT_OPTIONS.map(opt => (
                <RepeatButton
                  key={opt.id}
                  label={opt.label}
                  description={opt.description}
                  accent={opt.accent}
                  selected={repeat === opt.id}
                  onClick={() => setRepeat(opt.id)}
                  disabled={submitting}
                />
              ))}
            </div>
            {followupCopy && (
              <div className="flex items-start gap-2 text-[11.5px] text-muted-foreground/85 leading-snug bg-muted/40 border border-border rounded-md px-2.5 py-2 mt-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500/80" aria-hidden />
                <span>{followupCopy}</span>
              </div>
            )}
          </div>

          {/* Optional extras — collapsible */}
          <div className="px-5 py-4 border-b border-border">
            <button
              type="button"
              onClick={() => setExtrasOpen(v => !v)}
              className="w-full flex items-center justify-between gap-2 text-[12px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={extrasOpen}
            >
              <span>Capture extras (optional)</span>
              <ChevronDown
                className={[
                  'w-3.5 h-3.5 transition-transform',
                  extrasOpen ? 'rotate-180' : '',
                ].join(' ')}
                aria-hidden
              />
            </button>

            {extrasOpen && (
              <div className="mt-3 space-y-4">
                {/* Testimonial */}
                <div>
                  <FieldLabel htmlFor="wrap-testimonial">Testimonial</FieldLabel>
                  <textarea
                    id="wrap-testimonial"
                    rows={3}
                    value={testimonial}
                    onChange={e => setTestimonial(e.target.value)}
                    placeholder={`What did ${channel} say about working with you?`}
                    disabled={submitting}
                    className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
                  />
                  <label className="mt-1.5 flex items-center gap-2 text-[12px] text-foreground/85 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={testimonialPublic}
                      onChange={e => setTestimonialPublic(e.target.checked)}
                      disabled={submitting}
                      className="rounded"
                    />
                    OK to use publicly (case studies, landing page)
                  </label>
                </div>

                {/* Referrals */}
                <div>
                  <FieldLabel htmlFor="wrap-referrals">Referrals mentioned</FieldLabel>
                  <textarea
                    id="wrap-referrals"
                    rows={2}
                    value={referrals}
                    onChange={e => setReferrals(e.target.value)}
                    placeholder="Names + contacts of anyone they suggested you reach out to"
                    disabled={submitting}
                    className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
                  />
                </div>

                {/* Deliverable URLs */}
                <div>
                  <FieldLabel htmlFor="wrap-deliverables">Deliverable links</FieldLabel>
                  <textarea
                    id="wrap-deliverables"
                    rows={3}
                    value={deliverableUrls}
                    onChange={e => setDeliverableUrls(e.target.value)}
                    placeholder={'https://youtu.be/...\nhttps://drive.google.com/...'}
                    disabled={submitting}
                    className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] font-mono resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
                  />
                  <FieldHint>One URL per line. Surfaces in engagement notes for portfolio use later.</FieldHint>
                </div>

                {/* Wrap-up note */}
                <div>
                  <FieldLabel htmlFor="wrap-note">Note for future self</FieldLabel>
                  <textarea
                    id="wrap-note"
                    rows={3}
                    value={wrapUpNote}
                    onChange={e => setWrapUpNote(e.target.value)}
                    placeholder="What worked / what didn't, anything you'd want to remember when re-engaging"
                    disabled={submitting}
                    className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="px-5 pt-3">
              <div className="flex items-start gap-2 text-[12px] text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-2.5 py-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !valid}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-[13px] font-semibold shadow-sm shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Wrapping up…</>
                : 'Mark completed'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Bits ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">
      {children}
    </h3>
  )
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80 mb-1"
    >
      {children}
    </label>
  )
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[11px] text-muted-foreground/70 leading-snug">
      {children}
    </p>
  )
}

function RepeatButton({
  label, description, accent, selected, onClick, disabled,
}: {
  label: string
  description: string
  accent: 'green' | 'blue' | 'amber' | 'gray'
  selected: boolean
  onClick: () => void
  disabled: boolean
}) {
  const selectedStyles: Record<'green' | 'blue' | 'amber' | 'gray', string> = {
    green: 'bg-green-500/15 border-green-500/60 text-green-700 dark:text-green-300 shadow-sm shadow-green-500/10',
    blue:  'bg-blue-500/15 border-blue-500/60 text-blue-700 dark:text-blue-300 shadow-sm shadow-blue-500/10',
    amber: 'bg-amber-500/15 border-amber-500/60 text-amber-700 dark:text-amber-300 shadow-sm shadow-amber-500/10',
    gray:  'bg-foreground/10 border-foreground/40 text-foreground shadow-sm',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'text-left rounded-md border px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        selected
          ? selectedStyles[accent]
          : 'bg-background border-border text-foreground hover:bg-muted/60',
      ].join(' ')}
    >
      <div className="text-[13px] font-semibold">{label}</div>
      <div className={['text-[11.5px] mt-0.5 leading-snug', selected ? 'opacity-90' : 'text-muted-foreground/85'].join(' ')}>
        {description}
      </div>
    </button>
  )
}
