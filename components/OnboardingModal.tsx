'use client'

import { useState, useId, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

export function OnboardingModal({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Focus trap only — no Esc-to-close because the user MUST complete
  // onboarding before reaching the app. They can submit (or X out
  // their session entirely) but not dismiss this dialog with Esc.
  useFocusTrap(dialogRef, true)

  const [fullName, setFullName] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  // CAN-SPAM §5(a)(5) — every commercial email MUST include a valid
  // physical postal address. We hard-block onboarding without one
  // (vs. the soft-warning approach we had pre-2026-05-11) because
  // every send below the funnel is now an automated compliance risk.
  // The minimum length (MIN_ADDRESS_LEN) is a defensive sanity check:
  // anything shorter than "1 A St US" can't be a real postal address.
  const [physicalAddress, setPhysicalAddress] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const trimmedAddress = physicalAddress.trim()
  const MIN_ADDRESS_LEN = 8
  const addressValid = trimmedAddress.length >= MIN_ADDRESS_LEN
  const canSubmit = fullName.trim().length > 0 && addressValid && !loading

  async function save(opts: { skipLinkedin: boolean }) {
    setError('')
    if (!fullName.trim()) {
      setError('Full name is required')
      return
    }
    if (!addressValid) {
      setError('Business address is required to send CAN-SPAM compliant emails')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('user_profile')
      .update({
        full_name: fullName.trim(),
        linkedin_url: opts.skipLinkedin ? '' : linkedinUrl.trim(),
        physical_address: trimmedAddress,
        onboarded: true,
      })
      .eq('user_id', userId)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md p-7 focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-xl font-bold text-foreground mb-1">Welcome <span aria-hidden>👋</span></h2>
        <p className="text-muted-foreground text-sm mb-6">A couple quick details so your outreach emails sound like you, not a template.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Full name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1">Used as the sender name in outreach emails.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              LinkedIn URL <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/your-handle"
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1">Goes in the footer of your outreach emails. Skip and add later if you don&apos;t have one handy.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Business address <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={physicalAddress}
              onChange={e => setPhysicalAddress(e.target.value)}
              placeholder="123 Main St, City, ST 12345"
              aria-invalid={physicalAddress.length > 0 && !addressValid}
              aria-describedby="onboarding-address-help"
              className={`w-full bg-muted border rounded px-3 py-2 text-foreground text-sm focus:outline-none ${
                physicalAddress.length > 0 && !addressValid
                  ? 'border-red-400/70 focus:border-red-500'
                  : 'border-border focus:border-blue-500'
              }`}
            />
            <p id="onboarding-address-help" className="text-[11px] text-muted-foreground/70 mt-1">
              Required by US anti-spam law (CAN-SPAM §5(a)(5)) — appears in the footer of every email you send through Creator Outreach. A PO Box works too. You can change it later from Profile.
            </p>
            {physicalAddress.length > 0 && !addressValid && (
              <p className="text-[11px] text-red-700 dark:text-red-400 mt-1">
                Business address is required to send CAN-SPAM compliant emails.
              </p>
            )}
          </div>
        </div>

        {error && <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2 mt-4">{error}</div>}

        <div className="flex items-center justify-between gap-3 mt-6">
          <button
            onClick={() => save({ skipLinkedin: true })}
            disabled={!canSubmit}
            className="text-sm text-muted-foreground hover:text-foreground/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip LinkedIn for now
          </button>
          <button
            onClick={() => save({ skipLinkedin: false })}
            disabled={!canSubmit}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving…' : 'Save & continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
