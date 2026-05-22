'use client'

/**
 * AnalyticsLayoutPicker — modal that lets the user pick which layout
 * the Analytics tab should render. Triggered by the "Change layout"
 * button in the analytics header. Replaces the previous inline-pill
 * preset selector with a more deliberate "click into a picker" UX.
 *
 * Each layout is a visually-distinct lens on the same data. Cards
 * show name + description + a small graphical sketch so the user can
 * compare before committing.
 *
 * Nested-modal note:
 *   Same escape-handling pattern as ActivityLogModal — capture-phase
 *   Escape so the engagement modal underneath (if any) doesn't fire
 *   too. We're not actually inside a modal stack here, but doing it
 *   the same way means the pattern is consistent across the app.
 */

import { useEffect, useId, useRef } from 'react'
import { motion } from 'motion/react'
import {
  X as XIcon, LayoutGrid, Target, Briefcase, Wallet, Activity, Check,
} from 'lucide-react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

export type LayoutId = 'overview' | 'sales' | 'active' | 'cash' | 'activity'

export interface LayoutOption {
  id: LayoutId
  title: string
  description: string
  icon: React.ReactNode
  accent: 'purple' | 'blue' | 'green' | 'amber' | 'cyan'
  /** Tiny ASCII-ish sketch describing the layout — set as flex-row of
   *  divs in the card preview. */
  sketch: 'overview' | 'funnel' | 'donut' | 'bars' | 'calendar'
}

export const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'overview',
    title: 'Overview',
    description: 'Everything on one page. The complete picture across outreach, active clients, and cash flow.',
    icon: <LayoutGrid className="w-4 h-4" />,
    accent: 'purple',
    sketch: 'overview',
  },
  {
    id: 'sales',
    title: 'Sales pipeline',
    description: 'Lead to active client funnel. Velocity, by-medium volume, status mix, conversion rates.',
    icon: <Target className="w-4 h-4" />,
    accent: 'blue',
    sketch: 'funnel',
  },
  {
    id: 'active',
    title: 'Active clients',
    description: 'Engagement health. Lifecycle distribution, completed-engagement quality, repeat-likelihood.',
    icon: <Briefcase className="w-4 h-4" />,
    accent: 'green',
    sketch: 'donut',
  },
  {
    id: 'cash',
    title: 'Cash flow',
    description: 'Money in flight and money realised. Booked vs personal revenue, outstanding, cumulative trend.',
    icon: <Wallet className="w-4 h-4" />,
    accent: 'amber',
    sketch: 'bars',
  },
  {
    id: 'activity',
    title: 'Activity',
    description: 'Year-at-a-glance calendar heatmap. When were you most active? Which days drove wins?',
    icon: <Activity className="w-4 h-4" />,
    accent: 'cyan',
    sketch: 'calendar',
  },
]

interface AnalyticsLayoutPickerProps {
  current: LayoutId
  onPick: (id: LayoutId) => void
  onClose: () => void
}

export function AnalyticsLayoutPicker({ current, onPick, onClose }: AnalyticsLayoutPickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(dialogRef, true)

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
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
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-3xl max-h-[90vh] overflow-y-auto focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-foreground tracking-tight">
              Choose a layout
            </h2>
            <div className="text-[12.5px] text-muted-foreground/85 mt-0.5">
              Different lenses on the same underlying data. Switch any time.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-muted-foreground hover:text-foreground w-8 h-8 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Grid of layout cards */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {LAYOUT_OPTIONS.map((opt, i) => {
            const active = opt.id === current
            return (
              <motion.button
                key={opt.id}
                type="button"
                onClick={() => { onPick(opt.id); onClose() }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className={[
                  'relative text-left p-4 rounded-xl border transition-all overflow-hidden group',
                  active
                    ? 'border-purple-500/60 bg-purple-500/5 ring-2 ring-purple-500/20'
                    : 'border-border bg-card hover:bg-muted/30 hover:border-border/80 hover:-translate-y-0.5',
                ].join(' ')}
              >
                {active && (
                  <span className="absolute top-3 right-3 inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-500 text-white shadow-sm">
                    <Check className="w-3 h-3" />
                  </span>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${accentBg(opt.accent)}`}>
                    {opt.icon}
                  </span>
                  <h3 className="text-[14px] font-semibold text-foreground tracking-tight">
                    {opt.title}
                  </h3>
                </div>
                <p className="text-[12px] text-muted-foreground/85 leading-snug min-h-[3em]">
                  {opt.description}
                </p>
                <div className="mt-3 h-12 rounded-md bg-muted/40 border border-border/60 p-1.5 overflow-hidden">
                  <LayoutSketch sketch={opt.sketch} accent={opt.accent} />
                </div>
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────

function accentBg(accent: LayoutOption['accent']): string {
  return {
    purple: 'bg-gradient-to-br from-purple-500/20 to-blue-500/15 text-purple-700 dark:text-purple-300',
    blue:   'bg-gradient-to-br from-blue-500/20 to-cyan-500/15 text-blue-700 dark:text-blue-300',
    green:  'bg-gradient-to-br from-green-500/20 to-emerald-500/15 text-green-700 dark:text-green-300',
    amber:  'bg-gradient-to-br from-amber-500/20 to-orange-500/15 text-amber-700 dark:text-amber-300',
    cyan:   'bg-gradient-to-br from-cyan-500/20 to-teal-500/15 text-cyan-700 dark:text-cyan-300',
  }[accent]
}

/**
 * LayoutSketch — small visual stand-in for what each layout actually
 * looks like. Pure CSS — no SVG complexity needed for a thumbnail.
 */
function LayoutSketch({ sketch, accent }: { sketch: LayoutOption['sketch']; accent: LayoutOption['accent'] }) {
  const bar = accentBar(accent)
  switch (sketch) {
    case 'overview':
      return (
        <div className="grid grid-cols-4 gap-1 h-full">
          <div className={`col-span-4 ${bar} opacity-80 rounded`} style={{ height: '38%' }} />
          <div className={`${bar} opacity-50 rounded`} />
          <div className={`${bar} opacity-50 rounded`} />
          <div className={`${bar} opacity-50 rounded`} />
          <div className={`${bar} opacity-50 rounded`} />
        </div>
      )
    case 'funnel':
      return (
        <div className="space-y-0.5 h-full flex flex-col justify-center">
          <div className={`${bar} opacity-90 rounded`} style={{ width: '100%', height: '14%' }} />
          <div className={`${bar} opacity-80 rounded`} style={{ width: '78%',  height: '14%' }} />
          <div className={`${bar} opacity-70 rounded`} style={{ width: '52%',  height: '14%' }} />
          <div className={`${bar} opacity-60 rounded`} style={{ width: '32%',  height: '14%' }} />
          <div className={`${bar} opacity-50 rounded`} style={{ width: '18%',  height: '14%' }} />
        </div>
      )
    case 'donut':
      return (
        <div className="flex items-center justify-center h-full">
          <div className={`w-9 h-9 rounded-full ${bar} opacity-90`} style={{ background: `conic-gradient(currentColor 0% 50%, transparent 50% 70%, currentColor 70% 100%)` }} />
        </div>
      )
    case 'bars':
      return (
        <div className="flex items-end justify-between h-full gap-1 px-1">
          <div className={`${bar} opacity-70 w-2 rounded-sm`} style={{ height: '40%' }} />
          <div className={`${bar} opacity-80 w-2 rounded-sm`} style={{ height: '60%' }} />
          <div className={`${bar} opacity-90 w-2 rounded-sm`} style={{ height: '85%' }} />
          <div className={`${bar} opacity-90 w-2 rounded-sm`} style={{ height: '70%' }} />
          <div className={`${bar} opacity-95 w-2 rounded-sm`} style={{ height: '95%' }} />
          <div className={`${bar} opacity-95 w-2 rounded-sm`} style={{ height: '80%' }} />
        </div>
      )
    case 'calendar':
      return (
        <div className="grid grid-cols-12 gap-px h-full">
          {Array.from({ length: 84 }).map((_, i) => {
            const intensity = [0, 0.15, 0.3, 0.5, 0.75, 1][Math.floor(Math.random() * 6)]
            return (
              <div
                key={i}
                className={`rounded-[1px] ${bar}`}
                style={{ opacity: intensity }}
              />
            )
          })}
        </div>
      )
  }
}

function accentBar(accent: LayoutOption['accent']): string {
  return {
    purple: 'bg-purple-500',
    blue:   'bg-blue-500',
    green:  'bg-green-500',
    amber:  'bg-amber-500',
    cyan:   'bg-cyan-500',
  }[accent]
}
