'use client'

/**
 * ManualAddActiveClientModal — direct entry of an active client
 * without going through the outreach pipeline first.
 *
 * Use case: Dylan has clients he booked off-platform (existing
 * relationship, referral, etc.) that he wants tracked here without
 * pretending he ran a cold-outreach loop to find them.
 *
 * Creates an outreach_entries row with status='Successful' AND
 * lifecycle='active' so it shows up immediately in the Active
 * Clients view. The channel_id is synthesized (no real YouTube
 * channel needed) — these rows are filterable / editable like any
 * other engagement.
 *
 * Fields:
 *   • Channel / client name (required)
 *   • Channel URL (optional)
 *   • Email (optional)
 *   • Budget + currency (optional)
 *   • Timeline start / end (optional)
 *   • Scope (optional)
 *   • Engagement notes (optional)
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { X as XIcon, Loader2, AlertCircle, Briefcase } from 'lucide-react'

export interface ManualActiveClientInput {
  channelName: string
  channelUrl: string
  email: string
  budget: number | null
  currency: string
  timelineStart: string  // YYYY-MM-DD or ''
  timelineEnd: string    // YYYY-MM-DD or ''
  scope: string
  notes: string
}

interface ManualAddActiveClientModalProps {
  /** Called when the user submits. Should create the outreach row,
   *  refresh the parent's outreach state, and return ok/error. */
  onSubmit: (input: ManualActiveClientInput) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
}

export function ManualAddActiveClientModal({ onSubmit, onClose }: ManualAddActiveClientModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(dialogRef, true)

  const [channelName, setChannelName] = useState('')
  const [channelUrl, setChannelUrl] = useState('')
  const [email, setEmail] = useState('')
  const [budget, setBudget] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [timelineStart, setTimelineStart] = useState('')
  const [timelineEnd, setTimelineEnd] = useState('')
  const [scope, setScope] = useState('')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const valid = useMemo(() => channelName.trim().length > 0, [channelName])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setError(null)
    setSubmitting(true)
    const budgetNum = budget.trim() === '' ? null : Number(budget)
    if (budgetNum != null && Number.isNaN(budgetNum)) {
      setError('Budget is not a valid number.')
      setSubmitting(false)
      return
    }
    const result = await onSubmit({
      channelName: channelName.trim(),
      channelUrl: channelUrl.trim(),
      email: email.trim(),
      budget: budgetNum,
      currency: currency.trim().toUpperCase() || 'USD',
      timelineStart,
      timelineEnd,
      scope: scope.trim(),
      notes: notes.trim(),
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
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-lg max-h-[92vh] overflow-y-auto focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-border flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[16px] font-semibold text-foreground inline-flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-500" aria-hidden />
                New active client
              </h2>
              <p className="text-[12.5px] text-muted-foreground/85 mt-0.5">
                Skip the outreach pipeline — add a client you already booked.
                Channel name is the only required field; you can fill the
                rest later.
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

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Channel name + URL */}
            <div>
              <FieldLabel htmlFor="mac-name" required>Client / channel name</FieldLabel>
              <input
                id="mac-name"
                type="text"
                value={channelName}
                onChange={e => setChannelName(e.target.value)}
                placeholder="e.g. John Doe Productions"
                required
                autoFocus
                disabled={submitting}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
              />
            </div>

            <div>
              <FieldLabel htmlFor="mac-url">Channel / website URL</FieldLabel>
              <input
                id="mac-url"
                type="url"
                value={channelUrl}
                onChange={e => setChannelUrl(e.target.value)}
                placeholder="https://youtube.com/@... or any link"
                disabled={submitting}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
              />
            </div>

            <div>
              <FieldLabel htmlFor="mac-email">Contact email</FieldLabel>
              <input
                id="mac-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="primary contact for this engagement"
                disabled={submitting}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
              />
            </div>

            {/* Budget + currency */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <FieldLabel htmlFor="mac-budget">Budget</FieldLabel>
                <input
                  id="mac-budget"
                  type="text"
                  inputMode="decimal"
                  value={budget}
                  onChange={e => setBudget(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  disabled={submitting}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
                />
              </div>
              <div>
                <FieldLabel htmlFor="mac-currency">Currency</FieldLabel>
                <input
                  id="mac-currency"
                  type="text"
                  value={currency}
                  onChange={e => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                  placeholder="USD"
                  disabled={submitting}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] font-mono uppercase focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel htmlFor="mac-start">Start</FieldLabel>
                <input
                  id="mac-start"
                  type="date"
                  value={timelineStart}
                  onChange={e => setTimelineStart(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
                />
              </div>
              <div>
                <FieldLabel htmlFor="mac-end">End</FieldLabel>
                <input
                  id="mac-end"
                  type="date"
                  value={timelineEnd}
                  onChange={e => setTimelineEnd(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Scope */}
            <div>
              <FieldLabel htmlFor="mac-scope">Scope</FieldLabel>
              <textarea
                id="mac-scope"
                rows={3}
                value={scope}
                onChange={e => setScope(e.target.value)}
                placeholder="What's being delivered…"
                disabled={submitting}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
              />
            </div>

            {/* Notes */}
            <div>
              <FieldLabel htmlFor="mac-notes">Engagement notes</FieldLabel>
              <textarea
                id="mac-notes"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything client-specific worth remembering…"
                disabled={submitting}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-5 pt-2">
              <div className="flex items-start gap-2 text-[12px] text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-2.5 py-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
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
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-md bg-gradient-to-br from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-[13px] font-semibold shadow-sm shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding…</>
                : 'Add active client'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function FieldLabel({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80 mb-1"
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
}
