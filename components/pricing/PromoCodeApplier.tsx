'use client'

/**
 * "Have a code?" input that pre-applies a Stripe promotion code to
 * the checkout session.
 *
 * Renders a small toggle ("Have a code?") that expands to an input
 * field + Apply button. On apply we don't hit Stripe directly here
 * — we just stash the code in React Context (PromoCodeContext below)
 * so the PricingCheckoutButton can pass it through to
 * /api/stripe/checkout, which validates against Stripe and surfaces
 * inline errors.
 *
 * This component pairs with PromoCodeProvider — both live in
 * components/pricing/. The provider wraps the entire pricing card
 * grid so each plan's CTA reads the same applied code.
 */

import { useState, createContext, useContext, type ReactNode } from 'react'
import { Tag, X as XIcon, Check } from 'lucide-react'

interface PromoCodeContextValue {
  appliedCode: string | null
  setAppliedCode: (code: string | null) => void
}

const PromoCodeContext = createContext<PromoCodeContextValue | null>(null)

export function PromoCodeProvider({ children }: { children: ReactNode }) {
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  return (
    <PromoCodeContext.Provider value={{ appliedCode, setAppliedCode }}>
      {children}
    </PromoCodeContext.Provider>
  )
}

/** Read the currently-applied promo code (or null) inside the
 *  PromoCodeProvider subtree. Used by PricingCheckoutButton. */
export function usePromoCode(): string | null {
  const ctx = useContext(PromoCodeContext)
  return ctx?.appliedCode ?? null
}

export function PromoCodeApplier() {
  const ctx = useContext(PromoCodeContext)
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!ctx) {
    // Guard against rendering this outside the provider — render
    // nothing so a misconfigured page doesn't crash.
    return null
  }

  const { appliedCode, setAppliedCode } = ctx

  function apply() {
    const trimmed = input.trim().toUpperCase()
    if (!trimmed) {
      setError('Enter a code.')
      return
    }
    // We don't validate against Stripe client-side — that requires a
    // round-trip. The actual validation happens at checkout time when
    // /api/stripe/checkout looks the code up. Here we only do shape
    // checks (non-empty, reasonable length).
    if (trimmed.length < 3 || trimmed.length > 32) {
      setError('Codes are 3-32 characters.')
      return
    }
    setError(null)
    setAppliedCode(trimmed)
    setExpanded(false)
    setInput('')
  }

  function clear() {
    setAppliedCode(null)
    setError(null)
    setInput('')
  }

  // Applied state — show the code as a pill with a remove button.
  if (appliedCode) {
    return (
      <div className="max-w-[820px] mx-auto mt-6 flex items-center justify-center gap-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/40 bg-green-500/10 text-[12.5px] font-medium text-green-700 dark:text-green-300">
          <Check className="w-3.5 h-3.5" />
          <span>
            Code applied: <span className="font-mono font-bold">{appliedCode}</span>
          </span>
          <button
            type="button"
            onClick={clear}
            aria-label="Remove promo code"
            className="ml-1 inline-flex w-4 h-4 items-center justify-center rounded-full hover:bg-green-700/20 transition-colors"
          >
            <XIcon className="w-3 h-3" />
          </button>
        </div>
        <span className="text-[11px] text-[#0F1733]/50 dark:text-white/50">
          Applied at checkout
        </span>
      </div>
    )
  }

  // Collapsed state — small "Have a code?" toggle.
  if (!expanded) {
    return (
      <div className="max-w-[820px] mx-auto mt-6 text-center">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-[#0F1733]/55 dark:text-white/55 hover:text-[#E85D2F] dark:hover:text-[#F2A261] transition-colors"
        >
          <Tag className="w-3.5 h-3.5" />
          Have a code?
        </button>
      </div>
    )
  }

  // Expanded state — input + Apply + Cancel.
  return (
    <div className="max-w-[420px] mx-auto mt-6">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') apply()
            if (e.key === 'Escape') {
              setExpanded(false)
              setError(null)
              setInput('')
            }
          }}
          placeholder="Promo code"
          autoFocus
          spellCheck={false}
          className="flex-1 px-3 py-2 text-[13px] font-mono uppercase tracking-wider bg-white dark:bg-[#131826] border border-[#0F1733]/15 dark:border-white/15 rounded-md focus:outline-none focus:ring-2 focus:ring-[#E85D2F]/30 focus:border-[#E85D2F]/50"
        />
        <button
          type="button"
          onClick={apply}
          className="px-4 py-2 rounded-md bg-[#0F1733] text-white text-[13px] font-semibold hover:bg-[#E85D2F] dark:bg-[#F2A261] dark:text-[#0F1733] dark:hover:bg-white transition-colors"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false)
            setError(null)
            setInput('')
          }}
          className="px-2 py-2 text-[#0F1733]/50 dark:text-white/50 hover:text-[#0F1733] dark:hover:text-white transition-colors"
          aria-label="Cancel"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
      {error && (
        <p className="mt-2 text-[12px] text-red-500/90 text-center">{error}</p>
      )}
      <p className="mt-2 text-[11px] text-[#0F1733]/45 dark:text-white/45 text-center">
        We&apos;ll validate the code at checkout. Invalid codes show an
        inline error before any charge.
      </p>
    </div>
  )
}
