'use client'

/**
 * TipsAndTricksPill — small lightbulb pill in the top header that
 * cycles through curated power-user tips. Sibling component to
 * DashboardInsightPill but with different scope:
 *
 *   • Insight pill → state of YOUR data (what's happening, what to do)
 *   • Tips pill    → state of THE APP (features you might not know)
 *
 * No backend. The tip list is a curated static array — hand-written,
 * so there's no risk of AI-style filler. Refresh advances to the
 * next tip; localStorage tracks position so cycling continues across
 * page reloads. After all tips are shown, cycles back to the start.
 *
 * Visibility: hidden below md, same as DashboardInsightPill, so the
 * mobile header stays uncluttered.
 */

import { useEffect, useRef, useState } from 'react'
import { Lightbulb, RefreshCw, X as XIcon } from 'lucide-react'

/**
 * Curated tips. Order doesn't matter — first-load position is random,
 * then linear cycling. Add new tips here; remove obsolete ones when
 * features change. Aim for sharp, specific, useful — not "did you
 * know" filler. Each one names a concrete feature or shortcut and
 * what it does.
 */
const TIPS: string[] = [
  "Click the ★ column header in Outreach to sort favorites to the top. Click again to send them to the bottom.",
  "Set a follow-up date when you reach out — leads with overdue dates surface in the Follow-ups sub-tab automatically.",
  "Right-click any column header to hide it. Drag column headers left or right to reorder.",
  "Connect Gmail via the hamburger menu so the Send button delivers directly instead of opening a compose URL.",
  "Set your pitch line in Profile — every AI outreach rewrite pulls it in to personalize the opener.",
  "Templates support these variables: {name}, {channel}, {content}, {pitch}, {sender_first}, {sender_full}, {linkedin}.",
  "On any Active Client, click + Add Team Member to track role, contact info, and revenue share (in $ or %).",
  "Toggle the share type on a collaborator row between $ and %. Percent calculates against the engagement budget.",
  "The Analytics tab has 5 layouts — Overview, Sales, Active Clients, Cash Flow, Activity. Hit Change Layout to switch.",
  "The Activity layout has a year-at-a-glance calendar heatmap of every outreach event.",
  "Every Active Client engagement has an Activity log accessible from the modal footer — audits every edit you've made.",
  "Use the platform toggle (top-left) to switch lenses: YouTube, Instagram, TikTok, X, LinkedIn. Scoring adjusts per platform.",
  "Dismiss a creator from Results to permanently hide them from future searches in this niche.",
  "Import past outreach from Excel via the hamburger menu — column mapping handles different export shapes.",
  "Click a creator's name in Results to see their full info, recent video titles, and contact links before adding to outreach.",
  "Mark a lead Successful and an Active Client engagement is auto-created with budget, milestones, and team-split tracking.",
  "Wrap up a Completed engagement to capture rating, repeat likelihood, and final value — feeds the Analytics tab.",
  "Two clients marked Definitely- or Likely-repeat are warm leads for the next round. Reach out before the trail goes cold.",
  "Export your full outreach to Excel or CSV via the Analytics tab Settings gear — quick way to back up data.",
  "Custom metrics (Analytics → Customize) let you define any count, percentage, sum, or average over filtered subsets.",
  "New Active Client engagements get 4 default milestones — kickoff, brief, deliverable, invoice. Edit or remove as needed.",
  "Click the trial pill in the top bar to open the Stripe billing portal — manage your subscription, payment method, invoices.",
  "The Outreach > Pipeline tab is where you live day-to-day. The ★ column header is sortable to surface favorites.",
  "Set a physical address in Profile — required by US CAN-SPAM rules for commercial emails. The composer warns you if it's missing.",
]

const LS_KEY = 'creator-outreach.tips-pill.index'

export function TipsAndTricksPill() {
  // First-load position is random so each new user sees a different
  // tip; subsequent refreshes are linear and persist across reloads.
  const [index, setIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try {
      const raw = window.localStorage.getItem(LS_KEY)
      if (raw != null) {
        const parsed = parseInt(raw, 10)
        if (Number.isFinite(parsed)) return ((parsed % TIPS.length) + TIPS.length) % TIPS.length
      }
    } catch { /* ignore */ }
    return Math.floor(Math.random() * TIPS.length)
  })
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Persist position on every change so the next page load picks up
  // where this one left off.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(LS_KEY, String(index)) } catch { /* ignore */ }
  }, [index])

  // Click-outside / Escape to close popover.
  useEffect(() => {
    if (!open) return
    function onClick(ev: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(ev.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function nextTip(): void {
    setIndex(i => (i + 1) % TIPS.length)
  }

  const tip = TIPS[index] ?? ''

  return (
    <div ref={popoverRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Tips and tricks"
        aria-expanded={open}
        title="Tips & tricks"
        className={[
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors max-w-[260px] overflow-hidden',
          open
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80',
        ].join(' ')}
      >
        <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-500" aria-hidden />
        <span className="truncate whitespace-nowrap">Tips</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl shadow-black/30 z-40 overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-3.5 pb-2.5 border-b border-border flex items-start gap-2">
            <div className="shrink-0 w-7 h-7 rounded-md bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-sm shadow-amber-500/30">
              <Lightbulb className="w-3.5 h-3.5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-foreground">Tips &amp; tricks</div>
              <div className="text-[10.5px] text-muted-foreground/75">
                Features and shortcuts worth knowing
              </div>
            </div>
            <button
              type="button"
              onClick={nextTip}
              aria-label="Next tip"
              title="Next tip"
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted/40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/40 transition-colors"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Body */}
          <div className="px-4 py-3.5">
            <p className="text-[13.5px] leading-relaxed text-foreground/90">
              {tip}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
