'use client'

import React, { useState, useEffect, useCallback, useLayoutEffect, useRef, useContext } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles } from 'lucide-react'
import type { Creator, ScoreWeights, GuidanceEntry, GuidanceContextType } from '@/lib/types'
import {
  DEFAULT_GUIDANCE_WEIGHT, GUIDANCE_PRESETS,
  getGuidanceRuleEvidence,
  computeEntryRatio, computeGuidanceScore,
} from '@/lib/guidance'
import {
  WEIGHT_META,
  computeFitScore, computeFitScoreBreakdown, fitScoreMeta,
} from '@/lib/scoring'

// Shared guidance context — the parent page provides it; this cell is
// a consumer. We re-declare it (with the same shape) here so the cell
// doesn't have to import from app/page.tsx (which would create a
// circular import). React.createContext keys by identity, so we need
// the SAME context object; it's exported back into page.tsx via this
// module so the provider and consumer share the reference.
export const GuidanceContext = React.createContext<GuidanceContextType>({
  entries: [], addEntry: () => {}, removeEntry: () => {}, updateEntryWeight: () => {}, resetAll: () => {},
})

export function FitScoreCell({ c, weights, narrative }: { c: Creator; weights: ScoreWeights; narrative: string }) {
  const [open, setOpen] = useState(false)
  const [guidanceView, setGuidanceView] = useState(false)
  // Position is computed in viewport coords (position: fixed) so the
  // popover escapes the table's overflow-x-auto wrapper. The previous
  // absolute-inside-cell approach clipped on right-side cells in wide
  // tables and felt cramped at 20rem.
  const [pos, setPos] = useState<{ top: number; left: number; flipUp: boolean } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const { entries } = useContext(GuidanceContext)
  const score = computeFitScore(c, weights, entries)
  const { label, color } = fitScoreMeta(score)
  const items = computeFitScoreBreakdown(c, weights, entries)
  const { fired, missed } = entries.length > 0 ? computeGuidanceScore(c, entries) : { fired: [], missed: [] }

  // In chip mode, chips ARE the score (100 pts total)
  const guidanceTotal = entries.reduce((sum, e) => sum + (e.weight ?? DEFAULT_GUIDANCE_WEIGHT), 0)
  const guidanceMaxPts = entries.length > 0 ? 100 : 0
  const guidanceActualPts = entries.length > 0
    ? Math.min(100, Math.round(entries.reduce((sum, e) => sum + computeEntryRatio(e, c) * (e.weight ?? DEFAULT_GUIDANCE_WEIGHT), 0) / guidanceTotal * 100))
    : 0

  // Popover dimensions (kept in sync with the inline style below).
  const POPOVER_WIDTH = 384 // 24rem — wider than the old 20rem so the
                            // pts column + criterion text + evidence
                            // boxes have room and stop wrapping.
  const POPOVER_MAX_H = 0.72 // 72vh
  const POPOVER_GUTTER = 8

  // Compute fixed position from the button rect. Flips above when the
  // popover would overflow the bottom of the viewport, and clamps to
  // the right edge when it would overflow horizontally so right-side
  // cells don't push the popover off-screen.
  const reposition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const popMaxH = vh * POPOVER_MAX_H
    const spaceBelow = vh - r.bottom - POPOVER_GUTTER
    const spaceAbove = r.top - POPOVER_GUTTER
    const flipUp = spaceBelow < 320 && spaceAbove > spaceBelow
    const top = flipUp
      ? Math.max(POPOVER_GUTTER, r.top - POPOVER_GUTTER - Math.min(popMaxH, spaceAbove))
      : r.bottom + POPOVER_GUTTER
    // Prefer left-aligned to button; clamp to viewport so we never
    // hang off the right edge.
    let left = r.left
    if (left + POPOVER_WIDTH + POPOVER_GUTTER > vw) {
      left = Math.max(POPOVER_GUTTER, vw - POPOVER_WIDTH - POPOVER_GUTTER)
    }
    setPos({ top, left, flipUp })
  }, [])

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    reposition()
  }, [open, reposition])

  useEffect(() => {
    if (!open) return
    const onScroll = () => reposition()
    const onResize = () => reposition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, reposition])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      // Click is "outside" if it's neither in the trigger button nor
      // the portal-rendered popover. Both refs needed since the
      // popover is a portal child of <body>, not of the button.
      if (buttonRef.current?.contains(t)) return
      if (popoverRef.current?.contains(t)) return
      setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <td className="px-4 py-3 whitespace-nowrap">
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
      >
        <span className={`font-bold ${color}`}>{score}</span>
        <span className={`text-xs ${color} opacity-70`}>{label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[60] bg-card border border-border rounded-xl shadow-2xl text-xs flex flex-col"
          style={{
            top: pos.top,
            left: pos.left,
            width: `${POPOVER_WIDTH}px`,
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: `${Math.round(POPOVER_MAX_H * 100)}vh`,
          }}
        >
          {/* ── GUIDANCE DETAIL VIEW ── */}
          {guidanceView ? (
            <>
              {/* Sticky header */}
              <div className="shrink-0 flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-border">
                <button
                  onClick={() => setGuidanceView(false)}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs px-2 py-1 -ml-2 rounded hover:bg-muted/60 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <span className="font-semibold text-foreground text-sm inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand" />
                  Your Lead Criteria
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-muted/60 transition-colors"
                  aria-label="Close"
                >✕</button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">

                {/* Score contribution card — always visible */}
                <div className="bg-muted/40 rounded-lg p-3 space-y-2 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/90 font-medium text-xs">Score contribution</span>
                    <span className={`font-bold font-mono text-base tabular-nums ${guidanceActualPts > 0 ? 'text-purple-700 dark:text-purple-300' : 'text-muted-foreground'}`}>
                      {guidanceActualPts} <span className="text-muted-foreground/70 font-normal text-[11px]">/ {guidanceMaxPts} pts</span>
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: guidanceMaxPts > 0 ? `${Math.round((guidanceActualPts / guidanceMaxPts) * 100)}%` : '0%',
                        backgroundColor: guidanceMaxPts > 0 && guidanceActualPts / guidanceMaxPts >= 0.7 ? 'rgb(168,85,247)' : guidanceMaxPts > 0 && guidanceActualPts / guidanceMaxPts >= 0.4 ? 'rgb(139,92,246)' : 'rgb(75,85,99)',
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug">
                    {entries.length === 0 ? (
                      <span>No criteria yet — select some in Score Settings.</span>
                    ) : (
                      <span>
                        {guidanceActualPts === guidanceMaxPts
                          ? 'This creator hits all your criteria — full points earned.'
                          : guidanceActualPts === 0
                          ? 'This creator didn\'t match any criteria — no points earned.'
                          : `${guidanceActualPts} of ${guidanceMaxPts} pts earned across your criteria.`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Criteria entries */}
                {entries.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-xs leading-relaxed">
                    No criteria active. Open <strong className="text-foreground/90">Score Settings</strong> to select what makes a great lead.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {entries.map((entry: GuidanceEntry) => {
                      const entryFired = fired.filter(f => f.entryId === entry.id)
                      const entryMissed = missed.filter(m => m.entryId === entry.id)
                      const allMatch = entryFired.length > 0 && entryMissed.length === 0
                      const noneMatch = entryFired.length === 0
                      return (
                        <div key={entry.id} className="border border-border rounded-lg overflow-hidden">
                          {/* Criterion header */}
                          <div className="px-3 pt-2.5 pb-2">
                            <div className="text-muted-foreground text-[11px] italic leading-snug break-words">"{entry.text}"</div>
                            {entry.summary && (
                              <div className="text-foreground/85 text-xs mt-1.5 leading-snug break-words">
                                <span className="text-purple-700 dark:text-purple-400 not-italic font-medium">AI: </span>{entry.summary}
                              </div>
                            )}
                          </div>
                          {/* Scoring logic */}
                          {entry.rules.length > 0 && (
                            <div className="bg-muted/40 px-3 py-2 space-y-2 border-t border-border/60">
                              <div className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">Result for this creator</div>
                              {entryFired.map((f, fi) => {
                                const ruleObj = entry.rules.find(r => r.label === f.ruleLabel) || entry.rules[fi]
                                const evidence = ruleObj ? getGuidanceRuleEvidence(ruleObj, c) : ''
                                return (
                                  <div key={fi} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-emerald-600 dark:text-green-500 shrink-0">✓</span>
                                      <span className="flex-1 text-foreground/90 font-medium text-xs leading-snug break-words">{f.ruleLabel}</span>
                                      <span className={`font-mono font-bold text-xs shrink-0 tabular-nums ${f.pts > 0 ? 'text-emerald-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{f.pts > 0 ? '+' : ''}{f.pts}</span>
                                    </div>
                                    {evidence && (
                                      <div className="ml-5 text-[11px] text-emerald-800 dark:text-green-300 leading-snug break-words bg-emerald-50 dark:bg-green-900/20 border border-emerald-200 dark:border-transparent rounded px-2 py-1">
                                        {evidence}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                              {entryMissed.map((m, mi) => (
                                <div key={mi} className="flex items-center gap-2">
                                  <span className="text-muted-foreground/50 shrink-0">✗</span>
                                  <span className="flex-1 text-muted-foreground/70 text-xs leading-snug break-words">{m.ruleLabel}</span>
                                  <span className="font-mono text-xs shrink-0 text-muted-foreground/50 tabular-nums">{m.pts > 0 ? '+' : ''}{m.pts}</span>
                                </div>
                              ))}
                              <div className={`text-[11px] font-medium pt-1.5 border-t border-border/60 ${allMatch ? 'text-emerald-700 dark:text-green-400' : noneMatch ? 'text-muted-foreground/70' : 'text-amber-700 dark:text-yellow-500'}`}>
                                {allMatch ? '✓ Fully matched' : noneMatch ? '✗ Not matched' : `⚡ Partial — ${entryFired.length}/${entry.rules.length} rules hit`}
                              </div>
                            </div>
                          )}
                          {entry.rules.length === 0 && (
                            <div className="bg-muted/40 px-3 py-2 border-t border-border/60">
                              <span className="text-muted-foreground/70 text-[11px]">No evaluatable rules — criterion may need rephrasing.</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Sticky footer — link to Score Settings */}
              <div className="shrink-0 border-t border-border px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground/80">Manage criteria in Score Settings</span>
                <button
                  onClick={() => { setOpen(false); setGuidanceView(false) }}
                  className="text-xs text-purple-700 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            /* ── MAIN BREAKDOWN VIEW ── */
            <>
              {/* Sticky header */}
              <div className="shrink-0 flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-border">
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground text-sm">Fit Score Breakdown</span>
                  <span className="text-[10px] text-muted-foreground/80 mt-0.5">{c.channelName}</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-muted/60 transition-colors"
                  aria-label="Close"
                >✕</button>
              </div>

              {/* Score summary banner */}
              <div className="shrink-0 px-4 py-3 border-b border-border bg-muted/30 flex items-baseline justify-between">
                <span className="text-muted-foreground text-[11px] uppercase tracking-wider">Score</span>
                <div className="flex items-baseline gap-2">
                  <span className={`font-bold text-2xl tabular-nums ${color}`}>{score}</span>
                  <span className={`text-xs ${color} opacity-80`}>{label}</span>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold mb-2">
                  How this score was calculated
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className={`w-10 text-right font-mono font-bold shrink-0 leading-snug tabular-nums ${item.pts > 0 ? 'text-emerald-700 dark:text-green-400' : item.pts < 0 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {item.pts > 0 ? '+' : ''}{item.pts}
                      </span>
                      <div className="flex-1 min-w-0">
                        {item.isGuidance ? (
                          <button
                            onClick={() => setGuidanceView(true)}
                            className="text-purple-700 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 flex items-center gap-1.5 text-left font-medium"
                          >
                            <Sparkles className="w-3 h-3 shrink-0" />
                            <span>Your Criteria</span>
                            <span className="text-muted-foreground/70 font-normal">/ {item.max}</span>
                            <span className="text-muted-foreground text-[10px] ml-0.5">view →</span>
                          </button>
                        ) : (
                          <span className="text-foreground/90 leading-snug font-medium">
                            {item.label}
                            {item.max > 0 && <span className="text-muted-foreground/70 ml-1.5 font-normal">/ {item.max}</span>}
                          </span>
                        )}
                        {item.note && (
                          <div className="text-muted-foreground text-[11px] leading-snug break-words mt-0.5">{item.note}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Weight distribution — stacked bar + readable list */}
                {(() => {
                  // Chip mode: only chip segments. Default mode: base segments.
                  const chipMode = entries.length > 0
                  const segments: { key: string; label: string; w: number }[] = chipMode
                    ? entries.map(e => {
                        const preset = GUIDANCE_PRESETS.find(p => p.entry.text === e.text)
                        return { key: e.id, label: preset ? `${preset.emoji} ${preset.label}` : (e.summary?.split(' ').slice(0, 4).join(' ') || 'Criterion'), w: e.weight ?? DEFAULT_GUIDANCE_WEIGHT }
                      })
                    : WEIGHT_META.map(m => ({ key: m.key, label: m.label, w: weights[m.key] }))
                  const segTotal = segments.reduce((s, seg) => s + seg.w, 0)
                  const segColor = chipMode ? 'rgb(168,85,247)' : 'rgb(99,102,241)'
                  return (
                    <div className="mt-4 pt-3 border-t border-border">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                        <span>Weight distribution</span>
                        {chipMode
                          ? <span className="text-purple-700 dark:text-purple-400 normal-case font-medium tracking-normal inline-flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" />Your criteria</span>
                          : <span className="text-muted-foreground/60 normal-case font-medium tracking-normal">Default</span>}
                      </div>
                      {/* Stacked bar */}
                      <div className="flex h-2 rounded-full overflow-hidden gap-px bg-muted mb-2">
                        {segments.map(seg => {
                          const pct = segTotal > 0 ? (seg.w / segTotal) * 100 : 0
                          return pct > 0 ? (
                            <div
                              key={seg.key}
                              style={{ width: `${pct}%`, backgroundColor: segColor }}
                              title={`${seg.label}: ${Math.round(pct)}%`}
                            />
                          ) : null
                        })}
                      </div>
                      {/* One label per row — readable, not crammed into a 3-col grid. */}
                      <div className="space-y-1">
                        {segments.map(seg => {
                          const pct = Math.round(segTotal > 0 ? (seg.w / segTotal) * 100 : 0)
                          return (
                            <div key={seg.key} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: segColor, opacity: pct === 0 ? 0.3 : 1 }} />
                              <span className={`text-[11px] flex-1 truncate ${chipMode ? 'text-foreground/90' : 'text-foreground/80'}`}>{seg.label}</span>
                              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{pct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </td>
  )
}
