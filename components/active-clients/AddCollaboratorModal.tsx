'use client'

/**
 * AddCollaboratorModal — small focused modal for adding a single
 * team member to an active-client engagement. Opens on top of
 * ActiveClientDetailModal when the user clicks "+ Add" in
 * CollaboratorsList.
 *
 * Why a modal instead of inline-row-append?
 *   The previous behaviour ("+ Add immediately spawns an empty inline
 *   row with all fields up") put entry fields on screen the moment
 *   the section was touched. The user prefers a more deliberate flow:
 *   click → focused form → submit → row joins the list. The empty/
 *   generic look stays clean until someone is actually on the team.
 *
 * Stack note:
 *   Nested modal — same pattern as ActivityLogModal. Capture-phase
 *   Escape listener so the topmost modal closes first, not both at
 *   once. z-index 60 above the engagement modal's 50.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { ClientCollaborator } from '@/lib/types'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { X as XIcon, Users } from 'lucide-react'

interface AddCollaboratorModalProps {
  /** Current engagement budget — used for the percent-share preview
   *  and to disable percent mode when the budget isn't set yet. */
  budget?: number | null
  budgetCurrency?: string | null
  /** Receives the new collaborator (sans id — caller assigns it).
   *  The modal closes itself after onSubmit returns. */
  onSubmit: (next: Omit<ClientCollaborator, 'id'>) => void
  onClose: () => void
}

export function AddCollaboratorModal({
  budget, budgetCurrency, onSubmit, onClose,
}: AddCollaboratorModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const roleInputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  useFocusTrap(dialogRef, true)

  const [role, setRole]           = useState('')
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [phone, setPhone]         = useState('')
  const [shareStr, setShareStr]   = useState('')
  const [shareType, setShareType] = useState<'dollar' | 'percent'>('dollar')

  // Auto-focus the first field. We focus Role rather than Name because
  // Role is the primary categorical signal ("what do they do for me?")
  // and most engagements have a small repeatable set of roles, so
  // muscle memory finishes the typing fast.
  useEffect(() => {
    roleInputRef.current?.focus()
  }, [])

  // Capture-phase Escape — runs before the parent engagement modal's
  // bubble-phase listener catches the same key. Stops propagation so
  // we don't close both modals at once.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const trimmedRole = role.trim()
  const trimmedName = name.trim()
  // Require role OR name to be filled in — an entirely blank
  // collaborator is just noise on the list and contributes nothing
  // useful to the personal-revenue calc.
  const isValid = trimmedRole.length > 0 || trimmedName.length > 0
  const shareNum = (() => {
    const n = parseFloat(shareStr.replace(/[^0-9.]/g, ''))
    return Number.isFinite(n) && n > 0 ? n : 0
  })()
  const currency = (budgetCurrency || 'USD').toUpperCase()

  const resolvedShare =
    shareType === 'percent' && typeof budget === 'number' && budget > 0
      ? (budget * shareNum) / 100
      : shareType === 'dollar'
        ? shareNum
        : 0
  const showResolvedHint =
    shareType === 'percent' && typeof budget === 'number' && budget > 0 && shareNum > 0

  function handleSubmit() {
    if (!isValid) return
    onSubmit({
      role: trimmedRole,
      name: trimmedName,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      share: shareNum,
      shareType,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.35 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md max-h-[90vh] overflow-y-auto focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" aria-hidden />
              Add team member
            </h2>
            <div className="text-[11.5px] text-muted-foreground/75 mt-0.5">
              Track who else takes a cut of this engagement&apos;s budget
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-muted-foreground hover:text-foreground w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form
          className="px-5 py-4 space-y-3"
          onSubmit={e => { e.preventDefault(); handleSubmit() }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <FieldLabel>Role</FieldLabel>
              <input
                ref={roleInputRef}
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="Editor"
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
              />
            </div>
            <div>
              <FieldLabel>Name</FieldLabel>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <FieldLabel>
                Email <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span>
              </FieldLabel>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] font-mono text-muted-foreground/85 focus:outline-none focus:text-foreground focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
              />
            </div>
            <div>
              <FieldLabel>
                Phone <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span>
              </FieldLabel>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] font-mono text-muted-foreground/85 focus:outline-none focus:text-foreground focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Revenue share</FieldLabel>
            <div className="flex items-center gap-2">
              <div
                className="inline-flex bg-muted rounded overflow-hidden text-[11px] font-semibold"
                role="group"
                aria-label="Share type"
              >
                <button
                  type="button"
                  onClick={() => setShareType('dollar')}
                  aria-pressed={shareType === 'dollar'}
                  className={[
                    'px-2 py-1 transition-colors',
                    shareType === 'dollar'
                      ? 'bg-purple-500 text-white'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                  title="Fixed dollar amount"
                >
                  $
                </button>
                <button
                  type="button"
                  onClick={() => setShareType('percent')}
                  aria-pressed={shareType === 'percent'}
                  className={[
                    'px-2 py-1 transition-colors',
                    shareType === 'percent'
                      ? 'bg-purple-500 text-white'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                  title="Percentage of budget"
                >
                  %
                </button>
              </div>
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-mono text-muted-foreground/70 pointer-events-none">
                  {shareType === 'dollar' ? currency : '%'}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={shareStr}
                  onChange={e => setShareStr(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 pl-12 text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
                />
              </div>
              {showResolvedHint && (
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/85 whitespace-nowrap">
                  ≈ {formatMoney(resolvedShare, currency)}
                </span>
              )}
            </div>
            {shareType === 'percent' && (!budget || budget <= 0) && (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                Set the engagement budget first to use a percent share.
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            title={isValid ? undefined : 'Add at least a role or a name to continue'}
            className={[
              'px-3 py-1.5 text-[13px] font-semibold rounded-md transition-colors',
              isValid
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-muted text-muted-foreground/60 cursor-not-allowed',
            ].join(' ')}
          >
            Add
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80 mb-1">
      {children}
    </label>
  )
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
}
