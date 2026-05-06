'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef, useContext } from 'react'
import type {
  Creator, SortCol, SortDir, ColId, ActiveTab, ScoreWeights,
  GuidanceCondition, GuidanceRule, GuidanceEntry, GuidancePreset, GuidanceContextType,
  OutreachEntry, OutreachColDef, OutreachColConfig,
  ColConfig, PlatformId, PlatformConfig, UserProfile,
} from '@/lib/types'
import { EMPTY_METRIC_FILTER } from '@/lib/types'
import { computeMetric, metricTypeLabel, SUGGESTED_METRICS } from '@/lib/metrics'
import { toast } from 'sonner'
import { celebrateSuccess } from '@/lib/celebrate'
import { NumberTicker } from '@/components/NumberTicker'
import { AnimatedTabs } from '@/components/AnimatedTabs'
import { AnimatedRow } from '@/components/AnimatedRow'
import { BorderBeam } from '@/components/BorderBeam'
import { motion } from 'motion/react'
import { CadencePopover, FollowedUpPopover } from '@/components/CadencePopover'
import {
  ALL_OCCUPATIONS, VIEW_PRESETS,
  pickRandom, formatSubscribers, parseRelativeDays, buildOutreachEmail,
} from '@/lib/format'
import {
  DEFAULT_GUIDANCE_WEIGHT, GUIDANCE_PRESETS,
  getGuidanceRuleEvidence,
  computeEntryRatio, computeGuidanceScore,
} from '@/lib/guidance'
import {
  DEFAULT_WEIGHTS, WEIGHT_META,
  computeFitScore, computeFitScoreBreakdown, fitScoreMeta,
  sortCreators,
} from '@/lib/scoring'
import {
  ALL_OUTREACH_COLS, DEFAULT_OUTREACH_COLS, DEFAULT_COLS,
  YOUTUBE_ONLY_COL_IDS, COL_SORT,
} from '@/lib/columns'
import { PLATFORM_CONFIGS, PLATFORM_LOCK_ID } from '@/lib/platform'
import { REGIONS } from '@/lib/regions'
import {
  PlusCircleIcon, DismissIcon, TrashIcon, Spinner, SortIndicator,
  AutoTextarea,
} from '@/components/ui'
import { DismissedTab } from '@/components/DismissedTab'
import { PlatformDropdown } from '@/components/PlatformDropdown'
import { HamburgerMenu } from '@/components/HamburgerMenu'
import { ScoreSettingsModal } from '@/components/ScoreSettingsModal'
import { OnboardingModal } from '@/components/OnboardingModal'
import { ProfileModal } from '@/components/ProfileModal'
import { MigrationPromptModal } from '@/components/MigrationPromptModal'
import { ImportOutreachModal } from '@/components/ImportOutreachModal'
import { ImportDismissedModal } from '@/components/ImportDismissedModal'
import { CustomMetricModal } from '@/components/CustomMetricModal'
import { ManualAddOutreachModal } from '@/components/ManualAddOutreachModal'
import { LeadDetailModal } from '@/components/LeadDetailModal'
import {
  getOutreach, saveOutreach as persistOutreach,
  getDismissed, saveDismissed as persistDismissed,
  saveColConfig,
  getOutreachColConfig, saveOutreachColConfig,
  getCustomMetrics, saveCustomMetrics,
  savePlatformWeights, savePlatformNarrative,
  savePlatformGuidance, clearPlatformGuidance,
  loadPlatformState,
  hasMigrationBackup,
  retryMigrationFromBackup,
  getPendingMigrationCounts,
  getMigrationSkipped,
  setMigrationSkipped,
  runManualMigration,
} from '@/lib/storage'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

const GuidanceContext = React.createContext<GuidanceContextType>({
  entries: [], addEntry: () => {}, removeEntry: () => {}, updateEntryWeight: () => {}, resetAll: () => {},
})

function FitScoreCell({ c, weights, narrative }: { c: Creator; weights: ScoreWeights; narrative: string }) {
  const [open, setOpen] = useState(false)
  const [guidanceView, setGuidanceView] = useState(false)
  const ref = useRef<HTMLTableCellElement>(null)
  const { entries } = useContext(GuidanceContext)
  const score = computeFitScore(c, weights, entries)
  const { label, color } = fitScoreMeta(score)
  const items = computeFitScoreBreakdown(c, weights, entries)
  const { fired, missed } = entries.length > 0 ? computeGuidanceScore(c, entries) : { fired: [], missed: [] }

  // In chip mode, chips ARE the score (100 pts total)
  const guidanceTotal = entries.reduce((sum, e) => sum + (e.weight ?? DEFAULT_GUIDANCE_WEIGHT), 0)
  const guidanceNorm = guidanceTotal > 0 ? 100 / guidanceTotal : 1
  const guidanceMaxPts = entries.length > 0 ? 100 : 0
  const guidanceActualPts = entries.length > 0
    ? Math.min(100, Math.round(entries.reduce((sum, e) => sum + computeEntryRatio(e, c) * (e.weight ?? DEFAULT_GUIDANCE_WEIGHT), 0) / guidanceTotal * 100))
    : 0

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <td className="px-4 py-3 whitespace-nowrap relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer">
        <span className={`font-bold ${color}`}>{score}</span>
        <span className={`text-xs ${color} opacity-70`}>{label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute z-50 left-0 top-full mt-1 bg-card border border-border rounded-lg shadow-2xl text-xs flex flex-col"
          style={{ width: '20rem', maxWidth: 'calc(100vw - 1rem)', maxHeight: 'min(560px, 80vh)' }}
        >
          {/* ── GUIDANCE DETAIL VIEW ── */}
          {guidanceView ? (
            <>
              {/* Sticky header */}
              <div className="shrink-0 flex items-center justify-between px-3 pt-3 pb-2 border-b border-border">
                <button onClick={() => setGuidanceView(false)} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <span className="font-semibold text-foreground text-[11px]">✨ Your Lead Criteria</span>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground leading-none">✕</button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5 min-h-0">

                {/* Score contribution card — always visible */}
                <div className="bg-muted/70 rounded-lg p-2.5 space-y-2 border border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Score contribution</span>
                    <span className={`font-bold font-mono text-sm ${guidanceActualPts > 0 ? 'text-purple-700 dark:text-purple-300' : 'text-muted-foreground'}`}>
                      {guidanceActualPts} <span className="text-muted-foreground/70 font-normal text-[10px]">/ {guidanceMaxPts} pts</span>
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
                  <div className="text-[10px] text-muted-foreground leading-snug">
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
                  <p className="text-muted-foreground text-center py-3 text-[11px] leading-relaxed">
                    No criteria active. Open <strong className="text-muted-foreground">Score Settings</strong> to select what makes a great lead.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry: GuidanceEntry) => {
                      const entryFired = fired.filter(f => f.entryId === entry.id)
                      const entryMissed = missed.filter(m => m.entryId === entry.id)
                      const allMatch = entryFired.length > 0 && entryMissed.length === 0
                      const noneMatch = entryFired.length === 0
                      return (
                        <div key={entry.id} className="border border-border rounded-md overflow-hidden">
                          {/* Criterion header */}
                          <div className="px-2 pt-2 pb-1.5">
                            <div className="text-muted-foreground text-[10px] italic leading-snug break-words">"{entry.text}"</div>
                            {entry.summary && (
                              <div className="text-foreground/80 text-[11px] mt-1 leading-snug break-words">
                                <span className="text-purple-700 dark:text-purple-400 not-italic font-medium">AI: </span>{entry.summary}
                              </div>
                            )}
                          </div>
                          {/* Scoring logic */}
                          {entry.rules.length > 0 && (
                            <div className="bg-muted/40 px-2 py-1.5 space-y-1.5">
                              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wide font-semibold">Result for this creator</div>
                              {entryFired.map((f, fi) => {
                                const ruleObj = entry.rules.find(r => r.label === f.ruleLabel) || entry.rules[fi]
                                const evidence = ruleObj ? getGuidanceRuleEvidence(ruleObj, c) : ''
                                return (
                                  <div key={fi} className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-green-500 shrink-0">✓</span>
                                      <span className="flex-1 text-foreground font-medium leading-snug break-words">{f.ruleLabel}</span>
                                      <span className={`font-mono font-bold shrink-0 ${f.pts > 0 ? 'text-green-400' : 'text-red-700 dark:text-red-400'}`}>{f.pts > 0 ? '+' : ''}{f.pts}</span>
                                    </div>
                                    {evidence && (
                                      <div className="ml-4 text-[10px] text-green-700 leading-snug break-words bg-green-900/20 rounded px-1.5 py-0.5">
                                        {evidence}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                              {entryMissed.map((m, mi) => (
                                <div key={mi} className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground/50 shrink-0">✗</span>
                                  <span className="flex-1 text-muted-foreground/70 leading-snug break-words">{m.ruleLabel}</span>
                                  <span className="font-mono shrink-0 text-muted-foreground/50">{m.pts > 0 ? '+' : ''}{m.pts}</span>
                                </div>
                              ))}
                              <div className={`text-[10px] font-medium pt-0.5 border-t border-border/50 ${allMatch ? 'text-green-400' : noneMatch ? 'text-muted-foreground/70' : 'text-yellow-500'}`}>
                                {allMatch ? '✓ Fully matched' : noneMatch ? '✗ Not matched' : `⚡ Partial — ${entryFired.length}/${entry.rules.length} rules hit`}
                              </div>
                            </div>
                          )}
                          {entry.rules.length === 0 && (
                            <div className="bg-muted/40 px-2 py-1.5">
                              <span className="text-muted-foreground/70 text-[10px]">No evaluatable rules — criterion may need rephrasing.</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Sticky footer — link to Score Settings */}
              <div className="shrink-0 border-t border-border px-3 py-2.5 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground/70">Manage criteria in Score Settings</span>
                <button
                  onClick={() => { setOpen(false); setGuidanceView(false) }}
                  className="text-[10px] text-purple-700 dark:text-purple-400 hover:text-purple-700 dark:text-purple-300 transition-colors flex items-center gap-0.5"
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            /* ── MAIN BREAKDOWN VIEW ── */
            <>
              {/* Sticky header */}
              <div className="shrink-0 flex items-center justify-between px-3 pt-3 pb-2 border-b border-border">
                <span className="font-semibold text-foreground">Fit Score Breakdown</span>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground leading-none">✕</button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-3 py-2.5 min-h-0">
                <div className="space-y-1.5">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`w-6 text-right font-mono font-bold shrink-0 leading-snug ${item.pts > 0 ? 'text-green-400' : item.pts < 0 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {item.pts > 0 ? '+' : ''}{item.pts}
                      </span>
                      <div className="flex-1 min-w-0">
                        {item.isGuidance ? (
                          <button onClick={() => setGuidanceView(true)} className="text-purple-700 dark:text-purple-400 hover:text-purple-700 dark:text-purple-300 flex items-center gap-1 text-left">
                            <span>✨ Your Criteria</span>
                            <span className="text-muted-foreground/70">/ {item.max}</span>
                            <span className="text-muted-foreground text-[10px] ml-0.5">view →</span>
                          </button>
                        ) : (
                          <span className="text-foreground/80 leading-snug">{item.label}
                            {item.max > 0 && <span className="text-muted-foreground/70 ml-1">/ {item.max}</span>}
                          </span>
                        )}
                        {item.note && (
                          <div className="text-muted-foreground text-[10px] leading-snug break-words mt-0.5">{item.note}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className={`font-bold text-sm ${color}`}>{score} — {label}</span>
                </div>

                {/* Weight distribution — single horizontal stacked bar */}
                {(() => {
                  // Chip mode: only chip segments. Default mode: base segments.
                  const chipMode = entries.length > 0
                  const segments: { key: string; label: string; w: number }[] = chipMode
                    ? entries.map(e => {
                        const preset = GUIDANCE_PRESETS.find(p => p.entry.text === e.text)
                        return { key: e.id, label: preset ? `${preset.emoji} ${preset.label}` : (e.summary?.split(' ').slice(0,3).join(' ') || 'Criterion'), w: e.weight ?? DEFAULT_GUIDANCE_WEIGHT }
                      })
                    : WEIGHT_META.map(m => ({ key: m.key, label: m.label, w: weights[m.key] }))
                  const segTotal = segments.reduce((s, seg) => s + seg.w, 0)
                  return (
                    <div className="mt-3 pt-2 border-t border-border space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                        <span>Score breakdown</span>
                        {chipMode ? <span className="text-purple-700 dark:text-purple-400 normal-case font-normal">✨ Your criteria</span> : <span className="text-muted-foreground/50 normal-case font-normal">Default</span>}
                      </div>
                      {/* Stacked bar */}
                      <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-muted">
                        {segments.map(seg => {
                          const pct = segTotal > 0 ? (seg.w / segTotal) * 100 : 0
                          return pct > 0 ? (
                            <div
                              key={seg.key}
                              style={{ width: `${pct}%`, backgroundColor: chipMode ? 'rgb(168,85,247)' : 'rgb(99,102,241)' }}
                              title={`${seg.label}: ${Math.round(pct)}%`}
                            />
                          ) : null
                        })}
                      </div>
                      {/* Labels */}
                      <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                        {segments.map(seg => {
                          const pct = Math.round(segTotal > 0 ? (seg.w / segTotal) * 100 : 0)
                          return (
                            <div key={seg.key} className="flex items-center gap-1 min-w-0">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: chipMode ? 'rgb(168,85,247)' : 'rgb(99,102,241)', opacity: pct === 0 ? 0.3 : 1 }} />
                              <span className={`text-[9px] truncate ${chipMode ? 'text-purple-700 dark:text-purple-400' : 'text-muted-foreground/70'}`}>{seg.label.split(' ').slice(0,2).join(' ')} {pct}%</span>
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
        </div>
      )}
    </td>
  )
}

function renderCell(
  id: ColId,
  c: Creator,
  weights: ScoreWeights,
  narrative: string,
  profile: UserProfile | null,
  searching: boolean,
  onDeepSearch: (channelId: string) => void,
): React.ReactNode {
  switch (id) {
    case 'fitScore': {
      return <FitScoreCell key={id} c={c} weights={weights} narrative={narrative} />
    }
    case 'avgViews':    return <td key={id} className="px-4 py-3">{c.avgViews.toLocaleString()}</td>
    case 'subscribers': return <td key={id} className="px-4 py-3 text-foreground/80">{formatSubscribers(c.subscribers)}</td>
    case 'lastPosted':  return (
      <td key={id} className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {c.videoDates?.[0] ? <><div>{c.videoDates[0]}</div>{c.videoDates[1] && <div className="text-muted-foreground/70">{c.videoDates[1]}</div>}</> : <span className="text-muted-foreground/50">—</span>}
      </td>
    )
    case 'email': return (
      <td key={id} className="px-4 py-3 text-xs">
        {c.email ? (
          <a href={buildOutreachEmail(c, profile)} className="text-green-400 hover:underline">{c.email}</a>
        ) : c.enriching ? (
          <span className="flex items-center gap-1 text-muted-foreground"><Spinner />looking...</span>
        ) : (
          <button
            onClick={() => onDeepSearch(c.channelId)}
            disabled={searching}
            title="Deep search — checks website (incl. /press, /partnerships, /sponsor), Linktree-style bio pages, social bios, and multiple DDG queries. Takes 10-20s."
            className="text-[10px] text-purple-700 dark:text-purple-400 hover:text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:border-purple-500/60 rounded px-2 py-0.5 transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {searching ? 'Searching…' : '🔍 Find email'}
          </button>
        )}
      </td>
    )
    case 'linkedin':  return <td key={id} className="px-4 py-3">{c.linkedin  ? <a href={c.linkedin}  target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'website':   return <td key={id} className="px-4 py-3">{c.website   ? <a href={c.website}   target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'instagram': return <td key={id} className="px-4 py-3">{c.instagram ? <a href={c.instagram} target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'twitter':   return <td key={id} className="px-4 py-3">{c.twitter   ? <a href={c.twitter}   target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'tiktok':    return <td key={id} className="px-4 py-3">{c.tiktok    ? <a href={c.tiktok}    target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline">link</a> : '—'}</td>
  }
}

// Follow-up date cell — shows a colored urgency pill and opens a popover
// with a manual date picker plus quick cadence buttons (Tomorrow / +3d /
// +1w / +2w / +1m) and a smart "Use cadence" button that picks the right
// next-step interval based on how many touches the lead has had.
function FollowUpDateCell({ entry, onUpdate }: {
  entry: OutreachEntry
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const tps = parseInt(entry.touchpoints || '0', 10) || 0
  const cadenceDays = nextFollowUpDays(tps + 1)
  const isUnset = !entry.followUpDate
  const dateObj = parseLocalDate(entry.followUpDate)
  const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() })()
  const isOverdue = !!dateObj && (() => { const d = new Date(dateObj); d.setHours(0, 0, 0, 0); return d.getTime() < todayMs })()
  const isToday = !!dateObj && (() => { const d = new Date(dateObj); d.setHours(0, 0, 0, 0); return d.getTime() === todayMs })()

  const pillClass = isUnset
    ? 'bg-muted/50 text-muted-foreground border-border hover:border-border'
    : isOverdue
      ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 hover:border-red-400'
      : isToday
        ? 'bg-yellow-500/15 text-amber-700 dark:text-yellow-300 border-yellow-500/40 hover:border-yellow-400'
        : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:border-blue-400'

  const label = isUnset
    ? '+ set'
    : isOverdue
      ? `${daysAgo(entry.followUpDate)} late`
      : isToday
        ? 'today'
        : `in ${daysFromNow(entry.followUpDate)}d`

  function setDate(iso: string) {
    onUpdate(entry.id, 'followUpDate', iso)
    setOpen(false)
  }

  function setRelative(days: number) {
    setDate(isoDaysFromNow(days))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title={isUnset ? 'No follow-up date — click to set one' : `Follow-up: ${entry.followUpDate}`}
        className={`w-full text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors text-center ${pillClass}`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-64 rounded-lg border border-border bg-card shadow-2xl p-3 text-xs normal-case font-normal">
          {/* Smart "Use cadence" — top action */}
          <button
            onClick={() => setRelative(cadenceDays)}
            className="w-full mb-2 px-3 py-1.5 text-[11px] font-medium text-purple-100 bg-purple-600/40 hover:bg-purple-600/60 border border-purple-500/50 rounded-md transition-colors flex items-center justify-between"
            title="Set to today + the smart cadence step based on this lead's current touch count"
          >
            <span>Use cadence</span>
            <span className="text-[10px] text-purple-700 dark:text-purple-300/80">+{cadenceDays}d (touch {tps + 1})</span>
          </button>

          {/* Quick presets */}
          <div className="grid grid-cols-2 gap-1 mb-2">
            {[
              { label: 'Tomorrow', days: 1 },
              { label: '+3 days', days: 3 },
              { label: '+1 week', days: 7 },
              { label: '+2 weeks', days: 14 },
              { label: '+1 month', days: 30 },
            ].map(p => (
              <button
                key={p.label}
                onClick={() => setRelative(p.days)}
                className="px-2 py-1 text-[11px] text-foreground/80 bg-muted/60 hover:bg-muted hover:text-foreground border border-border hover:border-border rounded transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Manual date picker */}
          <div className="border-t border-border pt-2">
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Pick a specific date</label>
            <input
              type="date"
              value={entry.followUpDate || ''}
              onChange={ev => onUpdate(entry.id, 'followUpDate', ev.target.value)}
              className="w-full bg-muted border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Clear */}
          {!isUnset && (
            <button
              onClick={() => setDate('')}
              className="w-full mt-2 px-3 py-1 text-[11px] text-muted-foreground hover:text-red-700 dark:text-red-300 border border-border hover:border-red-500/50 rounded transition-colors"
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// priority: email=3, linkedin only=2, enriching=1, nothing=0
function renderOutreachCell(
  col: OutreachColConfig,
  e: OutreachEntry,
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void,
  profile: UserProfile | null,
  searching: boolean,
  onSearchContacts: (id: string) => void,
): React.ReactNode {
  const id = col.id
  switch (id) {
    case 'favorite':
      return (
        <button
          onClick={() => onUpdate(e.id, 'favorite', !e.favorite)}
          title={e.favorite ? 'Unstar' : 'Mark as favorite'}
          className={`mt-0.5 transition-colors ${e.favorite ? 'text-amber-700 dark:text-yellow-400 hover:text-amber-700 dark:text-yellow-300' : 'text-muted-foreground/50 hover:text-yellow-500'}`}
          aria-label={e.favorite ? 'Unstar' : 'Mark as favorite'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill={e.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.176 0l-3.366 2.445c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.363-1.118L2.046 9.384c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.302-3.957z" />
          </svg>
        </button>
      )
    case 'channelName':
      return <AutoTextarea value={e.channelName} onChange={v => onUpdate(e.id, 'channelName', v)} className="text-blue-800 dark:text-blue-400 font-medium" />
    case 'channelUrl':
      return (
        <a href={e.channelUrl} target="_blank" className="mt-0.5 block">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-500">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 3.993L9 16z"/>
          </svg>
        </a>
      )
    case 'email':
      return (
        <div className="flex flex-col gap-1">
          {e.email && <a href={buildOutreachEmail({ channelName: e.channelName, email: e.email, videoTitles: [], description: e.description } as unknown as Creator, profile)} className="text-green-400 hover:underline text-xs break-all">{e.email}</a>}
          <AutoTextarea value={e.email} onChange={v => onUpdate(e.id, 'email', v)} placeholder="Add email..." className={e.email ? 'text-muted-foreground/70' : 'text-muted-foreground'} />
          {!e.email && (
            <button
              onClick={() => onSearchContacts(e.id)}
              disabled={searching}
              title="Deep search — checks website (incl. /press, /partnerships, /sponsor), Linktree-style bio pages, social bios, and multiple DDG queries. Takes 10-20s."
              className="self-start mt-0.5 text-[10px] text-purple-700 dark:text-purple-400 hover:text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:border-purple-500/60 rounded px-2 py-0.5 transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              {searching ? 'Searching…' : '🔍 Find email'}
            </button>
          )}
        </div>
      )
    case 'description':
      return <AutoTextarea value={e.description} onChange={v => onUpdate(e.id, 'description', v)} placeholder="—" className="text-muted-foreground" />
    case 'product':
      return <AutoTextarea value={e.product} onChange={v => onUpdate(e.id, 'product', v)} placeholder="Add product..." className="text-foreground" />
    case 'reachedOut':
      return <input type="checkbox" checked={e.reachedOut} onChange={ev => onUpdate(e.id, 'reachedOut', ev.target.checked)} className="w-4 h-4 rounded accent-purple-500 cursor-pointer mt-0.5" />
    case 'medium':
      return (
        <div className="flex flex-col gap-1">
          <select value={e.medium} onChange={ev => onUpdate(e.id, 'medium', ev.target.value)} className="bg-muted border border-border rounded px-2 py-0.5 text-xs text-foreground focus:outline-none focus:border-purple-500 w-full">
            <option value="">—</option>
            <option value="Email">Email</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Other">Other</option>
          </select>
          {e.medium === 'Other' && <AutoTextarea value={e.mediumOther} onChange={v => onUpdate(e.id, 'mediumOther', v)} placeholder="specify..." className="text-foreground" />}
        </div>
      )
    case 'headerUsed':
      return <AutoTextarea value={e.headerUsed} onChange={v => onUpdate(e.id, 'headerUsed', v)} placeholder="Subject line used..." className="text-foreground" />
    case 'status':
      return (
        <select value={e.status || 'Not Outreached'} onChange={ev => onUpdate(e.id, 'status', ev.target.value)}
          className={`w-full rounded px-2 py-0.5 text-xs focus:outline-none border ${e.status === 'Successful' ? 'bg-green-900 border-green-700 text-green-300' : e.status === 'Open' ? 'bg-blue-900 border-blue-700 text-blue-700 dark:text-blue-300' : e.status === 'Rejected' ? 'bg-red-900 border-red-700 text-red-700 dark:text-red-300' : e.status === 'No Response' ? 'bg-muted border-border text-muted-foreground' : 'bg-muted border-border text-muted-foreground'}`}>
          <option value="Not Outreached">Not Outreached</option>
          <option value="Open">Open</option>
          <option value="No Response">No Response</option>
          <option value="Successful">Successful</option>
          <option value="Rejected">Rejected</option>
        </select>
      )
    case 'notes':
      return <AutoTextarea value={e.notes || ''} onChange={v => onUpdate(e.id, 'notes', v)} placeholder="Notes..." className="text-foreground/80" />
    case 'followUpDate':
      return <FollowUpDateCell entry={e} onUpdate={onUpdate} />
    case 'dateReachedOut':
    case 'responseDate':
    case 'meetingScheduled':
      return <input type="date" value={(e[id] as string) || ''} onChange={ev => onUpdate(e.id, id, ev.target.value)} className="bg-muted border border-border rounded px-2 py-0.5 text-xs text-foreground focus:outline-none focus:border-purple-500 w-full" />
    case 'touchpoints':
      return <input type="number" min={0} value={e.touchpoints || ''} onChange={ev => onUpdate(e.id, 'touchpoints', ev.target.value)} placeholder="0" className="w-full bg-transparent text-foreground focus:outline-none focus:bg-muted rounded px-1 text-xs" />
    case 'subscribers':
      return <span className="text-xs text-muted-foreground">{formatSubscribers(e.subscribers || '')}</span>
    case 'avgViews':
      return <span className="text-xs text-muted-foreground">{e.avgViews ? e.avgViews.toLocaleString() : '—'}</span>
    case 'fitScore': {
      const { label, color } = fitScoreMeta(e.fitScore || 0)
      return <span className={`text-xs font-bold ${color}`}>{e.fitScore || 0} <span className="font-normal opacity-70">{label}</span></span>
    }
    case 'linkedin':
      return e.linkedin ? <a href={e.linkedin} target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline text-xs">link</a> : <AutoTextarea value={e.linkedin || ''} onChange={v => onUpdate(e.id, 'linkedin', v)} placeholder="Add URL..." className="text-muted-foreground" />
    case 'contentNiche':
      return <AutoTextarea value={e.contentNiche || ''} onChange={v => onUpdate(e.id, 'contentNiche', v)} placeholder="e.g. golf, finance..." className="text-foreground" />
    case 'phone':
      return <AutoTextarea value={e.phone || ''} onChange={v => onUpdate(e.id, 'phone', v)} placeholder="Add phone..." className="text-foreground" />
    case 'dealValue':
      return <AutoTextarea value={e.dealValue || ''} onChange={v => onUpdate(e.id, 'dealValue', v)} placeholder="$..." className="text-foreground" />
    case 'contractSent':
      return <input type="checkbox" checked={!!e.contractSent} onChange={ev => onUpdate(e.id, 'contractSent', ev.target.checked)} className="w-4 h-4 rounded accent-blue-500 cursor-pointer mt-0.5" />
    default:
      return null
  }
}

function OutreachSubTabs({ active, onChange, favCount, dueCount }: {
  active: 'all' | 'favorites' | 'analytics' | 'followups'
  onChange: (v: 'all' | 'favorites' | 'analytics' | 'followups') => void
  favCount: number
  dueCount: number
}) {
  type SubTabId = 'all' | 'favorites' | 'analytics' | 'followups'
  const tabs: { id: SubTabId; label: React.ReactNode }[] = [
    { id: 'all', label: 'All' },
    { id: 'favorites', label: <>★ Favorites {favCount > 0 && <span className="ml-1 text-amber-700 dark:text-yellow-400/70">({favCount})</span>}</> },
    { id: 'followups', label: <>⏰ Follow-ups {dueCount > 0 && <span className="ml-1 text-red-700 dark:text-red-400/80">({dueCount})</span>}</> },
    { id: 'analytics', label: '📊 Analytics' },
  ]
  return (
    <div className="mb-4 border-b border-border pb-2">
      <AnimatedTabs<SubTabId>
        layoutGroup="outreach-subtabs"
        variant="pill"
        tabs={tabs}
        active={active}
        onChange={onChange}
      />
    </div>
  )
}

// Priority bucketing — derived from how close the follow-up date is.
// High = overdue or due today. Medium = 1-7 days out. Low = 8+ days out.
// `unset` and `ghosted` are special states, not priorities.
type FUBucket = 'high' | 'medium' | 'low' | 'unset' | 'ghosted'

function OutreachFollowUps({ entries, onUpdate, onOpenEntry }: {
  entries: OutreachEntry[]
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onOpenEntry: (id: string) => void
}) {
  const [sort, setSort] = useState<'urgency' | 'pipeline' | 'touchpoints'>('urgency')
  const [showLater, setShowLater] = useState(false)
  const [showUnset, setShowUnset] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium'>('all')
  const [showGhosted, setShowGhosted] = useState(false)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const DAY = 86_400_000

  // Active queue = Open only. "No Response" = ghosted, separate bucket.
  const open = entries.filter(e => e.status === 'Open')
  const ghosted = entries.filter(e => e.status === 'No Response')

  function bucketOf(e: OutreachEntry): FUBucket {
    if (e.status === 'No Response') return 'ghosted'
    const d = parseLocalDate(e.followUpDate)
    if (!d) return 'unset'
    const tDay = new Date(d); tDay.setHours(0, 0, 0, 0)
    const diffDays = Math.round((tDay.getTime() - todayMs) / DAY)
    if (diffDays <= 0) return 'high'   // overdue OR due today
    if (diffDays <= 7) return 'medium' // due in next week
    return 'low'                        // 8+ days out
  }

  function dealValueNum(e: OutreachEntry): number {
    return parseFloat(String(e.dealValue || '').replace(/[^0-9.]/g, '')) || 0
  }
  function urgencyScore(e: OutreachEntry): number {
    // Lower = more urgent; overdue items are most negative.
    const d = parseLocalDate(e.followUpDate)
    if (!d) return Number.MAX_SAFE_INTEGER - 1
    const t = new Date(d); t.setHours(0, 0, 0, 0)
    return Math.round((t.getTime() - todayMs) / DAY)
  }

  function applySort(list: OutreachEntry[]): OutreachEntry[] {
    const sorted = [...list]
    if (sort === 'pipeline') sorted.sort((a, b) => dealValueNum(b) - dealValueNum(a))
    else if (sort === 'touchpoints') sorted.sort((a, b) => (Number(b.touchpoints) || 0) - (Number(a.touchpoints) || 0))
    else sorted.sort((a, b) => urgencyScore(a) - urgencyScore(b))
    return sorted
  }

  // Group rows up front
  const groups: Record<FUBucket, OutreachEntry[]> = {
    high: [], medium: [], low: [], unset: [], ghosted: [],
  }
  for (const e of open) groups[bucketOf(e)].push(e)
  for (const e of ghosted) groups.ghosted.push(e)
  for (const k of Object.keys(groups) as FUBucket[]) groups[k] = applySort(groups[k])

  // Top stats
  const pipelineValue = open.reduce((s, e) => s + dealValueNum(e), 0)
  const atRiskValue = groups.high.reduce((s, e) => s + dealValueNum(e), 0)
  const totalTouches = open.reduce((s, e) => s + (parseInt(e.touchpoints || '0', 10) || 0), 0)

  // Headline summary line — single sentence
  const headline = (() => {
    const h = groups.high.length, m = groups.medium.length, u = groups.unset.length
    if (open.length === 0) return "You don't have any active follow-ups yet."
    if (h === 0 && m === 0 && u === 0) return "All caught up — nothing high or medium priority right now."
    const parts: string[] = []
    if (h > 0) parts.push(`${h} high priority`)
    if (m > 0) parts.push(`${m} medium`)
    if (parts.length === 0 && u > 0) parts.push(`${u} without a date`)
    return parts.length > 0 ? `${parts.join(' · ')} need your attention.` : 'All caught up.'
  })()

  function snooze(e: OutreachEntry, days: number) {
    const base = parseLocalDate(e.followUpDate) ?? new Date()
    base.setDate(base.getDate() + days)
    onUpdate(e.id, 'followUpDate', `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`)
  }
  function markFollowedUp(e: OutreachEntry, opts?: { date?: string; status?: string }) {
    // Increment touchpoints, push date (use override if provided), update status.
    const next = (parseInt(e.touchpoints || '0', 10) || 0) + 1
    onUpdate(e.id, 'touchpoints', String(next))
    onUpdate(e.id, 'dateReachedOut', todayIso())
    if (opts?.status && opts.status !== e.status) {
      onUpdate(e.id, 'status', opts.status)
    }
    // followUpDate last so it doesn't get clobbered by status auto-set rules.
    const newDate = opts?.date ?? isoDaysFromNow(nextFollowUpDays(next))
    onUpdate(e.id, 'followUpDate', newDate)
  }

  if (open.length === 0 && ghosted.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-blue-800 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">No follow-ups yet</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Once you reach out to a creator and set their status to <span className="text-blue-800 dark:text-blue-400">Open</span>, they'll appear here with a follow-up date 3 days out — then 7, 14, 21 as you keep pinging.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Headline + 4 priority-aware stats */}
      <div>
        <p className="text-sm text-foreground/80">{headline}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <FUStat
            label="High priority"
            value={groups.high.length}
            accent={groups.high.length > 0 ? 'red' : 'gray'}
            sub={
              open.length > 0
                ? `${Math.round((groups.high.length / open.length) * 100)}% of queue`
                : 'none right now'
            }
            onClick={() => setPriorityFilter(f => f === 'high' ? 'all' : 'high')}
            active={priorityFilter === 'high'}
          />
          <FUStat
            label="Medium"
            value={groups.medium.length}
            accent={groups.medium.length > 0 ? 'yellow' : 'gray'}
            sub={groups.medium.length > 0 ? 'due this week' : 'nothing this week'}
            onClick={() => setPriorityFilter(f => f === 'medium' ? 'all' : 'medium')}
            active={priorityFilter === 'medium'}
          />
          <FUStat
            label="At-risk $"
            value={atRiskValue > 0 ? `$${atRiskValue.toLocaleString()}` : '—'}
            accent={atRiskValue > 0 ? 'red' : 'gray'}
            sub={
              atRiskValue > 0
                ? `${groups.high.length} high-priority lead${groups.high.length === 1 ? '' : 's'}`
                : 'nothing urgent in pipeline'
            }
            onClick={() => setPriorityFilter(f => f === 'high' ? 'all' : 'high')}
            active={priorityFilter === 'high'}
          />
          <FUStat
            label="Pipeline $"
            value={pipelineValue > 0 ? `$${pipelineValue.toLocaleString()}` : '—'}
            accent="green"
            sub={
              open.length > 0
                ? `${open.length} active · ${totalTouches} touch${totalTouches === 1 ? '' : 'es'}`
                : undefined
            }
            onClick={() => setPriorityFilter('all')}
            active={priorityFilter === 'all'}
          />
        </div>
        {priorityFilter !== 'all' && (
          <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
            <span>Showing only <span className="text-foreground font-medium">{priorityFilter} priority</span> leads.</span>
            <button onClick={() => setPriorityFilter('all')} className="text-purple-700 dark:text-purple-400 hover:text-purple-700 dark:text-purple-300 underline-offset-2 hover:underline">Clear filter</button>
          </div>
        )}
      </div>

      {/* Sort control — minimal */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Sort
        </div>
        <div className="flex bg-card/60 rounded-md p-0.5 border border-border">
          {([
            { id: 'urgency', label: 'Urgency' },
            { id: 'pipeline', label: 'Pipeline $' },
            { id: 'touchpoints', label: 'Touches' },
          ] as { id: typeof sort; label: string }[]).map(opt => (
            <button
              key={opt.id}
              onClick={() => setSort(opt.id)}
              className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                sort === opt.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Section: High priority (overdue + today) */}
      {(priorityFilter === 'all' || priorityFilter === 'high') && (
        groups.high.length > 0 ? (
          <Section
            title="High priority"
            accent="red"
            count={groups.high.length}
            subtitle="Overdue or due today — act first"
            icon={<span className="text-base">🔥</span>}
          >
            {groups.high.map(e => (
              <FollowUpRow
                key={e.id}
                entry={e}
                bucket="high"
                onUpdate={onUpdate}
                onSnooze={snooze}
                onMarkFollowedUp={markFollowedUp}
                onOpen={onOpenEntry}
              />
            ))}
          </Section>
        ) : (
          <Section title="High priority" accent="green" count={0} icon={<span className="text-base">✓</span>}>
            <div className="text-xs text-muted-foreground italic px-1 py-2">
              Nothing urgent. {groups.medium.length > 0 ? `${groups.medium.length} medium-priority lead${groups.medium.length === 1 ? '' : 's'} below.` : 'You\'re fully caught up.'}
            </div>
          </Section>
        )
      )}

      {/* Section: Medium priority (1-7 days out) */}
      {(priorityFilter === 'all' || priorityFilter === 'medium') && groups.medium.length > 0 && (
        <Section
          title="Medium priority"
          accent="yellow"
          count={groups.medium.length}
          subtitle="Due in the next 7 days — plan for these"
          icon={<span className="text-base">📅</span>}
        >
          {groups.medium.map(e => (
            <FollowUpRow
              key={e.id}
              entry={e}
              bucket="medium"
              onUpdate={onUpdate}
              onSnooze={snooze}
              onMarkFollowedUp={markFollowedUp}
              onOpen={onOpenEntry}
            />
          ))}
        </Section>
      )}

      {/* Section: Low priority (8+ days out, collapsed) — hidden during filter */}
      {priorityFilter === 'all' && groups.low.length > 0 && (
        <CollapsibleSection
          title="Low priority"
          count={groups.low.length}
          subtitle="More than a week out — no action needed yet"
          open={showLater}
          onToggle={() => setShowLater(v => !v)}
        >
          {groups.low.map(e => (
            <FollowUpRow
              key={e.id}
              entry={e}
              bucket="low"
              onUpdate={onUpdate}
              onSnooze={snooze}
              onMarkFollowedUp={markFollowedUp}
              onOpen={onOpenEntry}
            />
          ))}
        </CollapsibleSection>
      )}

      {/* Section: No follow-up date set (collapsed) */}
      {priorityFilter === 'all' && groups.unset.length > 0 && (
        <CollapsibleSection
          title="No follow-up date"
          count={groups.unset.length}
          subtitle="Open status but no date — set one to schedule a ping"
          open={showUnset}
          onToggle={() => setShowUnset(v => !v)}
        >
          {groups.unset.map(e => (
            <FollowUpRow
              key={e.id}
              entry={e}
              bucket="unset"
              onUpdate={onUpdate}
              onSnooze={snooze}
              onMarkFollowedUp={markFollowedUp}
              onOpen={onOpenEntry}
            />
          ))}
        </CollapsibleSection>
      )}

      {/* Section: Ghosted leads (No Response) — separate from main queue */}
      {priorityFilter === 'all' && groups.ghosted.length > 0 && (
        <CollapsibleSection
          title="Ghosted"
          count={groups.ghosted.length}
          subtitle="Marked No Response. Optional re-engagement."
          open={showGhosted}
          onToggle={() => setShowGhosted(v => !v)}
        >
          {groups.ghosted.map(e => (
            <FollowUpRow
              key={e.id}
              entry={e}
              bucket="ghosted"
              onUpdate={onUpdate}
              onSnooze={snooze}
              onMarkFollowedUp={markFollowedUp}
              onOpen={onOpenEntry}
            />
          ))}
        </CollapsibleSection>
      )}
    </div>
  )
}

function Section({ title, accent, count, subtitle, icon, children }: {
  title: string
  accent: 'red' | 'yellow' | 'blue' | 'green'
  count: number
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  const accentText = { red: 'text-red-700 dark:text-red-300', yellow: 'text-amber-700 dark:text-yellow-300', blue: 'text-blue-700 dark:text-blue-300', green: 'text-emerald-700 dark:text-emerald-300' }[accent]
  const accentBorder = { red: 'border-red-500/40', yellow: 'border-yellow-500/40', blue: 'border-blue-500/30', green: 'border-emerald-500/30' }[accent]
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className={`text-sm font-semibold ${accentText}`}>{title}</h3>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${accentBorder} ${accentText}`}>{count}</span>
        {subtitle && <span className="text-[11px] text-muted-foreground ml-1">· {subtitle}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function CollapsibleSection({ title, count, subtitle, open, onToggle, children }: {
  title: string
  count: number
  subtitle?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-border pt-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 text-left hover:bg-card/30 rounded px-1 py-1 -mx-1 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-border text-muted-foreground">{count}</span>
        {subtitle && <span className="text-[11px] text-muted-foreground ml-1">· {subtitle}</span>}
      </button>
      {open && <div className="space-y-2 mt-3">{children}</div>}
    </section>
  )
}

function FUStat({ label, value, accent, sub, onClick, active }: {
  label: string
  value: number | string
  accent: 'red' | 'yellow' | 'blue' | 'green' | 'gray'
  sub?: string
  onClick?: () => void
  active?: boolean
}) {
  const accentText = {
    red: 'text-red-700 dark:text-red-400', yellow: 'text-amber-700 dark:text-yellow-400', blue: 'text-foreground',
    green: 'text-emerald-700 dark:text-emerald-400', gray: 'text-foreground',
  }[accent]
  const accentBorder = {
    red: 'border-red-500/30', yellow: 'border-yellow-500/30', blue: 'border-border',
    green: 'border-emerald-500/30', gray: 'border-border',
  }[accent]
  const accentGlow = {
    red: 'before:bg-red-500/[0.04]', yellow: 'before:bg-yellow-500/[0.04]',
    blue: 'before:bg-transparent', green: 'before:bg-emerald-500/[0.04]', gray: 'before:bg-transparent',
  }[accent]
  // High-priority "red" stat card gets the animated beam to scream urgency.
  const showBeam = accent === 'red' && typeof value === 'number' && value > 0
  const isClickable = !!onClick
  const Wrapper = isClickable ? 'button' : 'div'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={isClickable ? { y: -2 } : undefined}
    >
      <Wrapper
        {...(isClickable ? { onClick, type: 'button' } : {})}
        className={`relative w-full text-left bg-card/60 border ${accentBorder} rounded-xl p-4 shadow-sm shadow-black/5 overflow-hidden before:absolute before:inset-0 before:pointer-events-none ${accentGlow} ${isClickable ? 'cursor-pointer hover:border-border/80 hover:shadow-md hover:shadow-black/10' : 'hover:border-border/80'} transition-all ${active ? 'ring-2 ring-purple-500/60 border-purple-500/60' : ''}`}
      >
        <div className="relative">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
            <span>{label}</span>
            {active && <span className="text-purple-700 dark:text-purple-300 text-[10px]">filtered</span>}
          </div>
          <div className={`text-2xl font-bold tabular-nums ${accentText}`}>
            {typeof value === 'number' ? <NumberTicker value={value} /> : value}
          </div>
          {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
        </div>
        {showBeam && <BorderBeam size={120} duration={6} colorFrom="#ef4444" colorTo="#a855f7" />}
      </Wrapper>
    </motion.div>
  )
}

function FollowUpRow({ entry: e, bucket, onUpdate, onSnooze, onMarkFollowedUp, onOpen }: {
  entry: OutreachEntry
  bucket: FUBucket
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onSnooze: (e: OutreachEntry, days: number) => void
  onMarkFollowedUp: (e: OutreachEntry, opts?: { date?: string; status?: string }) => void
  onOpen: (id: string) => void
}) {
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)
  const [followedUpOpen, setFollowedUpOpen] = useState(false)
  const initials = (e.channelName || '?')
    .trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?'

  const tps = parseInt(e.touchpoints || '0', 10) || 0
  const stage = followUpStageLabel(tps)

  // Per-bucket styling
  const accent: 'red' | 'yellow' | 'blue' | 'gray' =
    bucket === 'high' ? 'red'
    : bucket === 'medium' ? 'yellow'
    : bucket === 'low' ? 'blue'
    : 'gray'

  const dotColor = { red: 'bg-red-500', yellow: 'bg-yellow-500', blue: 'bg-blue-500', gray: 'bg-gray-500' }[accent]
  const datePillClass = {
    red: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
    yellow: 'bg-yellow-500/15 text-amber-700 dark:text-yellow-300 border-yellow-500/40',
    blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    gray: 'bg-muted/30 text-muted-foreground border-border',
  }[accent]

  // Smart date label per bucket. For high-priority, distinguish overdue vs today.
  const dateLabel = (() => {
    if (bucket === 'ghosted') return 'ghosted'
    if (bucket === 'unset') return 'no date'
    const days = daysFromNow(e.followUpDate)
    if (bucket === 'high') {
      // Either overdue or due today — daysFromNow returns 0 for both, so we
      // need to check directly with parseLocalDate.
      const d = parseLocalDate(e.followUpDate)
      if (d) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        d.setHours(0, 0, 0, 0)
        if (d.getTime() < today.getTime()) return `${daysAgo(e.followUpDate)} late`
      }
      return 'due today'
    }
    return `in ${days}d`
  })()

  // What action does this row prompt?
  const stageHint = bucket === 'ghosted'
    ? `Marked No Response · ${tps} touch${tps === 1 ? '' : 'es'}`
    : tps >= 4
      ? `Final attempt · ${tps} touch${tps === 1 ? '' : 'es'} so far`
      : `${stage} · ${tps} touch${tps === 1 ? '' : 'es'} so far`

  const dealValue = parseFloat(String(e.dealValue || '').replace(/[^0-9.]/g, '')) || 0

  // Suggested snooze days = next cadence step (so "Snooze" matches the cadence)
  const snoozeDays = nextFollowUpDays(tps)

  return (
    <div className="group/row bg-card/40 border border-border hover:border-border/80 hover:bg-card/60 rounded-lg transition-all hover:shadow-md hover:shadow-black/5">
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-foreground text-[10px] font-semibold flex items-center justify-center">
            {initials}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-border ${dotColor}`} title={e.status} />
        </div>

        {/* Identity + stage. Click to open detail modal. */}
        <button onClick={() => onOpen(e.id)} className="flex-1 min-w-0 text-left" title="Open lead details">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-foreground truncate">{e.channelName}</span>
            {e.favorite && <span className="text-[10px] text-amber-700 dark:text-yellow-400 shrink-0">★</span>}
            {e.email && <span className="text-[10px] text-emerald-700 dark:text-emerald-400/80 shrink-0" title="Has email">✉</span>}
            {e.linkedin && <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 shrink-0" title="Has LinkedIn">in</span>}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            <span className="text-foreground/80">{stageHint}</span>
            {e.dateReachedOut && <span> · reached {daysAgo(e.dateReachedOut)} ago</span>}
            {e.medium && <span> · via {e.medium}</span>}
          </div>
        </button>

        {/* Pipeline value chip */}
        {dealValue > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-px rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0" title="Deal value">
            ${dealValue.toLocaleString()}
          </span>
        )}

        {/* Date pill — clickable to open cadence popover */}
        <div className="relative shrink-0">
          <button
            onClick={() => setDatePopoverOpen(v => !v)}
            title="Click to change follow-up date"
            className={`text-[10px] uppercase tracking-wider font-medium px-2 py-1 rounded border shadow-sm transition-all hover:scale-105 ${datePillClass}`}
          >
            {dateLabel}
          </button>
          {datePopoverOpen && (
            <CadencePopover
              currentDate={e.followUpDate || ''}
              touchpoints={tps}
              onPick={(iso) => { onUpdate(e.id, 'followUpDate', iso); setDatePopoverOpen(false) }}
              onClose={() => setDatePopoverOpen(false)}
              align="right"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {bucket === 'ghosted' ? (
            <>
              <button
                onClick={() => onUpdate(e.id, 'status', 'Open')}
                title="Re-engage — moves back to active queue with a fresh date"
                className="text-[10px] font-medium text-purple-800 dark:text-purple-200 hover:text-foreground bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded px-2 py-0.5 transition-colors"
              >
                Re-engage
              </button>
              <button
                onClick={() => onUpdate(e.id, 'status', 'Rejected')}
                title="Confirm dead lead"
                className="w-5 h-5 flex items-center justify-center text-[10px] text-red-700 dark:text-red-400 hover:text-foreground border border-red-500/30 hover:bg-red-600/30 hover:border-red-500 rounded transition-colors"
              >✕</button>
            </>
          ) : (
            <>
              {/* Primary action — opens confirm popover with date + status */}
              <div className="relative">
                <button
                  onClick={() => setFollowedUpOpen(v => !v)}
                  title="Confirm follow-up: pick next date + status"
                  className="text-[10px] font-medium text-purple-800 dark:text-purple-200 hover:text-foreground bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded px-2 py-0.5 transition-colors"
                >
                  Followed up
                </button>
                {followedUpOpen && (
                  <FollowedUpPopover
                    touchpoints={tps}
                    currentStatus={e.status}
                    onConfirm={({ date, status }) => {
                      onMarkFollowedUp(e, { date, status })
                      setFollowedUpOpen(false)
                    }}
                    onClose={() => setFollowedUpOpen(false)}
                    align="right"
                  />
                )}
              </div>
              {/* Snooze — always visible, icon only */}
              <button
                onClick={() => onSnooze(e, snoozeDays)}
                title={`Snooze ${snoozeDays}d (next cadence step)`}
                className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground border border-white/10 hover:border-white/30 rounded transition-colors"
                aria-label="Snooze"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
              {/* Secondary actions — hover-revealed for cleaner default look */}
              <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                <button
                  onClick={() => onUpdate(e.id, 'status', 'Successful')}
                  title="They said yes"
                  className="w-5 h-5 flex items-center justify-center text-[10px] text-emerald-700 dark:text-emerald-400 hover:text-foreground border border-emerald-500/30 hover:bg-emerald-600/30 hover:border-emerald-500 rounded transition-colors"
                >✓</button>
                <button
                  onClick={() => onUpdate(e.id, 'status', 'No Response')}
                  title="Ghost — move to No Response queue"
                  className="w-5 h-5 flex items-center justify-center text-[10px] text-muted-foreground hover:text-foreground border border-white/10 hover:border-white/30 rounded transition-colors"
                  aria-label="Ghost"
                >👻</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Parse "YYYY-MM-DD" as LOCAL midnight (not UTC midnight, which is what
// `new Date("YYYY-MM-DD")` does and bumps the bucket by a day in negative
// timezones). Falls back to native parsing for ISO strings with a time.
function parseLocalDate(s: string): Date | null {
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// Today's date as YYYY-MM-DD in local time.
function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// N days from today as YYYY-MM-DD in local time.
function isoDaysFromNow(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Progressive follow-up cadence — most replies come from touch 2 / 3,
// not touch 5+. Tighter intervals early, looser later.
function nextFollowUpDays(touchpoints: number): number {
  if (touchpoints <= 1) return 3
  if (touchpoints === 2) return 7
  if (touchpoints === 3) return 14
  return 21
}

// Returns the human label for "what action should this lead trigger?"
// based on its current touchpoint count.
function followUpStageLabel(touchpoints: number): string {
  if (touchpoints <= 1) return 'First follow-up'
  if (touchpoints === 2) return 'Second follow-up'
  if (touchpoints === 3) return 'Third follow-up'
  return 'Final attempt'
}

function daysAgo(iso: string): string {
  if (!iso) return '?'
  const d = parseLocalDate(iso); if (!d) return '?'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const that = new Date(d); that.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - that.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  return `${days}d`
}

function daysFromNow(iso: string): number {
  if (!iso) return 0
  const d = parseLocalDate(iso); if (!d) return 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const that = new Date(d); that.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((that.getTime() - today.getTime()) / 86_400_000))
}

function OutreachAnalytics({ entries, customMetrics, onOpenCustomize }: {
  entries: OutreachEntry[]
  customMetrics: import('@/lib/types').CustomMetric[]
  onOpenCustomize: () => void
}) {
  if (entries.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center">
        <p className="text-muted-foreground text-sm">No outreach yet — add some entries first to see analytics.</p>
      </div>
    )
  }

  const total = entries.length
  // "Reached out" = anything but "Not Outreached" / blank status.
  // "Response received" = creator replied either way (Successful or Rejected).
  // No Response = reached out but never heard back; still counts as reached out.
  const isReachedOut = (e: OutreachEntry) => e.status !== 'Not Outreached' && e.status !== ''
  const reachedOut = entries.filter(isReachedOut).length
  const responseReceived = entries.filter(e => e.status === 'Successful' || e.status === 'Rejected').length
  const successful = entries.filter(e => e.status === 'Successful').length
  const rejected = entries.filter(e => e.status === 'Rejected').length
  const open = entries.filter(e => e.status === 'Open').length
  const noResponse = entries.filter(e => e.status === 'No Response').length
  const notOutreached = entries.filter(e => e.status === 'Not Outreached' || e.status === '').length

  const pipelineValue = entries
    .filter(e => e.status !== 'Rejected')
    .reduce((sum, e) => {
      const num = parseFloat(String(e.dealValue || '').replace(/[^0-9.]/g, ''))
      return sum + (isFinite(num) ? num : 0)
    }, 0)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const stale = entries.filter(e => {
    if (!e.followUpDate || e.status !== 'Open') return false
    const t = new Date(e.followUpDate).getTime()
    return isFinite(t) && t < todayMs
  }).length

  // Response rate: of those you reached out to, who responded either way.
  const responseRate = reachedOut > 0 ? Math.round((responseReceived / reachedOut) * 100) : 0
  // Win rate: of those who responded, what fraction was Successful.
  const winRate = responseReceived > 0 ? Math.round((successful / responseReceived) * 100) : 0

  const SEVEN_D_AGO = Date.now() - 7 * 24 * 60 * 60 * 1000
  const addedLast7 = entries.filter(e => e.addedAt > SEVEN_D_AGO).length
  const reachedLast7 = entries.filter(e => {
    if (!e.dateReachedOut) return false
    const t = new Date(e.dateReachedOut).getTime()
    return isFinite(t) && t > SEVEN_D_AGO
  }).length

  const [mediumScope, setMediumScope] = useState<'all' | 'successful' | 'rejected'>('all')
  const mediumPool = entries.filter(e => {
    if (!isReachedOut(e)) return false
    if (mediumScope === 'successful') return e.status === 'Successful'
    if (mediumScope === 'rejected') return e.status === 'Rejected'
    return true
  })
  const mediumCounts = { Email: 0, LinkedIn: 0, Other: 0 }
  mediumPool.forEach(e => {
    if (e.medium === 'Email') mediumCounts.Email++
    else if (e.medium === 'LinkedIn') mediumCounts.LinkedIn++
    else if (e.medium === 'Other' || e.medium === '') mediumCounts.Other++
  })
  const totalMedium = mediumCounts.Email + mediumCounts.LinkedIn + mediumCounts.Other

  return (
    <div className="space-y-6">
      <div className="flex justify-end -mt-2">
        <button
          onClick={onOpenCustomize}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-3 py-1.5 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Customize Analytics
        </button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <AStat label="In pipeline" value={total} />
        <AStat label="Reached out" value={reachedOut} sub={total > 0 ? `${Math.round(reachedOut / total * 100)}% of pipeline` : undefined} />
        <AStat label="Response received" value={responseReceived} sub="Successful + Rejected" />
        <AStat label="Response rate" value={`${responseRate}%`} sub={`${responseReceived} of ${reachedOut} reached out`} />
        <AStat label="Win rate" value={`${winRate}%`} sub={`${successful} of ${responseReceived} responses`} />
        <AStat label="Pipeline $" value={pipelineValue > 0 ? `$${pipelineValue.toLocaleString()}` : '—'} sub="non-rejected" />
        <AStat label="Stale follow-ups" value={stale} highlight={stale > 0} />
      </div>

      {/* Status breakdown */}
      <div className="bg-card/40 border border-border rounded-xl p-5">
        <div className="text-sm font-semibold text-foreground mb-3">Status breakdown</div>
        <StackedBar
          segments={[
            { label: 'Successful', value: successful, color: 'bg-green-500' },
            { label: 'Open', value: open, color: 'bg-blue-500' },
            { label: 'No Response', value: noResponse, color: 'bg-gray-500' },
            { label: 'Rejected', value: rejected, color: 'bg-red-500' },
            { label: 'Not Outreached', value: notOutreached, color: 'bg-muted' },
          ]}
          total={total}
        />
      </div>

      {/* Velocity + medium */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card/40 border border-border rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-3">Velocity (last 7 days)</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-2xl font-bold text-foreground tabular-nums">{addedLast7}</div>
              <div className="text-[11px] text-muted-foreground">added</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tabular-nums">{reachedLast7}</div>
              <div className="text-[11px] text-muted-foreground">reached out</div>
            </div>
          </div>
        </div>

        <div className="bg-card/40 border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="text-sm font-semibold text-foreground">Outreach by medium</div>
            <div className="flex bg-muted/60 rounded-md p-0.5">
              {([
                { id: 'all', label: 'All' },
                { id: 'successful', label: 'Successful' },
                { id: 'rejected', label: 'Rejected' },
              ] as { id: 'all' | 'successful' | 'rejected'; label: string }[]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setMediumScope(opt.id)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    mediumScope === opt.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {totalMedium > 0 ? (
            <StackedBar
              segments={[
                { label: 'Email', value: mediumCounts.Email, color: 'bg-purple-500' },
                { label: 'LinkedIn', value: mediumCounts.LinkedIn, color: 'bg-blue-500' },
                { label: 'Other', value: mediumCounts.Other, color: 'bg-gray-500' },
              ]}
              total={totalMedium}
            />
          ) : (
            <div className="text-xs text-muted-foreground">
              {mediumScope === 'all' ? 'Nothing reached out yet.' : `No ${mediumScope} outreach yet.`}
            </div>
          )}
        </div>
      </div>

      {/* Custom metrics */}
      {customMetrics.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-foreground mb-3">My metrics</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {customMetrics.map(m => (
              <CustomMetricCard key={m.id} metric={m} entries={entries} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CustomMetricCard({ metric, entries }: {
  metric: import('@/lib/types').CustomMetric
  entries: OutreachEntry[]
}) {
  const value = computeMetric(metric, entries)
  return (
    <div className="bg-card/40 border border-border rounded-xl p-4 hover:border-border transition-colors">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 truncate" title={metric.label}>{metric.label}</div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1 capitalize">{metricTypeLabel(metric)}</div>
    </div>
  )
}

function AStat({ label, value, sub, highlight }: { label: string; value: number | string; sub?: string; highlight?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`relative bg-card/60 border rounded-xl p-4 shadow-sm shadow-black/5 hover:border-border/80 transition-colors ${highlight ? 'border-red-500/40' : 'border-border'}`}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${highlight ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
        {typeof value === 'number' ? <NumberTicker value={value} /> : value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </motion.div>
  )
}

function StackedBar({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {segments.map(s => s.value > 0 && (
          <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2.5 h-2.5 rounded-sm ${s.color}`} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="text-foreground tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OutreachTab({ entries, colConfig, onUpdate, onRemove, onOpenCustomize, onReorderCols, onOpenManualAdd, onSearchContacts, searchingIds, onSearchAll, bulkRunning, profile, emptyVariant }: {
  entries: OutreachEntry[]
  colConfig: OutreachColConfig[]
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onRemove: (id: string) => void
  onOpenCustomize: () => void
  onReorderCols: (newConfig: OutreachColConfig[]) => void
  onOpenManualAdd: () => void
  onSearchContacts: (id: string) => void
  searchingIds: Set<string>
  onSearchAll: () => void
  bulkRunning: boolean
  profile: UserProfile | null
  emptyVariant?: 'all' | 'favorites'
}) {
  const visibleCols = colConfig.filter(c => c.visible)
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(colConfig.map(c => [c.id, c.width]))
  )
  useEffect(() => {
    setWidths(prev => {
      const next = { ...prev }
      colConfig.forEach(c => { if (!(c.id as string in next)) next[c.id as string] = c.width })
      return next
    })
  }, [colConfig])

  const resizing = useRef<{ id: string; startX: number; startW: number } | null>(null)
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [sort, setSort] = useState<{ col: keyof OutreachEntry | null; dir: 'asc' | 'desc' }>({ col: null, dir: 'desc' })
  const [showFavTooltip, setShowFavTooltip] = useState(false)
  const favTooltipRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onClick(ev: MouseEvent) {
      if (favTooltipRef.current && !favTooltipRef.current.contains(ev.target as Node)) {
        setShowFavTooltip(false)
      }
    }
    if (showFavTooltip) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showFavTooltip])

  function handleColDrop(targetIdx: number) {
    const from = dragIdx.current
    // index 0 is the leftmost locked column (★ favorite)
    if (from === null || from === 0 || targetIdx === 0 || from === targetIdx) { setDragOverIdx(null); return }
    const newVisible = [...visibleCols]
    const [moved] = newVisible.splice(from, 1)
    newVisible.splice(targetIdx, 0, moved)
    onReorderCols([...newVisible, ...colConfig.filter(c => !c.visible)])
    dragIdx.current = null
    setDragOverIdx(null)
  }

  function startResize(e: React.MouseEvent, colId: string) {
    e.preventDefault()
    resizing.current = { id: colId, startX: e.clientX, startW: widths[colId] ?? 120 }
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const { id, startX, startW } = resizing.current
      setWidths(prev => ({ ...prev, [id]: Math.max(40, startW + ev.clientX - startX) }))
    }
    const onUp = () => { resizing.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const totalWidth = visibleCols.reduce((sum, c) => sum + (widths[c.id as string] ?? c.defaultWidth), 0) + 36

  // Sort entries by the active column. Empty values always go to the bottom.
  const sortedEntries = (() => {
    if (!sort.col) return entries
    const col = sort.col
    const dir = sort.dir === 'asc' ? 1 : -1
    const numericCols: (keyof OutreachEntry)[] = ['avgViews', 'fitScore', 'addedAt', 'touchpoints']
    return [...entries].sort((a, b) => {
      const va = a[col]
      const vb = b[col]
      const aEmpty = va == null || va === '' || va === false
      const bEmpty = vb == null || vb === '' || vb === false
      if (aEmpty && bEmpty) return 0
      if (aEmpty) return 1
      if (bEmpty) return -1
      if (typeof va === 'boolean' || typeof vb === 'boolean') {
        return (Number(vb) - Number(va)) * dir
      }
      if (numericCols.includes(col) || (!isNaN(Number(va)) && !isNaN(Number(vb)) && va !== '' && vb !== '')) {
        const na = typeof va === 'number' ? va : parseFloat(String(va).replace(/[^0-9.\-]/g, '')) || 0
        const nb = typeof vb === 'number' ? vb : parseFloat(String(vb).replace(/[^0-9.\-]/g, '')) || 0
        return (na - nb) * dir
      }
      return String(va).localeCompare(String(vb)) * dir
    })
  })()

  function handleHeaderClick(colId: keyof OutreachEntry) {
    if (colId === 'favorite') return // Favorite header is the click-tooltip
    setSort(prev => {
      if (prev.col !== colId) return { col: colId, dir: 'desc' } // first click
      if (prev.dir === 'desc') return { col: colId, dir: 'asc' } // second click → asc
      return { col: null, dir: 'desc' } // third click → unsorted
    })
  }

  if (entries.length === 0) {
    return (
      <div className="mt-4">
        <div className="flex justify-end gap-2 mb-3">
          <button onClick={onOpenManualAdd} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-3 py-1.5 transition-colors">
            <span className="text-base leading-none">+</span> Add manually
          </button>
          <button onClick={onOpenCustomize} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-3 py-1.5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Customize Columns
          </button>
        </div>
        <div className="mt-2 border border-dashed border-border rounded-xl py-16 px-6 text-center">
          {emptyVariant === 'favorites' ? (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-amber-700 dark:text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.176 0l-3.366 2.445c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.363-1.118L2.046 9.384c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.302-3.957z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No favorites yet</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Click the <span className="text-amber-700 dark:text-yellow-400">★</span> next to any outreach entry to mark it as a favorite. Starred entries show up here.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-purple-700 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">Your outreach list is empty</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Run a search in <span className="text-foreground/80">Results</span>, then click the <span className="text-purple-700 dark:text-purple-400">+</span> icon on any creator to add them here. Or use the menu &rarr; Import to upload an Excel of past outreach.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end gap-2 mb-3">
        <button onClick={onOpenManualAdd} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-3 py-1.5 transition-colors">
          <span className="text-base leading-none">+</span> Add manually
        </button>
        <button onClick={onOpenCustomize} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-3 py-1.5 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Customize Columns
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="table-fixed text-sm border-collapse" style={{ width: totalWidth }}>
          <thead className="bg-card/95 backdrop-blur-md text-foreground/80 border-b border-border">
            <tr>
              {visibleCols.map((col, idx) => {
                const colId = col.id as string
                const isLocked = idx === 0
                const isOver = dragOverIdx === idx && !isLocked
                return (
                  <th
                    key={colId}
                    style={{ width: widths[colId] ?? col.defaultWidth }}
                    draggable={!isLocked}
                    onDragStart={() => { if (!isLocked) dragIdx.current = idx }}
                    onDragOver={e => { e.preventDefault(); if (!isLocked) setDragOverIdx(idx) }}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={e => { e.preventDefault(); handleColDrop(idx) }}
                    onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null) }}
                    onClick={(e) => {
                      // ignore clicks bubbling from the resize handle / favorite tooltip
                      const target = e.target as HTMLElement
                      if (target.closest('[data-no-sort]')) return
                      handleHeaderClick(col.id)
                    }}
                    className={`relative text-left px-3 py-3 select-none font-medium transition-colors ${!isLocked ? 'cursor-grab' : ''} ${sort.col === col.id ? 'text-foreground bg-muted/30' : ''} ${isOver ? 'border-l-2 border-blue-400 bg-muted' : ''}`}
                  >
                    {colId === 'favorite' ? (
                      <div ref={favTooltipRef} className="relative" data-no-sort>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowFavTooltip(v => !v) }}
                          className="text-amber-700 dark:text-yellow-400 hover:text-amber-700 dark:text-yellow-300 text-base leading-none"
                          aria-label="What is the favorites column?"
                          title="What is this?"
                        >
                          ★
                        </button>
                        {showFavTooltip && (
                          <div className="absolute left-0 top-7 z-30 w-56 rounded-lg border border-border bg-card shadow-xl p-3 text-xs text-foreground/80 normal-case font-normal">
                            Click the star next to any row to favorite it. View only your favorites in <span className="text-amber-700 dark:text-yellow-400">Outreach &rarr; Favorites</span>.
                          </div>
                        )}
                      </div>
                    ) : (
                      <span
                        className="truncate flex items-center gap-1"
                        title={col.tooltip ? `${col.tooltip} · click header to sort` : 'Click header to sort'}
                      >
                        {!isLocked && <span className="text-muted-foreground/70 text-xs">⠿</span>}
                        {col.label}
                        {sort.col === col.id && (
                          <span className="text-purple-700 dark:text-purple-400 text-[10px] ml-0.5" aria-label={sort.dir}>
                            {sort.dir === 'desc' ? '↓' : '↑'}
                          </span>
                        )}
                        {colId === 'email' && (() => {
                          const pending = entries.filter(e => !e.email).length
                          if (pending === 0 && !bulkRunning) return null
                          return (
                            <button
                              data-no-sort
                              onClick={(ev) => { ev.stopPropagation(); onSearchAll() }}
                              disabled={bulkRunning}
                              draggable={false}
                              onDragStart={(ev) => ev.preventDefault()}
                              title={`Refresh emails for ${pending} row${pending === 1 ? '' : 's'} still missing one. ~10s each, 3 in parallel.`}
                              className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded text-purple-700 dark:text-purple-400 hover:text-foreground hover:bg-purple-500/20 transition-colors disabled:opacity-60 disabled:cursor-wait"
                              aria-label={`Refresh ${pending} missing emails`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${bulkRunning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )
                        })()}
                      </span>
                    )}
                    <div data-no-sort onMouseDown={e => startResize(e, colId)} className="absolute right-0 top-0 h-full w-2 cursor-col-resize group flex items-center justify-center">
                      <div className="w-px h-4 bg-gray-600 group-hover:bg-blue-400 transition-colors" />
                    </div>
                  </th>
                )
              })}
              <th style={{ width: 36 }} className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((e, i) => (
              <AnimatedRow key={e.id} index={i} className={`transition-colors ${i % 2 === 0 ? 'bg-card/40 hover:bg-card/80' : 'bg-background hover:bg-card/40'}`}>
                {visibleCols.map(col => (
                  <td key={col.id as string} className="px-3 py-2 align-top" style={{ width: widths[col.id as string] ?? col.defaultWidth }}>
                    {renderOutreachCell(col, e, onUpdate, profile, searchingIds.has(e.id), onSearchContacts)}
                  </td>
                ))}
                <td className="px-3 py-2 align-top" style={{ width: 36 }}>
                  <button onClick={() => onRemove(e.id)} className="text-muted-foreground/50 hover:text-red-700 dark:text-red-400 transition-colors"><TrashIcon /></button>
                </td>
              </AnimatedRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CreatorTable({ creators, outreachIds, dismissedIds, onAddToOutreach, onDismiss, onReorderCols, loading, sortCol, sortDir, onSort, colConfig, loadMoreBatch, scoreWeights, scoreNarrative, activePlatform, totalUnfiltered, profile, onDeepSearch, deepSearchingIds, onDeepSearchAll, bulkRunning }: {
  creators: Creator[], outreachIds: Set<string>, dismissedIds: Set<string>
  onAddToOutreach: (c: Creator) => void
  onDismiss: (c: Creator) => void
  onReorderCols: (newConfig: ColConfig[]) => void
  loading?: boolean
  sortCol: SortCol, sortDir: SortDir, onSort: (col: SortCol) => void
  colConfig: ColConfig[]
  loadMoreBatch?: Creator[]
  scoreWeights: ScoreWeights
  scoreNarrative: string
  activePlatform: PlatformId
  totalUnfiltered: number
  profile: UserProfile | null
  onDeepSearch: (channelId: string) => void
  deepSearchingIds: Set<string>
  onDeepSearchAll: () => void
  bulkRunning: boolean
}) {
  const { entries: guidanceEntries } = useContext(GuidanceContext)
  const sorted = useMemo(() => sortCreators(creators, sortCol, sortDir, scoreWeights, guidanceEntries), [creators, sortCol, sortDir, scoreWeights, guidanceEntries])
  const visibleCols = colConfig.filter(c => c.visible)
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  function handleColDrop(targetIdx: number) {
    const from = dragIdx.current
    if (from === null || from === targetIdx) { setDragOverIdx(null); return }
    const newVisible = [...visibleCols]
    const [moved] = newVisible.splice(from, 1)
    newVisible.splice(targetIdx, 0, moved)
    onReorderCols([...newVisible, ...colConfig.filter(c => !c.visible)])
    dragIdx.current = null
    setDragOverIdx(null)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-card/95 backdrop-blur-md text-foreground/80 border-b border-border">
          <tr>
            <th className="px-2 py-3 text-center w-12" title="Skip — hide this creator from results">
              <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                <DismissIcon active={false} />
                <span className="text-[9px] font-semibold tracking-wide uppercase">Skip</span>
              </div>
            </th>
            <th className="px-2 py-3 text-center w-12" title="Add to Outreach list">
              <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                <PlusCircleIcon added={false} />
                <span className="text-[9px] font-semibold tracking-wide uppercase">Outreach</span>
              </div>
            </th>
            <th className="text-left px-4 py-3 whitespace-nowrap select-none font-medium">Channel</th>
            {visibleCols.map((col, idx) => {
              const sc = COL_SORT[col.id]
              const isOver = dragOverIdx === idx
              return (
                <th
                  key={col.id}
                  draggable
                  onDragStart={() => { dragIdx.current = idx }}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(idx) }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={e => { e.preventDefault(); handleColDrop(idx) }}
                  onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null) }}
                  onClick={() => sc && onSort(sc)}
                  className={`text-left px-4 py-3 select-none whitespace-nowrap transition-colors ${sc ? 'cursor-grab hover:text-foreground' : ''} ${isOver ? 'border-l-2 border-blue-400 bg-muted' : ''}`}
                >
                  <span className="mr-1 text-muted-foreground/70 text-xs">⠿</span>
                  {col.label}
                  {sc && <SortIndicator col={sc} sortCol={sortCol} sortDir={sortDir} />}
                  {col.id === 'email' && (() => {
                    const pending = sorted.filter(c => !c.email && !c.enriching).length
                    if (pending === 0 && !bulkRunning) return null
                    return (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); onDeepSearchAll() }}
                        disabled={bulkRunning}
                        title={`Refresh emails for ${pending} row${pending === 1 ? '' : 's'} still missing one. ~10s each, 3 in parallel.`}
                        aria-label={`Refresh ${pending} missing emails`}
                        className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded text-purple-700 dark:text-purple-400 hover:text-foreground hover:bg-purple-500/20 transition-colors disabled:opacity-60 disabled:cursor-wait"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${bulkRunning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    )
                  })()}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && !loading && (
            <tr>
              <td colSpan={3 + visibleCols.length} className="px-6 py-10 text-center text-muted-foreground/70 text-sm">
                {totalUnfiltered > 0 && activePlatform !== 'youtube'
                  ? `None of the ${totalUnfiltered} results have ${PLATFORM_CONFIGS.find(p => p.id === activePlatform)?.label} linked — try a broader search`
                  : 'Search for a topic above to find creators'}
              </td>
            </tr>
          )}
          {sorted.map((c, i) => (
            <AnimatedRow key={c.channelId} index={i} className={`transition-colors ${i % 2 === 0 ? 'bg-card/40 hover:bg-card/80' : 'bg-background hover:bg-card/40'}`}>
              <td className="px-2 py-3 text-center">
                <button
                  onClick={() => onDismiss(c)}
                  title="Skip — hide this creator from results"
                  className={`transition-colors ${dismissedIds.has(c.channelId) ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground hover:text-red-700 dark:text-red-400'}`}
                >
                  <DismissIcon active={dismissedIds.has(c.channelId)} />
                </button>
              </td>
              <td className="px-2 py-3 text-center">
                <button
                  onClick={() => onAddToOutreach(c)}
                  title={outreachIds.has(c.channelId) ? 'Remove from Outreach' : 'Add to Outreach'}
                  className={`transition-colors ${outreachIds.has(c.channelId) ? 'text-purple-700 dark:text-purple-400' : 'text-muted-foreground hover:text-purple-700 dark:text-purple-400'}`}
                >
                  <PlusCircleIcon added={outreachIds.has(c.channelId)} />
                </button>
              </td>
              <td className="px-4 py-3"><a href={c.channelUrl} target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline font-medium">{c.channelName}</a></td>
              {visibleCols.map(col => renderCell(col.id, c, scoreWeights, scoreNarrative, profile, deepSearchingIds.has(c.channelId), onDeepSearch))}
            </AnimatedRow>
          ))}
          {loadMoreBatch && loadMoreBatch.length > 0 && (
            <>
              <tr>
                <td colSpan={3 + visibleCols.length} className="px-4 py-2 bg-muted/60 border-t-2 border-b border-border">
                  <span className="text-xs text-muted-foreground font-medium tracking-wide">— {loadMoreBatch.length} additional results —</span>
                </td>
              </tr>
              {loadMoreBatch.map((c, i) => (
                <tr key={`lm-${c.channelId}`} className={`transition-colors ${i % 2 === 0 ? 'bg-card/40 hover:bg-card/80' : 'bg-background hover:bg-card/40'}`}>
                  <td className="px-2 py-3 text-center">
                    <button
                      onClick={() => onDismiss(c)}
                      title="Skip — hide this creator from results"
                      className={`transition-colors ${dismissedIds.has(c.channelId) ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground hover:text-red-700 dark:text-red-400'}`}
                    >
                      <DismissIcon active={dismissedIds.has(c.channelId)} />
                    </button>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button
                      onClick={() => onAddToOutreach(c)}
                      title={outreachIds.has(c.channelId) ? 'Remove from Outreach' : 'Add to Outreach'}
                      className={`transition-colors ${outreachIds.has(c.channelId) ? 'text-purple-700 dark:text-purple-400' : 'text-muted-foreground/70 hover:text-purple-700 dark:text-purple-400'}`}
                    >
                      <PlusCircleIcon added={outreachIds.has(c.channelId)} />
                    </button>
                  </td>
                  <td className="px-4 py-3"><a href={c.channelUrl} target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline font-medium">{c.channelName}</a></td>
                  {visibleCols.map(col => renderCell(col.id, c, scoreWeights, scoreNarrative, profile, deepSearchingIds.has(c.channelId), onDeepSearch))}
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function Home() {
  const [keyword, setKeyword] = useState('')
  const maxResults = 100
  const [minViews, setMinViews] = useState(0)
  const [maxViews, setMaxViews] = useState(200000)
  const [maxAgeDays, setMaxAgeDays] = useState<number>(Infinity)
  const [showFilter, setShowFilter] = useState(false)
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 })
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('fitScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [activeTab, setActiveTab] = useState<ActiveTab>('results')
  const [outreachSubTab, setOutreachSubTab] = useState<'all' | 'favorites' | 'analytics' | 'followups'>('all')
  const [customMetrics, setCustomMetrics] = useState<import('@/lib/types').CustomMetric[]>([])
  const [editingMetric, setEditingMetric] = useState<import('@/lib/types').CustomMetric | null>(null)
  const [showAddMetric, setShowAddMetric] = useState(false)
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [viewingLeadId, setViewingLeadId] = useState<string | null>(null)
  const [showAnalyticsCustomize, setShowAnalyticsCustomize] = useState(false)
  const [draftMetrics, setDraftMetrics] = useState<import('@/lib/types').CustomMetric[]>([])
  const [outreach, setOutreach] = useState<OutreachEntry[]>([])
  const [outreachIds, setOutreachIds] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [emailOnly, setEmailOnly] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [colConfig, setColConfig] = useState<ColConfig[]>(DEFAULT_COLS)
  const [showCustomize, setShowCustomize] = useState(false)
  const [draftCols, setDraftCols] = useState<ColConfig[]>(DEFAULT_COLS)
  const [outreachColConfig, setOutreachColConfig] = useState<OutreachColConfig[]>(DEFAULT_OUTREACH_COLS)
  const [showOutreachCustomize, setShowOutreachCustomize] = useState(false)
  const [draftOutreachCols, setDraftOutreachCols] = useState<OutreachColConfig[]>(DEFAULT_OUTREACH_COLS)
  const [dismissed, setDismissed] = useState<Creator[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [loadMoreCreators, setLoadMoreCreators] = useState<Creator[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentKeyword, setCurrentKeyword] = useState('')
  const [regions, setRegions] = useState<string[]>([])
  const [scoreWeights, setScoreWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS)
  const [scoreNarrative, setScoreNarrative] = useState('')
  const [showScoreSettings, setShowScoreSettings] = useState(false)
  const [guidanceEntries, setGuidanceEntries] = useState<GuidanceEntry[]>([])
  const [activePlatform, setActivePlatform] = useState<PlatformId>('youtube')
  const seenChannelIds = useRef<Set<string>>(new Set())

  // Auth + profile
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [hasBackup, setHasBackup] = useState(false)
  // Manual migration prompt state
  const [pendingMigration, setPendingMigration] = useState<{ outreach: number; dismissed: number } | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showImportDismissed, setShowImportDismissed] = useState(false)

  // Derive the active platform config
  const platformConfig = PLATFORM_CONFIGS.find(p => p.id === activePlatform)!

  // Auto-inject a locked guidance entry for the active platform (not stored in state)
  const platformEntry: GuidanceEntry | null = useMemo(() => {
    if (!platformConfig.condition) return null
    return {
      id: PLATFORM_LOCK_ID,
      text: platformConfig.label,
      timestamp: 0,
      rules: [{ condition: platformConfig.condition, points: 10, label: platformConfig.chipLabel }],
      summary: `Creator is active on ${platformConfig.label}`,
      weight: platformConfig.chipWeight,
    }
  }, [platformConfig])

  // Effective entries = platform lock (if any) + user chips
  const effectiveGuidanceEntries = useMemo(
    () => platformEntry ? [platformEntry, ...guidanceEntries] : guidanceEntries,
    [platformEntry, guidanceEntries]
  )

  // Effective col config: bring the platform's column to the front and ensure it's visible
  const effectiveColConfig = useMemo(() => {
    const isYouTube = platformConfig.id === 'youtube'
    // For non-YouTube platforms: hide YouTube-only metrics, show & front-load the platform column
    let cols = colConfig.map(c => {
      if (!isYouTube && (c.id === 'avgViews' || c.id === 'subscribers' || c.id === 'lastPosted')) {
        return { ...c, visible: false }
      }
      if (platformConfig.column && c.id === platformConfig.column) {
        return { ...c, visible: true }
      }
      return c
    })
    if (platformConfig.column) {
      const idx = cols.findIndex(c => c.id === platformConfig.column)
      if (idx > 0) {
        const [moved] = cols.splice(idx, 1)
        cols.unshift(moved)
      }
    }
    return cols
  }, [colConfig, platformConfig])

  // search version ref — prevents stale searches from overwriting newer ones
  const searchVersion = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setSuggestions(pickRandom(ALL_OCCUPATIONS, 25))
    ;(async () => {
      // Resolve session + profile, decide whether to show onboarding
      const supabase = createSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      console.log('[home-init] user:', user?.id, user?.email)
      if (user) {
        setUserId(user.id)
        setUserEmail(user.email ?? null)

        // Use maybeSingle so missing row returns null instead of erroring
        let { data: profileRow, error: profileErr } = await supabase
          .from('user_profile')
          .select('full_name, linkedin_url, pitch_line, onboarded')
          .eq('user_id', user.id)
          .maybeSingle()
        console.log('[home-init] profile row:', profileRow, 'error:', profileErr?.message)

        // Defensive: if no profile row exists (trigger may have failed),
        // create one ourselves before continuing.
        if (!profileRow) {
          console.warn('[home-init] no profile row, creating one')
          const { data: inserted } = await supabase
            .from('user_profile')
            .insert({ user_id: user.id, email: user.email ?? '', onboarded: false })
            .select('full_name, linkedin_url, pitch_line, onboarded')
            .single()
          profileRow = inserted
        }

        if (profileRow) {
          setProfile({
            fullName: profileRow.full_name ?? '',
            linkedinUrl: profileRow.linkedin_url ?? '',
            pitchLine: profileRow.pitch_line ?? '',
          })
          if (!profileRow.onboarded) {
            console.log('[home-init] onboarded=false → showing modal')
            setShowOnboarding(true)
          } else {
            console.log('[home-init] onboarded=true → skipping modal')
          }
        }
      }

      // Check if there's localStorage data waiting to be imported. If so,
      // show the manual migration prompt — never auto-migrate so the user
      // always sees what's happening.
      const pending = getPendingMigrationCounts()
      if (pending.hasAny && !getMigrationSkipped()) {
        setPendingMigration({ outreach: pending.outreach, dismissed: pending.dismissed })
      }
      // The "Retry data migration" item in the hamburger menu shows up when
      // a backup blob exists (created the first time we run a migration).
      setHasBackup(hasMigrationBackup())

      const storedOutreach = await getOutreach()
      setOutreach(storedOutreach)
      setOutreachIds(new Set(storedOutreach.map(e => e.channelId)))

      const storedOutreachCols = await getOutreachColConfig()
      if (storedOutreachCols) {
        // merge stored config with any new columns added since last save
        const merged = ALL_OUTREACH_COLS.map(def => {
          const stored = storedOutreachCols.find(s => s.id === def.id)
          return stored ? { ...def, visible: stored.visible, width: stored.width } : { ...def, visible: def.defaultVisible, width: def.defaultWidth }
        })
        setOutreachColConfig(merged)
        setDraftOutreachCols(merged)
      }

      const storedMetrics = await getCustomMetrics()
      setCustomMetrics(storedMetrics)

      const storedDismissed = await getDismissed()
      setDismissed(storedDismissed)
      setDismissedIds(new Set(storedDismissed.map(c => c.channelId)))

      const { weights: w0, narrative: n0, guidance: g0 } = await loadPlatformState('youtube')
      setScoreWeights(w0)
      setScoreNarrative(n0)
      setGuidanceEntries(g0)
    })()
  }, [])

  // elapsed timer while loading
  useEffect(() => {
    if (loading) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loading])

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function saveOutreach(updated: OutreachEntry[]) {
    setOutreach(updated)
    setOutreachIds(new Set(updated.map(e => e.channelId)))
    void persistOutreach(updated)
  }

  function addGuidanceEntry(entry: GuidanceEntry) {
    setGuidanceEntries(prev => {
      const updated = [...prev, entry]
      void savePlatformGuidance(activePlatform, updated)
      return updated
    })
  }

  function removeGuidanceEntry(id: string) {
    setGuidanceEntries(prev => {
      const updated = prev.filter(e => e.id !== id)
      void savePlatformGuidance(activePlatform, updated)
      return updated
    })
  }

  function updateGuidanceEntryWeight(id: string, weight: number) {
    setGuidanceEntries(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, weight } : e)
      void savePlatformGuidance(activePlatform, updated)
      return updated
    })
  }

  function resetAllGuidance() {
    setGuidanceEntries([])
    void clearPlatformGuidance(activePlatform)
  }

  function addToOutreach(c: Creator) {
    if (outreachIds.has(c.channelId)) {
      removeOutreachEntry(outreach.find(e => e.channelId === c.channelId)?.id || '')
      return
    }
    const entry: OutreachEntry = {
      id: `${c.channelId}-${Date.now()}`,
      channelId: c.channelId,
      channelName: c.channelName,
      channelUrl: c.channelUrl,
      description: c.description || '',
      email: c.email || '',
      product: '',
      favorite: false,
      reachedOut: false,
      medium: '',
      mediumOther: '',
      headerUsed: '',
      status: 'Not Outreached',
      addedAt: Date.now(),
      notes: '',
      followUpDate: '',
      dateReachedOut: '',
      touchpoints: '',
      responseDate: '',
      subscribers: c.subscribers || '',
      avgViews: c.avgViews || 0,
      fitScore: computeFitScore(c, scoreWeights, effectiveGuidanceEntries),
      linkedin: c.linkedin || '',
      contentNiche: '',
      phone: '',
      dealValue: '',
      contractSent: false,
      meetingScheduled: '',
    }
    saveOutreach([...outreach, entry])
  }

  function reorderResultCols(newConfig: ColConfig[]) {
    setColConfig(newConfig)
    setDraftCols(newConfig)
    void saveColConfig(newConfig)
  }

  function reorderOutreachCols(newConfig: OutreachColConfig[]) {
    setOutreachColConfig(newConfig)
    setDraftOutreachCols(newConfig)
    void saveOutreachColConfig(newConfig)
  }

  function updateOutreachEntry(id: string, field: keyof OutreachEntry, value: any) {
    saveOutreach(outreach.map(e => {
      if (e.id !== id) return e
      const updated = { ...e, [field]: value }

      if (field === 'status') {
        // Celebrate first-time conversions, lighter feedback for other transitions.
        if (value === 'Successful' && e.status !== 'Successful') {
          celebrateSuccess()
          toast.success(`🎉 ${e.channelName} converted!`, { description: 'Marked as Successful' })
        } else if (value === 'Rejected' && e.status !== 'Rejected') {
          toast(`${e.channelName} marked as Rejected`, { description: 'Removed from active queue' })
        } else if (value === 'No Response' && e.status !== 'No Response') {
          toast(`${e.channelName} ghosted`, { description: 'Moved to No Response' })
        }

        // Status drives reachedOut: anything past "Not Outreached" / "" counts.
        updated.reachedOut = value !== 'Not Outreached' && value !== ''

        const isActive = value === 'Open' || value === 'No Response'
        const isTerminal = value === 'Successful' || value === 'Rejected' || value === 'Not Outreached'

        if (isActive) {
          // First time the user actually reaches out → log the date + 1st touchpoint
          if (e.status === 'Not Outreached' || e.status === '') {
            if (!e.dateReachedOut) updated.dateReachedOut = todayIso()
            const tps = parseInt(e.touchpoints || '0', 10) || 0
            if (tps === 0) updated.touchpoints = '1'
          }

          // Apply follow-up cadence: shorter early, longer later.
          // Only auto-fills when the user hasn't set a date — manual dates win.
          // Re-engagement of an overdue No-Response lead also gets a fresh date.
          const existing = parseLocalDate(e.followUpDate)
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const isPastDue = existing && existing.getTime() < today.getTime()
          if (!e.followUpDate || isPastDue) {
            const tps = parseInt(updated.touchpoints || e.touchpoints || '0', 10) || 1
            updated.followUpDate = isoDaysFromNow(nextFollowUpDays(tps))
          }
        }

        if (isTerminal) {
          // Done with this lead — drop them out of the follow-up queue.
          updated.followUpDate = ''
          if (value === 'Successful' || value === 'Rejected') {
            // Stamp response date when there isn't one already.
            if (!e.responseDate) updated.responseDate = todayIso()
          }
        }
      }

      return updated
    }))
  }

  const [searchingContactIds, setSearchingContactIds] = useState<Set<string>>(new Set())
  const [outreachBulkRunning, setOutreachBulkRunning] = useState(false)
  const [resultsBulkRunning, setResultsBulkRunning] = useState(false)

  async function seedTestData() {
    if (!confirm('Add ~100 real creators to your Outreach with random statuses + dates? This calls the real /api/search endpoint. Cleanup later by deleting rows where notes = "[seed]".')) return
    const keywords = ['fitness coach', 'cooking', 'gardening', 'tech founder', 'travel vlogger', 'gaming', 'finance content creator', 'photography']
    const seedToastId = toast.loading(`Seeding 0 / ~100 creators…`, { duration: 120_000 })
    let added = 0
    const newEntries: OutreachEntry[] = []
    const seenIds = new Set<string>(outreach.map(o => o.channelId))
    const now = Date.now()

    for (const kw of keywords) {
      try {
        const url = `/api/search?keyword=${encodeURIComponent(kw)}&maxResults=15&minViews=0&maxViews=999999999`
        console.log('[seedTestData] fetching', url)
        const r = await fetch(url)
        if (!r.ok) {
          const errText = await r.text().catch(() => '')
          console.warn('[seedTestData] search failed', kw, r.status, errText)
          toast.warning(`Search "${kw}" failed: ${r.status}`)
          continue
        }
        const data = await r.json()
        const channels = (data.channels || []) as Creator[]
        console.log('[seedTestData] keyword', kw, 'returned', channels.length, 'channels')
        if (channels.length === 0) {
          toast.warning(`No results for "${kw}"`)
          continue
        }
        for (const c of channels.slice(0, 14)) {
          if (seenIds.has(c.channelId) || added >= 100) continue
          seenIds.add(c.channelId)

          // Distribute statuses + dates randomly with realistic spread
          const r1 = Math.random()
          const status: OutreachEntry['status'] =
            r1 < 0.15 ? 'Not Outreached' :
            r1 < 0.45 ? 'Open' :
            r1 < 0.70 ? 'No Response' :
            r1 < 0.85 ? 'Successful' : 'Rejected'

          const tps = status === 'Not Outreached' ? 0 : Math.min(5, Math.floor(Math.random() * 6))
          const reachedDaysAgo = Math.floor(Math.random() * 90)
          const dateReachedOut = status === 'Not Outreached' ? '' : isoDaysFromNow(-reachedDaysAgo)

          let followUpDate = ''
          if (status === 'Open') {
            const r2 = Math.random()
            if (r2 < 0.20) followUpDate = isoDaysFromNow(-(1 + Math.floor(Math.random() * 10)))
            else if (r2 < 0.30) followUpDate = todayIso()
            else if (r2 < 0.65) followUpDate = isoDaysFromNow(1 + Math.floor(Math.random() * 7))
            else followUpDate = isoDaysFromNow(8 + Math.floor(Math.random() * 30))
          } else if (status === 'No Response') {
            followUpDate = Math.random() < 0.5
              ? isoDaysFromNow(-(1 + Math.floor(Math.random() * 14)))
              : isoDaysFromNow(1 + Math.floor(Math.random() * 14))
          }
          const responseDate = (status === 'Successful' || status === 'Rejected')
            ? isoDaysFromNow(-Math.floor(Math.random() * 30)) : ''

          const dealValue = Math.random() > 0.70 ? `$${200 + Math.floor(Math.random() * 4800)}` : ''
          const medium: OutreachEntry['medium'] = (() => {
            const r3 = Math.random()
            return r3 < 0.50 ? 'Email' : r3 < 0.80 ? 'LinkedIn' : r3 < 0.90 ? 'Other' : ''
          })()

          newEntries.push({
            id: `${c.channelId}-seed-${now + added}`,
            channelId: c.channelId,
            channelName: c.channelName,
            channelUrl: c.channelUrl,
            description: c.description || '',
            email: c.email || '',
            product: '',
            favorite: Math.random() < 0.20,
            reachedOut: status !== 'Not Outreached',
            medium,
            mediumOther: '',
            headerUsed: status === 'Not Outreached' ? '' : 'Quick question about your channel',
            status,
            addedAt: now - Math.floor(Math.random() * 120 * 86400000),
            notes: '[seed]',
            followUpDate,
            dateReachedOut,
            touchpoints: tps === 0 ? '' : String(tps),
            responseDate,
            subscribers: c.subscribers || '',
            avgViews: c.avgViews || 0,
            fitScore: 50 + Math.floor(Math.random() * 50),
            linkedin: c.linkedin || '',
            contentNiche: kw,
            phone: '',
            dealValue,
            contractSent: status === 'Successful' && !!dealValue,
            meetingScheduled: '',
          })
          added++
        }
        toast.loading(`Seeding ${added} / ~100 creators…`, { id: seedToastId, duration: 120_000 })
      } catch (err: any) {
        console.warn('[seedTestData] keyword failed:', kw, err)
        toast.warning(`"${kw}" errored: ${err?.message || err}`)
      }
      if (added >= 100) break
    }

    toast.dismiss(seedToastId)
    if (newEntries.length === 0) {
      toast.error('No creators added — every search returned 0 or failed. Check console.')
      return
    }
    try {
      const merged = [...newEntries, ...outreach]
      await persistOutreach(merged)
      const fresh = await getOutreach()
      setOutreach(fresh)
      setOutreachIds(new Set(fresh.map(e => e.channelId)))
      toast.success(`Seeded ${newEntries.length} real creators 🎉`, { description: 'Refreshing your queue. Cleanup later by deleting rows where notes="[seed]".' })
    } catch (err: any) {
      console.error('[seedTestData] persist failed', err)
      toast.error(`Persist failed: ${err?.message || err}`)
    }
  }

  async function deepSearchAllOutreach() {
    const targets = outreach.filter(e => !e.email).map(e => e.id)
    if (targets.length === 0 || outreachBulkRunning) return
    setOutreachBulkRunning(true)
    try {
      const CONCURRENCY = 3
      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        await Promise.all(targets.slice(i, i + CONCURRENCY).map(id => searchContactsForEntry(id)))
      }
    } finally {
      setOutreachBulkRunning(false)
    }
  }

  async function deepSearchAllResults() {
    const targets = creators.filter(c => !c.email && !c.enriching).map(c => c.channelId)
    if (targets.length === 0 || resultsBulkRunning) return
    setResultsBulkRunning(true)
    try {
      const CONCURRENCY = 3
      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        await Promise.all(targets.slice(i, i + CONCURRENCY).map(id => deepSearchResultEmail(id)))
      }
    } finally {
      setResultsBulkRunning(false)
    }
  }
  const [deepSearchingResultIds, setDeepSearchingResultIds] = useState<Set<string>>(new Set())

  async function deepSearchResultEmail(channelId: string) {
    const c = creators.find(x => x.channelId === channelId)
    if (!c) return
    setDeepSearchingResultIds(s => new Set(s).add(channelId))
    try {
      const params = new URLSearchParams({
        name: c.channelName,
        channelId: c.channelId,
        description: c.description || '',
        website: c.website || '',
        instagram: c.instagram || '',
        tiktok: c.tiktok || '',
        aggressive: 'true',
      })
      const r = await fetch(`/api/enrich?${params}`)
      const extra = await r.json()
      if (!r.ok) {
        toast.error(`Search failed: ${extra.error || 'unknown'}`)
        return
      }
      setCreators(list => list.map(x => x.channelId === channelId ? {
        ...x,
        email: x.email || extra.email || '',
        linkedin: x.linkedin || extra.linkedin || '',
        instagram: x.instagram || extra.instagram || '',
        twitter: x.twitter || extra.twitter || '',
        tiktok: x.tiktok || extra.tiktok || '',
        website: x.website || extra.website || '',
        subscribers: x.subscribers || extra.subscribers || '',
        avgViews: x.avgViews || (extra.avgViews && !isNaN(extra.avgViews) ? extra.avgViews : 0),
      } : x))
    } catch (err: any) {
      toast.error(`Search failed: ${err?.message || err}`)
    } finally {
      setDeepSearchingResultIds(s => { const n = new Set(s); n.delete(channelId); return n })
    }
  }

  async function searchContactsForEntry(id: string) {
    const entry = outreach.find(e => e.id === id)
    if (!entry) return
    setSearchingContactIds(s => new Set(s).add(id))
    try {
      const params = new URLSearchParams({
        name: entry.channelName,
        channelId: entry.channelId,
        description: entry.description || '',
        aggressive: 'true',
      })
      const r = await fetch(`/api/enrich?${params}`)
      const extra = await r.json()
      if (!r.ok) {
        toast.error(`Search failed: ${extra.error || 'unknown'}`)
        return
      }
      saveOutreach(outreach.map(e => {
        if (e.id !== id) return e
        // Only fill in fields that are currently empty so we don't overwrite
        // anything the user has manually entered.
        return {
          ...e,
          email: e.email || extra.email || '',
          linkedin: e.linkedin || extra.linkedin || '',
          subscribers: e.subscribers || extra.subscribers || '',
          avgViews: e.avgViews || (extra.avgViews && !isNaN(extra.avgViews) ? extra.avgViews : 0),
        }
      }))
      if (!extra.email) {
        // Subtle feedback when search returned nothing useful — non-blocking.
        console.log('[searchContacts] no email found for', entry.channelName)
      }
    } catch (err: any) {
      toast.error(`Search failed: ${err?.message || err}`)
    } finally {
      setSearchingContactIds(s => {
        const next = new Set(s); next.delete(id); return next
      })
    }
  }

  function removeOutreachEntry(id: string) {
    saveOutreach(outreach.filter(e => e.id !== id))
  }

  function saveDismissed(updated: Creator[]) {
    setDismissed(updated)
    setDismissedIds(new Set(updated.map(c => c.channelId)))
    void persistDismissed(updated)
  }

  function dismissCreator(c: Creator) {
    if (!dismissedIds.has(c.channelId)) saveDismissed([...dismissed, c])
    // also remove from load-more batch so it disappears immediately
    setLoadMoreCreators(prev => prev.filter(p => p.channelId !== c.channelId))
    setCreators(prev => prev.filter(p => p.channelId !== c.channelId))
  }

  function undismissCreator(id: string) {
    saveDismissed(dismissed.filter(c => c.channelId !== id))
  }

  const runSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) return
    const version = ++searchVersion.current
    setLoading(true)
    setCreators([])
    setLoadMoreCreators([])
    setCurrentKeyword(kw)
    seenChannelIds.current = new Set()
    setEnrichProgress({ current: 0, total: 0 })
    setActiveTab('results')

    // If the input looks like a YouTube URL, treat it as a direct channel lookup.
    const trimmed = kw.trim()
    const looksLikeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(trimmed)
    if (looksLikeUrl) {
      setStatus('Resolving channel from URL...')
      try {
        const r = await fetch(`/api/lookup-channel?url=${encodeURIComponent(trimmed)}`)
        const lookup = await r.json()
        if (version !== searchVersion.current) return
        if (!r.ok || !lookup.channelId) {
          setStatus(`Could not resolve channel: ${lookup.error || 'unknown'}`)
          return
        }
        if (dismissedIds.has(lookup.channelId) || outreachIds.has(lookup.channelId)) {
          setStatus('That channel is already in your outreach or dismissed list.')
          return
        }
        seenChannelIds.current.add(lookup.channelId)
        const baseCreator: Creator = {
          channelId: lookup.channelId,
          channelName: lookup.channelName || '',
          channelUrl: lookup.channelUrl,
          avgViews: 0,
          subscribers: '',
          email: '',
          website: '',
          linkedin: '',
          twitter: '',
          instagram: '',
          tiktok: '',
          company: '',
          matchedVia: 'url',
          videoTitles: [],
          videoDates: [],
          description: lookup.description || '',
          enriching: true,
        }
        setCreators([baseCreator])
        setEnrichProgress({ current: 0, total: 1 })
        setStatus('Channel found. Enriching contact info...')
        try {
          const params = new URLSearchParams({
            name: baseCreator.channelName, channelId: baseCreator.channelId,
            description: baseCreator.description,
          })
          const er = await fetch(`/api/enrich?${params}`)
          const extra = await er.json()
          if (version !== searchVersion.current) return
          setCreators([{
            ...baseCreator,
            enriching: false,
            email: extra.email || '',
            subscribers: extra.subscribers || '',
            videoDates: extra.videoDates || [],
            avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : 0,
            linkedin: extra.linkedin || '',
            instagram: extra.instagram || '',
            twitter: extra.twitter || '',
            tiktok: extra.tiktok || '',
            website: extra.website || '',
          }])
          setEnrichProgress({ current: 1, total: 1 })
          setStatus('Done. Click + to add to Outreach.')
        } catch {
          setCreators([{ ...baseCreator, enriching: false }])
          setStatus('Done (could not fetch extra contact info).')
        }
      } catch (err: any) {
        setStatus(`Lookup failed: ${err?.message || err}`)
      } finally {
        setLoading(false)
      }
      return
    }

    setStatus('Searching YouTube...')

    try {
      const regionCodes = regions.length > 0 ? regions : ['']
      const allResponses = await Promise.all(
        regionCodes.map(code => {
          const glParam = code ? `&gl=${encodeURIComponent(code)}` : ''
          return fetch(`/api/search?keyword=${encodeURIComponent(kw)}&maxResults=${maxResults}&minViews=${minViews}&maxViews=${maxViews}${glParam}`).then(r => r.json())
        })
      )
      if (version !== searchVersion.current) return  // superseded by newer search
      const firstError = allResponses.find(d => d.error)
      if (firstError) { setStatus(`Error: ${firstError.error}`); return }
      // merge and deduplicate by channelId
      const seenMerge = new Set<string>()
      const data = { channels: allResponses.flatMap(d => (d.channels as Creator[]) || []).filter(c => { if (seenMerge.has(c.channelId)) return false; seenMerge.add(c.channelId); return true }) }

      // Track all returned channel IDs so Load More skips them
      ;(data.channels as Creator[]).forEach((c: Creator) => seenChannelIds.current.add(c.channelId))

      // Filter out dismissed and already-outreached channels from results
      const visible = (data.channels as Creator[]).filter(
        (c: Creator) => !dismissedIds.has(c.channelId) && !outreachIds.has(c.channelId)
      )

      const enriched = visible.map(c => ({ ...c, enriching: true }))
      setCreators([...enriched])
      setEnrichProgress({ current: 0, total: enriched.length })
      setStatus(`Found ${enriched.length} creators. Enriching contact info...`)

      const BATCH = 10
      for (let i = 0; i < enriched.length; i += BATCH) {
        if (version !== searchVersion.current) return
        const batchIndices = Array.from({ length: Math.min(BATCH, enriched.length - i) }, (_, k) => i + k)
        await Promise.all(batchIndices.map(async (idx) => {
          const c = enriched[idx]
          try {
            const params = new URLSearchParams({
              name: c.channelName, channelId: c.channelId,
              website: c.website || '', instagram: c.instagram || '',
              tiktok: c.tiktok || '', description: c.description || '',
            })
            const r = await fetch(`/api/enrich?${params}`)
            const extra = await r.json()
            enriched[idx] = {
              ...c, enriching: false,
              email: c.email || extra.email || '',
              subscribers: c.subscribers || extra.subscribers || '',
              videoDates: (extra.videoDates?.length ? extra.videoDates : c.videoDates) || [],
              avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : c.avgViews,
              linkedin: c.linkedin || extra.linkedin || '',
              instagram: c.instagram || extra.instagram || '',
              twitter: c.twitter || extra.twitter || '',
              tiktok: c.tiktok || extra.tiktok || '',
              website: c.website || extra.website || '',
            }
          } catch {
            enriched[idx] = { ...c, enriching: false }
          }
        }))
        if (version === searchVersion.current) {
          setEnrichProgress({ current: Math.min(i + BATCH, enriched.length), total: enriched.length })
          setCreators([...enriched])
        }
      }
      if (version === searchVersion.current) setStatus(`Done — ${enriched.length} creators found.`)
    } catch (err: any) {
      if (version === searchVersion.current) setStatus(`Error: ${err.message}`)
    } finally {
      if (version === searchVersion.current) setLoading(false)
    }
  }, [minViews, maxViews, maxResults, regions, dismissedIds, outreachIds])

  async function handleSearch() { await runSearch(keyword) }

  const handleLoadMore = useCallback(async () => {
    if (!currentKeyword || loadingMore || loading) return
    setLoadingMore(true)
    try {
      const regionCodes = regions.length > 0 ? regions : ['']
      const allResponses = await Promise.all(
        regionCodes.map(code => {
          const glParam = code ? `&gl=${encodeURIComponent(code)}` : ''
          return fetch(`/api/search?keyword=${encodeURIComponent(currentKeyword)}&maxResults=${maxResults}&minViews=${minViews}&maxViews=${maxViews}${glParam}`).then(r => r.json())
        })
      )
      if (allResponses.some(d => d.error)) return
      const seenMerge = new Set<string>()
      const data = { channels: allResponses.flatMap(d => (d.channels as Creator[]) || []).filter(c => { if (seenMerge.has(c.channelId)) return false; seenMerge.add(c.channelId); return true }) }

      // Filter: skip already seen, dismissed, outreached
      const fresh = (data.channels as Creator[]).filter(
        c => !seenChannelIds.current.has(c.channelId)
          && !dismissedIds.has(c.channelId)
          && !outreachIds.has(c.channelId)
      )
      // Track all returned channels as seen (for future Load More calls)
      ;(data.channels as Creator[]).forEach(c => seenChannelIds.current.add(c.channelId))

      if (fresh.length === 0) return

      // Show batch immediately with enriching spinners, pre-sorted email-first
      const batch = fresh.map(c => ({ ...c, enriching: true }))
      const preSorted = [...batch].sort((a, b) => {
        const ae = a.email ? 1 : 0, be = b.email ? 1 : 0
        return be - ae
      })
      setLoadMoreCreators(prev => [...prev, ...preSorted])

      // Enrich in parallel batches
      const enriched = [...batch]
      const BATCH = 10
      for (let i = 0; i < enriched.length; i += BATCH) {
        const idxs = Array.from({ length: Math.min(BATCH, enriched.length - i) }, (_, k) => i + k)
        await Promise.all(idxs.map(async (idx) => {
          const c = enriched[idx]
          try {
            const params = new URLSearchParams({
              name: c.channelName, channelId: c.channelId,
              website: c.website || '', instagram: c.instagram || '',
              tiktok: c.tiktok || '', description: c.description || '',
            })
            const r = await fetch(`/api/enrich?${params}`)
            const extra = await r.json()
            enriched[idx] = {
              ...c, enriching: false,
              email: c.email || extra.email || '',
              subscribers: c.subscribers || extra.subscribers || '',
              videoDates: (extra.videoDates?.length ? extra.videoDates : c.videoDates) || [],
              avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : c.avgViews,
              linkedin: c.linkedin || extra.linkedin || '',
              instagram: c.instagram || extra.instagram || '',
              twitter: c.twitter || extra.twitter || '',
              tiktok: c.tiktok || extra.tiktok || '',
              website: c.website || extra.website || '',
            }
          } catch { enriched[idx] = { ...c, enriching: false } }
        }))
        // Re-sort after each enrichment batch: email-havers first, then fitScore desc
        const reSorted = [...enriched].sort((a, b) => {
          const ae = a.email ? 1 : 0, be = b.email ? 1 : 0
          if (ae !== be) return be - ae
          return computeFitScore(b, scoreWeights, effectiveGuidanceEntries) - computeFitScore(a, scoreWeights, effectiveGuidanceEntries)
        })
        setLoadMoreCreators(prev => {
          const keep = prev.slice(0, prev.length - batch.length)
          return [...keep, ...reSorted]
        })
      }
    } catch { /* ignore */ }
    finally { setLoadingMore(false) }
  }, [currentKeyword, loadingMore, loading, minViews, maxViews, maxResults, regions, dismissedIds, outreachIds])

  async function handleExportExcel(list: Creator[]) {
    setShowExport(false)
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: list }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'creators.xlsx'
    a.click()
  }

  function handleExportCSV(list: Creator[]) {
    setShowExport(false)
    const headers = ['Channel Name', 'YouTube URL', 'Avg Views', 'Subscribers', 'Last Posted', 'Email', 'LinkedIn', 'Website', 'Instagram', 'X', 'TikTok']
    const rows = list.map(c => [
      c.channelName, c.channelUrl, c.avgViews, formatSubscribers(c.subscribers),
      c.videoDates?.[0] || '', c.email, c.linkedin, c.website, c.instagram, c.twitter, c.tiktok,
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'creators.csv'
    a.click()
  }

  async function handleExportOutreachExcel() {
    setShowExport(false)
    const res = await fetch('/api/export-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: outreach }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'outreach.xlsx'
    a.click()
  }

  function handleExportOutreachCSV() {
    setShowExport(false)
    const headers = ['Channel Name', 'YT', 'Email', 'Description', 'Product', 'Reached Out', 'Medium', 'Subject Line', 'Status']
    const rows = outreach.map(e => [
      e.channelName, e.channelUrl, e.email, e.description, e.product,
      e.reachedOut ? 'Yes' : 'No',
      e.medium === 'Other' ? e.mediumOther : e.medium,
      e.headerUsed,
      e.status || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'outreach.csv'
    a.click()
  }

  const baseList = creators
  const currentList = baseList
    .filter(c => c.avgViews >= minViews && c.avgViews <= maxViews)
    .filter(c => maxAgeDays === Infinity || parseRelativeDays(c.videoDates?.[0] || '') <= maxAgeDays)
    .filter(c => !emailOnly || !!c.email)
    .filter(c => {
      if (activePlatform === 'youtube') return true
      if (activePlatform === 'instagram') return !!c.instagram
      if (activePlatform === 'tiktok') return !!c.tiktok
      if (activePlatform === 'twitter') return !!c.twitter
      if (activePlatform === 'linkedin') return !!c.linkedin
      return true
    })
  const progressPct = enrichProgress.total > 0 ? Math.round((enrichProgress.current / enrichProgress.total) * 100) : 0

  return (
    <GuidanceContext.Provider value={{ entries: effectiveGuidanceEntries, addEntry: addGuidanceEntry, removeEntry: removeGuidanceEntry, updateEntryWeight: updateGuidanceEntryWeight, resetAll: resetAllGuidance }}>
    <main className="min-h-screen bg-background text-foreground">
      {/* Sticky glass top bar — same width-feel as the page below */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className={`${activeTab === 'outreach' ? 'w-full px-6' : 'max-w-7xl mx-auto px-8'} py-5`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent leading-none">Creator Outreach</h1>
              <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground leading-none">
                <span className="leading-none">Find</span>
                <PlatformDropdown activePlatform={activePlatform} onChange={async (newPlatform) => {
                  void savePlatformWeights(activePlatform, scoreWeights)
                  void savePlatformNarrative(activePlatform, scoreNarrative)
                  void savePlatformGuidance(activePlatform, guidanceEntries)
                  const { weights, narrative, guidance } = await loadPlatformState(newPlatform)
                  setScoreWeights(weights)
                  setScoreNarrative(narrative)
                  setGuidanceEntries(guidance)
                  setActivePlatform(newPlatform)
                }} />
                <span className="leading-none">creators</span>
              </div>
            </div>
            <HamburgerMenu
              userEmail={userEmail}
              userFullName={profile?.fullName || null}
              onOpenScoreSettings={() => setShowScoreSettings(true)}
              onOpenProfile={() => setShowProfile(true)}
              onImportOutreach={() => setShowImport(true)}
              onImportDismissed={() => setShowImportDismissed(true)}
              showRetryMigration={hasBackup}
              onRetryMigration={async () => {
                const result = await retryMigrationFromBackup()
                alert(result.ok ? `✓ ${result.message} Refreshing…` : `Migration retry failed: ${result.message}`)
                if (result.ok) window.location.reload()
              }}
              onSeedTestData={seedTestData}
            />
          </div>
        </div>
      </div>

      <div className={`${activeTab === 'outreach' ? 'w-full px-6' : 'max-w-7xl mx-auto px-8'} pt-6 pb-16`}>

        {/* Premium search bar */}
        <div className="flex gap-2 mb-2 flex-wrap">
          <div className="flex-1 min-w-64 relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-muted-foreground group-focus-within:text-purple-700 dark:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              className="w-full bg-card/60 border border-border rounded-lg pl-9 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/15 transition-all"
              placeholder="Search a topic, paste a YouTube URL, or describe what you're looking for…"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          {/* Score settings icon */}
          <button
            onClick={() => setShowScoreSettings(true)}
            title="Lead Criteria"
            className={`px-3 py-2.5 rounded-lg border transition-all flex items-center gap-1.5 ${JSON.stringify(scoreWeights) !== JSON.stringify(DEFAULT_WEIGHTS) || scoreNarrative || effectiveGuidanceEntries.length > 0 ? 'bg-gradient-to-br from-purple-600 to-purple-700 border-purple-500/60 text-white shadow-md shadow-purple-500/20' : 'bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
          >
            <span className="text-sm">⚡</span>
          </button>
          {/* Filter icon */}
          <button
            onClick={() => setShowFilter(v => !v)}
            title={regions.length === 0 ? 'Filters — English-language search (no regional filter)' : regions.length === REGIONS.length ? 'Filters — Global (all regions)' : `Filters — searching: ${regions.map(code => REGIONS.find(r => r.code === code)?.label).join(', ')}`}
            className={`px-3 py-2.5 rounded-lg border transition-all flex items-center gap-1.5 ${showFilter || regions.length > 0 ? 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500/60 text-white shadow-md shadow-blue-500/20' : 'bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {regions.length > 0 && (
              <span className="text-xs flex gap-px">
                {regions.length === REGIONS.length
                  ? '🌐'
                  : <>
                    {regions.slice(0, 3).map(code => REGIONS.find(r => r.code === code)?.flag).join('')}
                    {regions.length > 3 && <span className="text-[10px] font-bold">+{regions.length - 3}</span>}
                  </>
                }
              </span>
            )}
          </button>
          <button onClick={handleSearch} disabled={loading} className="relative bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-lg font-semibold text-white shadow-md shadow-purple-500/20 transition-all hover:shadow-lg hover:shadow-purple-500/30 overflow-hidden">
            <span className="relative z-10">{loading ? 'Searching...' : 'Search'}</span>
            <span className="absolute inset-0 shimmer-bg rounded-lg pointer-events-none" aria-hidden />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExport(v => !v)}
              disabled={activeTab === 'outreach' ? outreach.length === 0 : activeTab === 'dismissed' ? true : currentList.length === 0}
              title="Export"
              className="bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2.5 rounded-lg flex items-center text-white shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            {showExport && (
              <div className="absolute right-0 mt-1 w-48 bg-muted border border-border rounded shadow-lg z-10">
                {activeTab === 'outreach' ? <>
                  <button onClick={handleExportOutreachExcel} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2">
                    📊 Excel (.xlsx)
                  </button>
                  <button onClick={handleExportOutreachCSV} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2">
                    📄 CSV (Google Sheets)
                  </button>
                </> : <>
                  <button onClick={() => handleExportExcel(currentList)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2">
                    📊 Excel (.xlsx)
                  </button>
                  <button onClick={() => handleExportCSV(currentList)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2">
                    📄 CSV (Google Sheets)
                  </button>
                </>}
              </div>
            )}
          </div>
        </div>

        {/* Filter panel — hidden by default */}
        {showFilter && (
          <div className="flex flex-col gap-3 mb-3 p-4 bg-card border border-border rounded-xl shadow-sm shadow-black/5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Avg views:</span>
              <input type="number" min={0} value={minViews}
                onChange={e => setMinViews(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-muted border border-border rounded px-3 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500"
                placeholder="Min" />
              <span className="text-muted-foreground/70 text-xs">to</span>
              <input type="number" min={0} value={maxViews}
                onChange={e => setMaxViews(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-muted border border-border rounded px-3 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500"
                placeholder="Max" />
              <span className="text-muted-foreground/70 text-xs">|</span>
              {VIEW_PRESETS.map(p => (
                <button key={p.label} onClick={() => { setMinViews(p.min); setMaxViews(p.max) }}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${minViews === p.min && maxViews === p.max ? 'bg-blue-600 border-blue-500 text-foreground' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-border pt-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Last posted:</span>
              {[
                { label: 'Last 7 days', days: 7 },
                { label: 'Last 30 days', days: 30 },
                { label: 'Last 90 days', days: 90 },
                { label: 'Last 6 months', days: 180 },
                { label: 'Any time', days: Infinity },
              ].map(p => (
                <button key={p.label} onClick={() => setMaxAgeDays(p.days)}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${maxAgeDays === p.days ? 'bg-blue-600 border-blue-500 text-foreground' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-border pt-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Show only:</span>
              <button
                onClick={() => setEmailOnly(v => !v)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${emailOnly ? 'bg-blue-600 border-blue-500 text-foreground' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
              >
                Has email
              </button>
            </div>
            <div className="flex items-start gap-3 flex-wrap border-t border-border pt-3">
              <div className="flex flex-col w-20 shrink-0 mt-1 gap-0.5">
                <span className="text-xs text-muted-foreground">Region:</span>
                <span className="text-[10px] text-muted-foreground/70 leading-snug">Pick countries or go Global for all</span>
              </div>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {/* English = no region filter (default) */}
                <button
                  onClick={() => setRegions([])}
                  title="No regional filter — English-language creators only"
                  className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.length === 0 ? 'bg-blue-600 border-blue-500 text-foreground' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
                >
                  <span>🌐</span>
                  <span>English</span>
                </button>
                {/* Global = all countries */}
                <button
                  onClick={() => setRegions(REGIONS.map(r => r.code))}
                  title="Search across all countries simultaneously — slower but surfaces creators from every region"
                  className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.length === REGIONS.length ? 'bg-blue-600 border-blue-500 text-foreground' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
                >
                  <span>🗺️</span>
                  <span>Global</span>
                </button>
                {REGIONS.map(r => (
                  <button
                    key={r.code}
                    onClick={() => setRegions(prev => regions.includes(r.code) ? prev.filter(c => c !== r.code) : [...prev, r.code])}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.includes(r.code) ? 'bg-blue-600 border-blue-500 text-foreground' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
                  >
                    <span>{r.flag}</span>
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading progress */}
        {loading && (
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-1.5">
              <Spinner />
              <span className="text-sm text-foreground/80">
                {enrichProgress.total === 0
                  ? 'Searching YouTube...'
                  : `Enriching ${enrichProgress.current} / ${enrichProgress.total} creators`}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{elapsed}s elapsed</span>
            </div>
            {enrichProgress.total > 0 && (
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </div>
        )}

        {!loading && status && <p className="text-xs text-muted-foreground mb-4">{status}</p>}

        {/* Suggestions bar */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setShowSuggestions(v => !v)} className="text-xs text-muted-foreground hover:text-foreground/80 uppercase tracking-wide flex items-center gap-1 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${showSuggestions ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Suggested searches
            </button>
            {showSuggestions && (
              <button onClick={() => setSuggestions(pickRandom(ALL_OCCUPATIONS, 25))} title="Shuffle suggestions" className="text-muted-foreground hover:text-foreground/80 border border-border rounded p-0.5 hover:border-border transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
          {showSuggestions && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button key={s} onClick={() => { setKeyword(s); runSearch(s) }}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted text-foreground/80 hover:bg-muted hover:text-foreground border border-border hover:border-border transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs + Customize */}
        <div className="flex items-center mb-4 border-b border-border">
          <AnimatedTabs<ActiveTab>
            layoutGroup="main-tabs"
            tabs={[
              {
                id: 'results',
                label: <>Results {currentList.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({currentList.length}{currentList.length !== creators.length ? ` of ${creators.length}` : ''})</span>}</>,
              },
              {
                id: 'outreach',
                label: <>Outreach {outreach.length > 0 && <span className="ml-1 text-xs text-purple-700 dark:text-purple-400">({outreach.length})</span>}</>,
              },
              {
                id: 'dismissed',
                label: <>Dismissed {dismissed.length > 0 && <span className="ml-1 text-xs text-red-700 dark:text-red-400">({dismissed.length})</span>}</>,
              },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
          <button
            onClick={() => {
              const draft = activePlatform === 'youtube'
                ? colConfig
                : colConfig.filter(c => !YOUTUBE_ONLY_COL_IDS.includes(c.id))
              setDraftCols(draft)
              setShowCustomize(true)
            }}
            className={`ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-3 py-1.5 transition-colors mb-1 ${activeTab === 'outreach' || activeTab === 'dismissed' ? 'invisible' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Customize
          </button>
        </div>

        {/* Customize drawer */}
        {showCustomize && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/50" onClick={() => setShowCustomize(false)} />
            <div className="w-80 bg-card border-l border-border flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Customize Columns</h2>
                <button onClick={() => setShowCustomize(false)} className="text-muted-foreground hover:text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-muted-foreground px-5 pt-3 pb-1">Channel is always shown first.</p>
              {activePlatform !== 'youtube' && (
                <p className="text-xs text-muted-foreground/70 px-5 pb-2">YouTube-only metrics hidden for {platformConfig.label} view.</p>
              )}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
                {draftCols.map((col, idx) => {
                  const isLocked = platformConfig.column === col.id
                  return (
                    <div key={col.id} className={`flex items-center gap-3 py-2 px-3 rounded group ${isLocked ? 'opacity-60' : 'hover:bg-muted'}`}>
                      <input
                        type="checkbox" checked={col.visible}
                        disabled={isLocked}
                        onChange={() => !isLocked && setDraftCols(d => d.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))}
                        className="w-4 h-4 rounded accent-blue-500 disabled:cursor-not-allowed"
                      />
                      <span className="flex-1 text-sm text-foreground">{col.label}</span>
                      {isLocked
                        ? <span className="text-[10px] text-muted-foreground shrink-0">auto-on</span>
                        : (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              disabled={idx === 0}
                              onClick={() => setDraftCols(d => { const n = [...d]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1"
                            >↑</button>
                            <button
                              disabled={idx === draftCols.length - 1}
                              onClick={() => setDraftCols(d => { const n = [...d]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1"
                            >↓</button>
                          </div>
                        )
                      }
                    </div>
                  )
                })}
              </div>
              <div className="px-5 py-4 border-t border-border flex gap-3">
                <button
                  onClick={() => setDraftCols(DEFAULT_COLS)}
                  className="flex-1 px-4 py-2 text-sm text-muted-foreground border border-border rounded hover:border-border hover:text-foreground transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    let saved = draftCols
                    if (activePlatform !== 'youtube') {
                      // Re-append YouTube-only cols so they're preserved for when user switches back
                      const ytOnly = colConfig.filter(c => YOUTUBE_ONLY_COL_IDS.includes(c.id))
                      saved = [...draftCols, ...ytOnly]
                    }
                    setColConfig(saved)
                    setDraftCols(saved)
                    void saveColConfig(saved)
                    setShowCustomize(false)
                  }}
                  className="flex-1 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showAnalyticsCustomize && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/50" onClick={() => setShowAnalyticsCustomize(false)} />
            <div className="w-96 bg-card border-l border-border flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Customize Analytics</h2>
                <button onClick={() => setShowAnalyticsCustomize(false)} className="text-muted-foreground hover:text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Suggested — live preview cards with your real data */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Suggested · live preview</div>
                    <div className="text-[10px] text-muted-foreground/70">click any to add</div>
                  </div>
                  {(() => {
                    const existingLabels = new Set(draftMetrics.map(m => m.label.toLowerCase()))
                    const remaining = SUGGESTED_METRICS.filter(s => !existingLabels.has(s.label.toLowerCase()))
                    if (remaining.length === 0) return <div className="text-xs text-muted-foreground/70 italic">All suggestions added.</div>
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        {remaining.map(s => {
                          const previewMetric = { ...s, id: `preview-${s.label}` } as import('@/lib/types').CustomMetric
                          const value = computeMetric(previewMetric, outreach)
                          const typeLabel = metricTypeLabel(s)
                          return (
                            <button
                              key={s.label}
                              onClick={() => setDraftMetrics(d => [...d, { ...s, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }])}
                              className="group text-left bg-muted/40 hover:bg-muted border border-border hover:border-purple-500/60 rounded-lg p-3 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate" title={s.label}>{s.label}</div>
                                <span className="text-[10px] text-muted-foreground/70 group-hover:text-purple-700 dark:text-purple-400 transition-colors">+ Add</span>
                              </div>
                              <div className="text-xl font-bold text-foreground tabular-nums">{value}</div>
                              <div className="text-[10px] text-muted-foreground capitalize mt-0.5">{typeLabel}</div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>

                {/* Build your own */}
                <div>
                  <button
                    onClick={() => setShowAddMetric(true)}
                    className="w-full text-xs text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:text-purple-200 border border-purple-500/30 hover:border-purple-500/60 rounded-md px-3 py-2 transition-colors"
                  >
                    + Build a custom metric
                  </button>
                </div>

                {/* Your metrics list */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Your metrics</div>
                    <div className="text-[10px] text-muted-foreground/70">{draftMetrics.length} card{draftMetrics.length === 1 ? '' : 's'}</div>
                  </div>
                  {draftMetrics.length === 0 ? (
                    <div className="text-xs text-muted-foreground/70 italic py-4 text-center">No metrics yet — add a suggestion or build your own above.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {draftMetrics.map((m, idx) => {
                        const value = computeMetric(m, outreach)
                        return (
                          <div key={m.id} className="flex items-center gap-2 py-2 px-3 rounded bg-muted/40 hover:bg-muted border border-border group">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-foreground truncate">{m.label}</div>
                              <div className="text-[10px] text-muted-foreground capitalize">{metricTypeLabel(m)}</div>
                            </div>
                            <span className="text-sm font-bold text-foreground tabular-nums">{value}</span>
                            <div className="flex gap-0.5">
                              <button
                                disabled={idx === 0}
                                onClick={() => setDraftMetrics(d => { const n = [...d]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1"
                                title="Move up"
                              >↑</button>
                              <button
                                disabled={idx === draftMetrics.length - 1}
                                onClick={() => setDraftMetrics(d => { const n = [...d]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1"
                                title="Move down"
                              >↓</button>
                              <button
                                onClick={() => setEditingMetric(m)}
                                className="text-muted-foreground hover:text-foreground px-1"
                                title="Edit"
                              >✎</button>
                              <button
                                onClick={() => setDraftMetrics(d => d.filter(x => x.id !== m.id))}
                                className="text-muted-foreground hover:text-red-700 dark:text-red-400 px-1"
                                title="Remove"
                              >✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border flex gap-3">
                <button
                  onClick={() => setDraftMetrics(customMetrics)}
                  className="flex-1 px-4 py-2 text-sm text-muted-foreground border border-border rounded hover:border-border hover:text-foreground transition-colors"
                >Reset</button>
                <button
                  onClick={async () => {
                    setCustomMetrics(draftMetrics)
                    await saveCustomMetrics(draftMetrics)
                    setShowAnalyticsCustomize(false)
                  }}
                  className="flex-1 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                >Save</button>
              </div>
            </div>
          </div>
        )}

        {showOutreachCustomize && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/50" onClick={() => setShowOutreachCustomize(false)} />
            <div className="w-80 bg-card border-l border-border flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Outreach Columns</h2>
                <button onClick={() => setShowOutreachCustomize(false)} className="text-muted-foreground hover:text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-xs text-muted-foreground px-5 pt-3 pb-1">Toggle columns on/off and drag to reorder.</p>
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
                {draftOutreachCols.map((col, idx) => (
                  <div key={col.id as string} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-muted group">
                    <input type="checkbox" checked={col.visible}
                      onChange={() => setDraftOutreachCols(d => d.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))}
                      className="w-4 h-4 rounded accent-purple-500"
                    />
                    <span className="flex-1 text-sm text-foreground">{col.label}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button disabled={idx === 0} onClick={() => setDraftOutreachCols(d => { const n = [...d]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })} className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1">↑</button>
                      <button disabled={idx === draftOutreachCols.length - 1} onClick={() => setDraftOutreachCols(d => { const n = [...d]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })} className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1">↓</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 border-t border-border flex gap-3">
                <button onClick={() => setDraftOutreachCols(DEFAULT_OUTREACH_COLS)} className="flex-1 px-4 py-2 text-sm text-muted-foreground border border-border rounded hover:border-border hover:text-foreground transition-colors">Reset</button>
                <button onClick={() => {
                  setOutreachColConfig(draftOutreachCols)
                  void saveOutreachColConfig(draftOutreachCols)
                  setShowOutreachCustomize(false)
                }} className="flex-1 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 rounded transition-colors">Save</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'outreach' ? (
          <>
            {(() => {
              const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() })()
              // Sub-tab badge = action-needed count (Open + overdue/today only).
              // No Response leads aren't counted; they're the "ghosted" bucket.
              const dueCount = outreach.filter(e => {
                if (e.status !== 'Open') return false
                const d = parseLocalDate(e.followUpDate)
                if (!d) return false
                d.setHours(0, 0, 0, 0)
                return d.getTime() <= todayMs
              }).length
              return <OutreachSubTabs active={outreachSubTab} onChange={setOutreachSubTab} favCount={outreach.filter(e => e.favorite).length} dueCount={dueCount} />
            })()}
            {outreachSubTab === 'analytics' ? (
              <OutreachAnalytics
                entries={outreach}
                customMetrics={customMetrics}
                onOpenCustomize={() => { setDraftMetrics(customMetrics); setShowAnalyticsCustomize(true) }}
              />
            ) : outreachSubTab === 'followups' ? (
              <OutreachFollowUps
                entries={outreach}
                onUpdate={updateOutreachEntry}
                onOpenEntry={(id: string) => setViewingLeadId(id)}
              />
            ) : (
              <OutreachTab
                entries={outreachSubTab === 'favorites' ? outreach.filter(e => e.favorite) : outreach}
                colConfig={outreachColConfig}
                onUpdate={updateOutreachEntry}
                onRemove={removeOutreachEntry}
                onOpenCustomize={() => { setDraftOutreachCols(outreachColConfig); setShowOutreachCustomize(true) }}
                onReorderCols={reorderOutreachCols}
                onOpenManualAdd={() => setShowManualAdd(true)}
                onSearchContacts={searchContactsForEntry}
                searchingIds={searchingContactIds}
                onSearchAll={deepSearchAllOutreach}
                bulkRunning={outreachBulkRunning}
                profile={profile}
                emptyVariant={outreachSubTab === 'favorites' ? 'favorites' : 'all'}
              />
            )}
          </>
        ) : activeTab === 'dismissed' ? (
          <DismissedTab dismissed={dismissed} onUndismiss={undismissCreator} />
        ) : (
          <>
            <CreatorTable
              creators={currentList} outreachIds={outreachIds}
              dismissedIds={dismissedIds}
              onAddToOutreach={addToOutreach}
              onDismiss={dismissCreator}
              onReorderCols={reorderResultCols}
              loading={loading}
              sortCol={sortCol} sortDir={sortDir} onSort={handleSort}
              colConfig={effectiveColConfig}
              loadMoreBatch={activeTab === 'results' ? loadMoreCreators.filter(c =>
                c.avgViews >= minViews && c.avgViews <= maxViews &&
                (maxAgeDays === Infinity || parseRelativeDays(c.videoDates?.[0] || '') <= maxAgeDays) &&
                (!emailOnly || !!c.email) &&
                (activePlatform === 'youtube' || (activePlatform === 'instagram' ? !!c.instagram : activePlatform === 'tiktok' ? !!c.tiktok : activePlatform === 'twitter' ? !!c.twitter : activePlatform === 'linkedin' ? !!c.linkedin : true))
              ) : undefined}
              scoreWeights={scoreWeights}
              scoreNarrative={scoreNarrative}
              activePlatform={activePlatform}
              totalUnfiltered={creators.length}
              profile={profile}
              onDeepSearch={deepSearchResultEmail}
              deepSearchingIds={deepSearchingResultIds}
              onDeepSearchAll={deepSearchAllResults}
              bulkRunning={resultsBulkRunning}
            />
            {activeTab === 'results' && (
              <div className="mt-5 flex flex-col items-center gap-2">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner />
                    <span>Loading more creators...</span>
                  </div>
                ) : (
                  <button
                    onClick={handleLoadMore}
                    disabled={!currentKeyword || loading}
                    className="px-6 py-2 bg-muted hover:bg-muted border border-border hover:border-border text-foreground/80 hover:text-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Load More Creators
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showScoreSettings && (
        <ScoreSettingsModal
          weights={scoreWeights}
          narrative={scoreNarrative}
          guidanceEntries={guidanceEntries}
          activePlatform={activePlatform}
          onAddGuidance={addGuidanceEntry}
          onRemoveGuidance={removeGuidanceEntry}
          onUpdateGuidanceWeight={updateGuidanceEntryWeight}
          onResetGuidance={resetAllGuidance}
          onSave={(w, n) => {
            setScoreWeights(w)
            setScoreNarrative(n)
            void savePlatformWeights(activePlatform, w)
            void savePlatformNarrative(activePlatform, n)
          }}
          onClose={() => setShowScoreSettings(false)}
        />
      )}

      {showOnboarding && userId && (
        <OnboardingModal
          userId={userId}
          onComplete={() => {
            setShowOnboarding(false)
            // Re-fetch profile so the email template picks up the new name immediately
            ;(async () => {
              const supabase = createSupabaseClient()
              const { data } = await supabase
                .from('user_profile')
                .select('full_name, linkedin_url, pitch_line')
                .eq('user_id', userId)
                .single()
              if (data) setProfile({ fullName: data.full_name ?? '', linkedinUrl: data.linkedin_url ?? '', pitchLine: data.pitch_line ?? '' })
            })()
          }}
        />
      )}

      {showProfile && userId && (
        <ProfileModal
          userId={userId}
          initial={profile ?? { fullName: '', linkedinUrl: '', pitchLine: '' }}
          onSave={(next) => setProfile(next)}
          onClose={() => setShowProfile(false)}
        />
      )}

      {pendingMigration && userId && !showOnboarding && (
        <MigrationPromptModal
          outreachCount={pendingMigration.outreach}
          dismissedCount={pendingMigration.dismissed}
          onMigrate={async () => {
            const result = await runManualMigration()
            if (result.ok) setPendingMigration(null)
            return result
          }}
          onSkip={() => {
            setMigrationSkipped()
            setPendingMigration(null)
          }}
        />
      )}

      {showImport && (
        <ImportOutreachModal
          onImport={async (entries) => {
            // Merge with existing outreach (don't overwrite — append + de-dupe by channelId)
            const merged = [...entries, ...outreach]
            const seen = new Set<string>()
            const deduped = merged.filter(e => {
              if (seen.has(e.channelId)) return false
              seen.add(e.channelId)
              return true
            })
            await persistOutreach(deduped)
            const fresh = await getOutreach()
            setOutreach(fresh)
            setOutreachIds(new Set(fresh.map(e => e.channelId)))
            setShowImport(false)
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {showImportDismissed && (
        <ImportDismissedModal
          onImport={async (items) => {
            // Merge + de-dupe by channelId
            const merged = [...items, ...dismissed]
            const seen = new Set<string>()
            const deduped = merged.filter(c => {
              if (seen.has(c.channelId)) return false
              seen.add(c.channelId)
              return true
            })
            await persistDismissed(deduped)
            const fresh = await getDismissed()
            setDismissed(fresh)
            setDismissedIds(new Set(fresh.map(c => c.channelId)))
            setShowImportDismissed(false)
          }}
          onClose={() => setShowImportDismissed(false)}
        />
      )}

      {viewingLeadId && (() => {
        const entry = outreach.find(e => e.id === viewingLeadId)
        if (!entry) return null
        return (
          <LeadDetailModal
            entry={entry}
            onUpdate={updateOutreachEntry}
            onClose={() => setViewingLeadId(null)}
          />
        )
      })()}

      {showManualAdd && (
        <ManualAddOutreachModal
          existingChannelIds={outreachIds}
          onAdd={async (entry) => {
            const next = [entry, ...outreach]
            await persistOutreach(next)
            const fresh = await getOutreach()
            setOutreach(fresh)
            setOutreachIds(new Set(fresh.map(e => e.channelId)))
          }}
          onClose={() => setShowManualAdd(false)}
        />
      )}

      {(showAddMetric || editingMetric) && (
        <CustomMetricModal
          initial={editingMetric ?? undefined}
          entries={outreach}
          onSave={async (m) => {
            // Always mutate the draft — user clicks Save in the drawer to commit.
            setDraftMetrics(d => {
              const exists = d.some(x => x.id === m.id)
              return exists ? d.map(x => x.id === m.id ? m : x) : [...d, m]
            })
          }}
          onDelete={editingMetric ? async () => {
            setDraftMetrics(d => d.filter(x => x.id !== editingMetric.id))
          } : undefined}
          onClose={() => { setShowAddMetric(false); setEditingMetric(null) }}
        />
      )}
    </main>
    </GuidanceContext.Provider>
  )
}
