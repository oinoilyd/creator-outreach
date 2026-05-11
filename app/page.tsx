'use client'

import Link from 'next/link'
import React, { useState, useMemo, useEffect, useCallback, useLayoutEffect, useRef, useContext } from 'react'
import { createPortal } from 'react-dom'
// Per taste-skill: NEVER use emojis. All formerly-emoji UI elements
// (★ Favorites, ⏰ Follow-ups, 📊 Analytics, 🔥 High priority, ✨ Lead
// Criteria, ✉ has-email indicator, 👋 in DM template) are now SVG
// icons from lucide-react.
import { Star, Clock, BarChart3, Flame, Sparkles, Mail } from 'lucide-react'
import type {
  Creator, SortCol, SortKey, ColId, ActiveTab, ScoreWeights,
  GuidanceCondition, GuidanceRule, GuidanceEntry, GuidancePreset, GuidanceContextType,
  OutreachEntry, OutreachColDef, OutreachColConfig,
  ColConfig, PlatformId, PlatformConfig, UserProfile,
} from '@/lib/types'
import { EMPTY_METRIC_FILTER } from '@/lib/types'
import { computeMetric, metricTypeLabel, SUGGESTED_METRICS } from '@/lib/metrics'
import { toast } from 'sonner'
import { celebrateSuccess } from '@/lib/celebrate'
import { NumberTicker } from '@/components/NumberTicker'
import { AnimatedTabs, tabId, tabPanelId } from '@/components/AnimatedTabs'
import { OutreachSubTabs } from '@/components/outreach/OutreachSubTabs'
import { AnimatedRow } from '@/components/AnimatedRow'
import { BorderBeam } from '@/components/BorderBeam'
import { motion } from 'motion/react'
import { CadencePopover, FollowedUpPopover } from '@/components/CadencePopover'
import { InstagramCell } from '@/components/InstagramCell'
import { useInstagramMetrics, formatFollowers } from '@/lib/hooks/useInstagramMetrics'
import {
  ALL_OCCUPATIONS, VIEW_PRESETS, NICHE_BUCKETS,
  pickRandom, formatSubscribers, parseRelativeDays, parseSubscriberCount, buildOutreachEmail,
  buildOutreachContent,
  formatAddedAtRelative, recipientIssue,
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
  YOUTUBE_ONLY_COL_IDS, COL_SORT, PLATFORM_AUTOSHOW_COLS,
} from '@/lib/columns'
import { PLATFORM_CONFIGS, PLATFORM_LOCK_ID } from '@/lib/platform'
import { REGIONS } from '@/lib/regions'
import { classifySearchInput } from '@/lib/search-classify'
import {
  PlusCircleIcon, DismissIcon, TrashIcon, Spinner, SortIndicator,
  AutoTextarea,
} from '@/components/ui'
import { DismissedTab } from '@/components/DismissedTab'
import { PlatformDropdown } from '@/components/PlatformDropdown'
import { HamburgerMenu } from '@/components/HamburgerMenu'
// Lazy-loaded modal mounts (2026-05-09). Each of these only renders
// after a user click — there's no reason for them to ride along on
// the initial JS bundle. Switching to next/dynamic with the named-
// export `.then(m => m.X)` pattern keeps the prop types intact while
// dropping ~30-60 KB gzipped from the first paint chunk.
//
// `ssr: false` because these are interactive client surfaces that
// only render on user action — SSR would just be wasted work.
import dynamic from 'next/dynamic'
const ScoreSettingsModal = dynamic(
  () => import('@/components/ScoreSettingsModal').then(m => m.ScoreSettingsModal),
  { ssr: false },
)
const OnboardingModal = dynamic(
  () => import('@/components/OnboardingModal').then(m => m.OnboardingModal),
  { ssr: false },
)
const ProfileModal = dynamic(
  () => import('@/components/ProfileModal').then(m => m.ProfileModal),
  { ssr: false },
)
const SendPreviewModal = dynamic(
  () => import('@/components/SendPreviewModal').then(m => m.SendPreviewModal),
  { ssr: false },
)
const ThreadModal = dynamic(
  () => import('@/components/ThreadModal').then(m => m.ThreadModal),
  { ssr: false },
)
const MigrationPromptModal = dynamic(
  () => import('@/components/MigrationPromptModal').then(m => m.MigrationPromptModal),
  { ssr: false },
)
const ImportOutreachModal = dynamic(
  () => import('@/components/ImportOutreachModal').then(m => m.ImportOutreachModal),
  { ssr: false },
)
const ImportDismissedModal = dynamic(
  () => import('@/components/ImportDismissedModal').then(m => m.ImportDismissedModal),
  { ssr: false },
)
const CustomMetricModal = dynamic(
  () => import('@/components/CustomMetricModal').then(m => m.CustomMetricModal),
  { ssr: false },
)
const ManualAddOutreachModal = dynamic(
  () => import('@/components/ManualAddOutreachModal').then(m => m.ManualAddOutreachModal),
  { ssr: false },
)
const LeadDetailModal = dynamic(
  () => import('@/components/LeadDetailModal').then(m => m.LeadDetailModal),
  { ssr: false },
)
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
import {
  parseLocalDate,
  todayIso,
  isoDaysFromNow,
  daysAgo,
  daysFromNow,
} from '@/lib/dates'
import {
  composeInstagramDm,
  copyInstagramDm,
  composeLinkedInMessage,
  copyLinkedInMessage,
  markEmailBounced,
  filterOutreachByKeyword,
  nextFollowUpDays,
  followUpStageLabel,
} from '@/lib/outreach'

const GuidanceContext = React.createContext<GuidanceContextType>({
  entries: [], addEntry: () => {}, removeEntry: () => {}, updateEntryWeight: () => {}, resetAll: () => {},
})

/**
 * Phase 2 click interceptor — when the user has a Unipile-connected
 * Gmail, we route "send email" through our backend (programmatic send,
 * preview modal, real reply tracking) instead of the compose-URL flow.
 *
 * Dispatches a CustomEvent('open-send-modal', { detail }) that Home()
 * listens for. Returns true if it intercepted (caller should preventDefault).
 */
function maybeOpenUnipileSend(
  ev: React.MouseEvent<HTMLAnchorElement>,
  profile: UserProfile | null,
  payload: { entryId: string; to: string; subject: string; body: string; recipientLabel?: string },
): boolean {
  if (!profile?.unipileAccountId) return false
  ev.preventDefault()
  ev.stopPropagation()
  window.dispatchEvent(new CustomEvent('open-send-modal', { detail: payload }))
  return true
}

/**
 * Guard fired by every outreach email link's onClick before navigation.
 *
 * Background: on 2026-05-10 Dylan sent a "test" outreach from an
 * Outreach row and the email landed in his OWN signup inbox instead
 * of the creator's — root cause was a missing recipient where Gmail's
 * compose form auto-filled the To with a recent contact (himself).
 * Now: any click whose recipient is empty / invalid / equals the
 * signed-in user's own email is BLOCKED at the click, with an
 * explanatory toast. The href still resolves to '' from composeUrl
 * so accidentally bypassing the handler (eg. middle-click) also
 * fails closed.
 *
 * Returns true when the navigation should proceed.
 */
function guardOutreachClick(
  ev: React.MouseEvent<HTMLAnchorElement>,
  toEmail: string | undefined | null,
  userEmail: string | null | undefined,
): boolean {
  const issue = recipientIssue(toEmail, userEmail)
  if (issue === null) return true
  ev.preventDefault()
  ev.stopPropagation()
  if (issue === 'self') {
    toast.error('Blocked: that email is YOUR signup address', {
      description:
        "We refused to open compose because the recipient matches your own login email — sending here would email yourself, not the creator. Open the row, check the Email field, and replace it with the creator's real address.",
      duration: 9000,
    })
  } else if (issue === 'empty') {
    toast.warning('No email on file for this creator', {
      description:
        'Click "🔍 Find email" to deep-search, or paste an address into the Email column manually.',
      duration: 6000,
    })
  } else {
    toast.error(`Invalid recipient: "${(toEmail ?? '').slice(0, 60)}"`, {
      description:
        "That doesn't look like a real email address. Edit the Email field on this row to fix it before sending.",
      duration: 7000,
    })
  }
  return false
}

function FitScoreCell({ c, weights, narrative }: { c: Creator; weights: ScoreWeights; narrative: string }) {
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

function renderCell(
  id: ColId,
  c: Creator,
  weights: ScoreWeights,
  narrative: string,
  profile: UserProfile | null,
  searching: boolean,
  onDeepSearch: (channelId: string) => void,
  onUpdateInstagram?: (channelId: string, igUrl: string) => void,
): React.ReactNode {
  switch (id) {
    case 'fitScore': {
      return <FitScoreCell key={id} c={c} weights={weights} narrative={narrative} />
    }
    case 'avgViews':    return <td key={id} className="px-4 py-3">{c.avgViews.toLocaleString()}</td>
    case 'subscribers': return <td key={id} className="px-4 py-3 text-foreground/80">{formatSubscribers(c.subscribers)}</td>
    case 'lastVideo': return (
      <td key={id} className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {c.videoDates?.[0]
          ? <><div>{c.videoDates[0]}</div>{c.videoDates[1] && <div className="text-muted-foreground/70">{c.videoDates[1]}</div>}</>
          : <span className="text-muted-foreground/50">—</span>}
      </td>
    )
    case 'lastShort': return (
      <td key={id} className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {c.shortDates?.[0]
          ? <><div>{c.shortDates[0]}</div>{c.shortDates[1] && <div className="text-muted-foreground/70">{c.shortDates[1]}</div>}</>
          : <span className="text-muted-foreground/50">—</span>}
      </td>
    )
    case 'email': return (
      <td key={id} className="px-4 py-3 text-xs">
        {c.email ? (
          <a
            href={buildOutreachEmail(c, profile)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={ev => guardOutreachClick(ev, c.email, profile?.userEmail)}
            className="text-emerald-700 dark:text-green-400 hover:underline"
          >{c.email}</a>
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
    case 'linkedin':  return <td key={id} className="px-4 py-3">{c.linkedin  ? <a href={c.linkedin}  target="_blank" rel="noopener noreferrer" onClick={() => copyLinkedInMessage(c.channelName)} title="Open LinkedIn + copy message template" className="text-blue-800 dark:text-blue-400 hover:underline">Message</a> : '—'}</td>
    case 'website':   return <td key={id} className="px-4 py-3">{c.website   ? <a href={c.website}   target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'instagram': return (
      <td key={id} className="px-4 py-3">
        <InstagramCell
          channelName={c.channelName}
          instagramUrl={c.instagram}
          onCopyDm={() => copyInstagramDm(c.channelName)}
          onUpdateInstagram={onUpdateInstagram ? (url) => onUpdateInstagram(c.channelId, url) : undefined}
        />
      </td>
    )
    case 'twitter':   return <td key={id} className="px-4 py-3">{c.twitter   ? <a href={c.twitter}   target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'tiktok':    return <td key={id} className="px-4 py-3">{c.tiktok    ? <a href={c.tiktok}    target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'igFollowers': return <td key={id} className="px-4 py-3 text-xs tabular-nums"><InstagramMetricCell instagramUrl={c.instagram} field="followers" /></td>
    case 'igPosts':     return <td key={id} className="px-4 py-3 text-xs tabular-nums"><InstagramMetricCell instagramUrl={c.instagram} field="posts" /></td>
  }
}

/**
 * Tiny render-only cell for IG-API-derived metric columns (followers,
 * posts). Reuses the same useInstagramMetrics polling hook the
 * InstagramCell uses, so the network roundtrip dedupes per handle.
 *
 * States:
 *   - no IG handle on the row     →  '—'
 *   - polling                     →  spinner dot
 *   - ready                       →  formatted number (1.2M / 538K)
 *   - unavailable / unconfigured  →  '—' with tooltip explaining why
 */
function InstagramMetricCell({ instagramUrl, field }: { instagramUrl: string; field: 'followers' | 'posts' }) {
  const status = useInstagramMetrics(instagramUrl || undefined)

  if (!instagramUrl) {
    return <span className="text-muted-foreground/40">—</span>
  }
  if (status.status === 'pending' || status.status === 'idle') {
    return <span className="text-muted-foreground/40 animate-pulse">⋯</span>
  }
  if (status.status === 'ready') {
    const m = status.metrics as { followers?: number; mediaCount?: number; posts?: number }
    const value = field === 'followers' ? m.followers : (m.posts ?? m.mediaCount)
    if (value == null) return <span className="text-muted-foreground/40">—</span>
    return (
      <span title={`${(value).toLocaleString()} ${field}`}>
        {formatFollowers(value)}
      </span>
    )
  }
  // unavailable / timeout / unconfigured / invalid_handle
  const reason =
    status.status === 'unavailable' ? (status as any).reason
    : status.status === 'unconfigured' ? 'Meta Graph API not configured yet'
    : status.status === 'timeout' ? 'IG metrics lookup timed out'
    : 'IG metrics unavailable'
  return (
    <span className="text-muted-foreground/40" title={reason}>—</span>
  )
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
      ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40 hover:border-red-300 dark:hover:border-red-400'
      : isToday
        ? 'bg-amber-50 dark:bg-yellow-500/15 text-amber-800 dark:text-yellow-300 border-amber-200 dark:border-yellow-500/40 hover:border-amber-300 dark:hover:border-yellow-400'
        : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30 hover:border-blue-300 dark:hover:border-blue-400'

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
      return (
        <div className="flex items-start gap-1.5 w-full">
          <AutoTextarea value={e.channelName} onChange={v => onUpdate(e.id, 'channelName', v)} className="text-blue-800 dark:text-blue-400 font-medium flex-1" />
          {e.unipileThreadId && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-thread-modal', { detail: { entryId: e.id, label: e.channelName } }))}
              title="View full conversation thread"
              aria-label="View conversation thread"
              className="mt-0.5 text-muted-foreground/70 hover:text-purple-600 dark:hover:text-purple-300 transition-colors text-sm leading-none"
            >
              💬
            </button>
          )}
        </div>
      )
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
          {e.email && (
            <div className="flex items-start gap-1.5">
              <a
                href={buildOutreachEmail({ channelName: e.channelName, email: e.email, videoTitles: [], description: e.description } as unknown as Creator, profile, e.trackingId)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={ev => {
                  // 2026-05-10 — recipient guard runs FIRST. If the
                  // address is empty / invalid / equals the user's
                  // own login email, we block the navigation and
                  // skip the click-to-track status flip too — no
                  // outbound = no status change.
                  if (!guardOutreachClick(ev, e.email, profile?.userEmail)) return
                  // Phase 2 — if the user has connected Gmail via
                  // Unipile, intercept the click and open the
                  // SendPreviewModal instead of navigating to a
                  // compose URL. Sends programmatically with reply
                  // tracking, eliminating the multi-account bugs.
                  const content = buildOutreachContent(
                    { channelName: e.channelName, email: e.email, videoTitles: [], description: e.description } as unknown as Creator,
                    profile,
                    undefined, // No [CO-#xxx] tag — Unipile uses real threading
                  )
                  if (maybeOpenUnipileSend(ev, profile, {
                    entryId: e.id,
                    to: e.email,
                    subject: content.subject,
                    body: content.body,
                    recipientLabel: e.channelName,
                  })) return
                  // Phase 1 — click-to-track (legacy compose-URL path).
                  if (e.status === 'Not Outreached' || e.status === '') {
                    onUpdate(e.id, 'status', 'No Response')
                  }
                }}
                className="text-emerald-700 dark:text-green-400 hover:underline text-xs break-all flex-1"
              >
                {e.email}
              </a>
              {/* Mark email bad — flips creator_enrichment.email_bounced
                  so the cache forces a re-fetch next time. Confirms before
                  firing so we don\\'t flag good emails on a fat-finger. */}
              <button
                type="button"
                title="Mark email bad — clears it from the cache so the next enrichment runs fresh"
                onClick={() => {
                  if (!confirm(`Mark ${e.email} as bad?\n\nThe cache will clear and next enrichment will re-fetch from scratch.`)) return
                  void markEmailBounced(e.channelId, e.email, e.channelName)
                }}
                className="shrink-0 mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                aria-label="Mark email bad"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 7l1 13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2l1-13" />
                  <path d="M8 7V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3" />
                  <line x1="3" y1="7" x2="21" y2="7" />
                </svg>
              </button>
            </div>
          )}
          {/* When the email exists we don't repeat it as plain text
              below the green link — that was a confusing duplicate.
              Instead show a small "Edit email" toggle that swaps in
              an inline textarea on click. When the email is BLANK,
              fall through to the textarea + Find-email path so the
              user can paste/type one. */}
          {e.email ? (
            <EmailEditToggle
              email={e.email}
              onChange={v => onUpdate(e.id, 'email', v)}
            />
          ) : (
            <>
              <AutoTextarea
                value={e.email}
                onChange={v => onUpdate(e.id, 'email', v)}
                placeholder="Add email..."
                className="text-muted-foreground"
              />
              <button
                onClick={() => onSearchContacts(e.id)}
                disabled={searching}
                title="Deep search — checks website (incl. /press, /partnerships, /sponsor), Linktree-style bio pages, social bios, and multiple DDG queries. Takes 10-20s."
                className="self-start mt-0.5 text-[10px] text-purple-700 dark:text-purple-400 hover:text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:border-purple-500/60 rounded px-2 py-0.5 transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {searching ? 'Searching…' : '🔍 Find email'}
              </button>
            </>
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
    case 'status': {
      // "Needs classification" hint: when the inbound webhook stamped
      // responseDate but the user hasn't moved status off "No Response"
      // (or earlier states) yet — they got a reply and need to read +
      // classify as Open / Successful / Rejected. Surfaces as a small
      // mail badge above the dropdown.
      const needsClassification =
        !!e.responseDate &&
        (e.status === 'No Response' ||
          e.status === 'Not Outreached' ||
          e.status === '')
      return (
        <div className="flex flex-col gap-0.5">
          {needsClassification && (
            <span
              className="inline-flex items-center gap-1 self-start text-[9px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 rounded px-1.5 py-0.5"
              title={`Reply received ${e.responseDate}. Pick Open / Successful / Rejected after reading.`}
            >
              📬 New reply
            </span>
          )}
          <select value={e.status || 'Not Outreached'} onChange={ev => onUpdate(e.id, 'status', ev.target.value)}
            className={`w-full rounded px-2 py-0.5 text-xs focus:outline-none border ${e.status === 'Successful' ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300' : e.status === 'Open' ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300' : e.status === 'Rejected' ? 'bg-red-50 dark:bg-red-900/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300' : e.status === 'No Response' ? 'bg-muted border-border text-muted-foreground' : 'bg-muted border-border text-muted-foreground'}`}>
            <option value="Not Outreached">Not Outreached</option>
            <option value="Open">Open</option>
            <option value="No Response">No Response</option>
            <option value="Successful">Successful</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      )
    }
    case 'notes':
      return <AutoTextarea value={e.notes || ''} onChange={v => onUpdate(e.id, 'notes', v)} placeholder="Notes..." className="text-foreground/80" />
    case 'followUpDate':
      return <FollowUpDateCell entry={e} onUpdate={onUpdate} />
    case 'openCount':
      return (
        <span className="text-xs tabular-nums" title={e.lastOpenedAt ? `Last opened ${new Date(e.lastOpenedAt).toLocaleString()}` : 'No opens tracked yet'}>
          {e.openCount ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{e.openCount}×</span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
        </span>
      )
    case 'autoFollowup':
      // Phase 7 — toggle the cron-auto-followup behaviour per row.
      // Disabled when the user has no Unipile account; the cron skips
      // those rows anyway but disabling the UI signals why.
      return (
        <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none" title={profile?.unipileAccountId ? 'Auto-send a follow-up when Follow Up Date hits and no reply has been received.' : 'Connect Gmail in Profile to enable auto-follow-ups.'}>
          <input
            type="checkbox"
            checked={!!e.autoFollowup}
            disabled={!profile?.unipileAccountId}
            onChange={ev => onUpdate(e.id, 'autoFollowup', ev.target.checked)}
            className="accent-purple-600 disabled:opacity-40"
          />
          <span className={profile?.unipileAccountId ? 'text-foreground/80' : 'text-muted-foreground/60'}>
            {e.autoFollowup ? 'On' : 'Off'}
          </span>
        </label>
      )
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
    case 'addedAt':
      // Relative time ("3m ago", "2h ago", "5d ago"), with the full
      // local timestamp on hover. Empty addedAt (legacy rows) shows
      // an em-dash so sorting still pushes them to the bottom.
      return e.addedAt ? (
        <span
          className="text-xs text-muted-foreground tabular-nums"
          title={new Date(e.addedAt).toLocaleString()}
        >
          {formatAddedAtRelative(e.addedAt)}
        </span>
      ) : <span className="text-muted-foreground/50">—</span>

    case 'linkedin':
      // Click LinkedIn → opens profile + copies templated message.
      // Same pattern as Instagram (LinkedIn has no DM deep-link).
      return e.linkedin ? (
        <a
          href={e.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => copyLinkedInMessage(e.channelName)}
          title="Open LinkedIn + copy message template to clipboard"
          className="text-blue-800 dark:text-blue-400 hover:underline text-xs"
        >
          Message
        </a>
      ) : (
        <AutoTextarea value={e.linkedin || ''} onChange={v => onUpdate(e.id, 'linkedin', v)} placeholder="Add URL..." className="text-muted-foreground" />
      )
    case 'instagram':
      // Instagram link: clicking opens the profile AND copies a
      // templated DM to the clipboard (per Dylan: "click on the
      // instagram it pulls up templated language to copy and paste").
      // The browser's default link target="_blank" still navigates;
      // onClick runs in parallel.
      return e.instagram ? (
        <a
          href={e.instagram}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => copyInstagramDm(e.channelName)}
          title="Open IG + copy DM template to clipboard"
          className="text-pink-700 dark:text-pink-400 hover:underline text-xs"
        >
          DM
        </a>
      ) : (
        <AutoTextarea value={e.instagram || ''} onChange={v => onUpdate(e.id, 'instagram', v)} placeholder="Add IG URL..." className="text-muted-foreground" />
      )
    case 'twitter':
      return e.twitter ? <a href={e.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-800 dark:text-blue-400 hover:underline text-xs">link</a> : <AutoTextarea value={e.twitter || ''} onChange={v => onUpdate(e.id, 'twitter', v)} placeholder="Add X URL..." className="text-muted-foreground" />
    case 'tiktok':
      return e.tiktok ? <a href={e.tiktok} target="_blank" rel="noopener noreferrer" className="text-blue-800 dark:text-blue-400 hover:underline text-xs">link</a> : <AutoTextarea value={e.tiktok || ''} onChange={v => onUpdate(e.id, 'tiktok', v)} placeholder="Add TikTok URL..." className="text-muted-foreground" />
    case 'website':
      return e.website ? <a href={e.website} target="_blank" rel="noopener noreferrer" className="text-blue-800 dark:text-blue-400 hover:underline text-xs">link</a> : <AutoTextarea value={e.website || ''} onChange={v => onUpdate(e.id, 'website', v)} placeholder="Add website..." className="text-muted-foreground" />
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

// (OutreachSubTabs moved to components/outreach/OutreachSubTabs.tsx —
//  pure presentational, no state. See top-of-file imports.)

// Priority bucketing — derived from how close the follow-up date is.
// High = overdue or due today. Medium = 1-7 days out. Low = 8+ days out.
// `unset` and `ghosted` are special states, not priorities.
type FUBucket = 'high' | 'medium' | 'low' | 'unset' | 'ghosted'

function OutreachFollowUps({ entries, onUpdate, onOpenEntry, profile }: {
  entries: OutreachEntry[]
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onOpenEntry: (id: string) => void
  profile: UserProfile | null
}) {
  const [sort, setSort] = useState<'urgency' | 'pipeline' | 'touchpoints'>('urgency')
  const [showLater, setShowLater] = useState(false)
  const [showUnset, setShowUnset] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium'>('all')
  const [showGhosted, setShowGhosted] = useState(false)
  // List vs Calendar view toggle. Default 'list' to preserve the
  // existing experience; switching to 'calendar' renders a month
  // grid of every entry that has a followUpDate (status = Open or
  // No Response). Click a day → expand a sheet with quick actions.
  const [view, setView] = useState<'list' | 'calendar'>('list')

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const DAY = 86_400_000
  // 2026-05-10 per Dylan: "no response after immediate outreach isn't
  // low priority — it just puts the next follow-up a little bit out.
  // Stay in active priority until ~a month passes with no reply, THEN
  // demote to ghosted. Some creators take weeks to respond, and the
  // in-between time should trigger another follow-up instead of writing
  // them off." So entries flip into the ghosted bucket only after this
  // many days since the original outreach. Before that, they bucket by
  // follow-up date like a normal Open row.
  //
  // Pipeline item: lift this to a per-user setting (some users prefer
  // 21 days, some 45). 30 is the current default.
  const GHOSTED_THRESHOLD_DAYS = 30

  // Helper — true when a 'No Response' entry has aged past the
  // ghosted threshold (or is missing dateReachedOut, which we treat
  // as old/legacy and conservatively put in ghosted).
  function isTrulyGhosted(e: OutreachEntry): boolean {
    if (e.status !== 'No Response') return false
    const reached = parseLocalDate(e.dateReachedOut)
    if (!reached) return true  // legacy entry with no reach-out date → ghosted
    const daysSince = Math.round((todayMs - reached.getTime()) / DAY)
    return daysSince >= GHOSTED_THRESHOLD_DAYS
  }

  // Active queue = Open OR recently-sent (status=No Response, <14d).
  // Truly ghosted = No Response AND >= 14 days since outreach. Treated
  // as a separate bucket below the main priority queue.
  const open = entries.filter(e => e.status === 'Open' || (e.status === 'No Response' && !isTrulyGhosted(e)))
  const ghosted = entries.filter(e => isTrulyGhosted(e))

  function bucketOf(e: OutreachEntry): FUBucket {
    // Only flip into 'ghosted' once 14 days have passed without a reply.
    if (isTrulyGhosted(e)) return 'ghosted'
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

  // Calendar view — month grid of every follow-up. Click a day to
  // expand a sheet with quick actions (email / IG / open details).
  if (view === 'calendar') {
    return (
      <div className="space-y-4">
        <FollowUpsViewToggle current={view} onChange={setView} />
        <FollowUpCalendar
          entries={[...open, ...ghosted]}
          onUpdate={onUpdate}
          onOpenEntry={onOpenEntry}
          profile={profile}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FollowUpsViewToggle current={view} onChange={setView} />
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

      {/* Sort-aware rendering branch.
          When sort === 'urgency', we group leads into priority
          buckets (High / Medium / Low / Unset / Ghosted) — that's
          the default workflow view.
          When sort === 'pipeline' or 'touchpoints', the bucketing
          stops making sense (the user wants to see highest-value
          or most-touched leads at top, regardless of urgency). We
          flatten everything into a single sorted list.
      */}
      {sort !== 'urgency' ? (
        (() => {
          // Build the flat list. Priority filter still applies for
          // 'high' / 'medium'; otherwise include open + ghosted.
          let flat: OutreachEntry[] = []
          if (priorityFilter === 'high') flat = [...groups.high]
          else if (priorityFilter === 'medium') flat = [...groups.medium]
          else flat = [...open, ...ghosted]
          // Re-apply the chosen sort against the flat list (already
          // sorted within each bucket, but cross-bucket ordering
          // matters here).
          flat = applySort(flat)
          if (flat.length === 0) {
            return (
              <Section title={sort === 'pipeline' ? 'Sorted by pipeline value' : 'Sorted by touch count'} accent="blue" count={0} icon={<span className="text-base">∅</span>}>
                <div className="text-xs text-muted-foreground italic px-1 py-2">
                  No leads match the current filter.
                </div>
              </Section>
            )
          }
          const totalValue = flat.reduce((s, e) => s + dealValueNum(e), 0)
          return (
            <Section
              title={sort === 'pipeline' ? 'By pipeline $ (high to low)' : 'By touches (most to least)'}
              accent="blue"
              count={flat.length}
              subtitle={
                sort === 'pipeline'
                  ? totalValue > 0
                    ? `Total pipeline: $${totalValue.toLocaleString()}`
                    : 'No deal values set yet — fill them in to use this sort.'
                  : 'Highest-touch leads first. Useful for spotting who needs the next nudge.'
              }
              icon={<span className="text-base">{sort === 'pipeline' ? '💰' : '🔥'}</span>}
            >
              {flat.map(e => (
                <FollowUpRow
                  key={e.id}
                  entry={e}
                  bucket={bucketOf(e)}
                  onUpdate={onUpdate}
                  onSnooze={snooze}
                  onMarkFollowedUp={markFollowedUp}
                  onOpen={onOpenEntry}
                  profile={profile}
                />
              ))}
            </Section>
          )
        })()
      ) : (
        <>
      {/* Section: High priority (overdue + today) */}
      {(priorityFilter === 'all' || priorityFilter === 'high') && (
        groups.high.length > 0 ? (
          <Section
            title="High priority"
            accent="red"
            count={groups.high.length}
            subtitle="Overdue or due today — act first"
            icon={<Flame className="w-4 h-4 text-red-500" />}
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
                profile={profile}
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
              profile={profile}
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
              profile={profile}
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
              profile={profile}
            />
          ))}
        </CollapsibleSection>
      )}

      {/* Section: Ghosted leads (No Response) — separate from main queue */}
      {priorityFilter === 'all' && groups.ghosted.length > 0 && (
        <CollapsibleSection
          title="Ghosted"
          count={groups.ghosted.length}
          subtitle="No reply 30+ days after outreach. Optional re-engagement."
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
              profile={profile}
            />
          ))}
        </CollapsibleSection>
      )}
        </>
      )}
    </div>
  )
}

/**
 * List/Calendar toggle pill rendered at the top of the Follow-ups
 * tab. Two-button segmented control. Shared by both the empty-state
 * and populated returns of OutreachFollowUps.
 */
function FollowUpsViewToggle({
  current,
  onChange,
}: {
  current: 'list' | 'calendar'
  onChange: (next: 'list' | 'calendar') => void
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">View</div>
      <div className="flex bg-card/60 rounded-md p-0.5 border border-border">
        {([
          { id: 'list', label: 'List' },
          { id: 'calendar', label: 'Calendar' },
        ] as { id: 'list' | 'calendar'; label: string }[]).map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`px-3 py-1 text-[11px] rounded transition-colors ${
              current === opt.id
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Month-grid calendar showing every entry that has a followUpDate.
 * Click a day with follow-ups → expand a sheet below showing the
 * leads with quick-action buttons (email, IG, LinkedIn, open
 * detail). The detail modal is wired through onOpenEntry — same as
 * the list view's row-click behavior — so users get full editable
 * details without leaving the calendar context.
 *
 * Implementation: pure UI atop existing state. No new persistence.
 * Future: hook into an external calendar (Google / Outlook) via the
 * `integratable` follow-on Dylan mentioned — when wired, each cell
 * here becomes a real event in the user's external calendar.
 */
function FollowUpCalendar({
  entries,
  onOpenEntry,
  profile,
}: {
  entries: OutreachEntry[]
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onOpenEntry: (id: string) => void
  profile: UserProfile | null
}) {
  // Anchored to the first of the displayed month. Navigation arrows
  // mutate this in 1-month steps.
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedIso, setSelectedIso] = useState<string | null>(null)

  // ISO yyyy-mm-dd from a Date.
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // Bucket all entries by their followUpDate string. Skip entries
  // with no date — they don't belong on a calendar anyway.
  const byDate = useMemo(() => {
    const map = new Map<string, OutreachEntry[]>()
    for (const e of entries) {
      if (!e.followUpDate) continue
      const list = map.get(e.followUpDate) ?? []
      list.push(e)
      map.set(e.followUpDate, list)
    }
    return map
  }, [entries])

  // Build the grid: full weeks (Sunday-start) covering the view month.
  // Includes leading days from the previous month + trailing days from
  // the next month so every row has 7 cells.
  const gridDays = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay())
    const lastOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
    const end = new Date(lastOfMonth)
    end.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()))
    const out: Date[] = []
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
      out.push(new Date(d))
    }
    return out
  }, [viewMonth])

  const todayIsoStr = toIso(new Date())
  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const totalThisMonth = entries.filter(e => {
    const d = parseLocalDate(e.followUpDate)
    return d && d.getFullYear() === viewMonth.getFullYear() && d.getMonth() === viewMonth.getMonth()
  }).length

  // Bucket → tailwind color class for the dot. Mirrors the High /
  // Medium / Low convention in the list view.
  function dotClass(e: OutreachEntry, dayIsoForBucket: string): string {
    if (e.status === 'No Response') return 'bg-purple-500'
    const d = parseLocalDate(e.followUpDate)
    if (!d) return 'bg-gray-500'
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const dayDate = parseLocalDate(dayIsoForBucket)
    if (!dayDate) return 'bg-gray-500'
    const diffDays = Math.round((dayDate.getTime() - today.getTime()) / 86_400_000)
    if (diffDays <= 0) return 'bg-red-500'
    if (diffDays <= 7) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <div className="space-y-4">
      {/* HEADER — month nav + count summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
            }
            className="w-8 h-8 rounded-md border border-border text-muted-foreground hover:border-purple-500/50 hover:text-foreground transition-colors flex items-center justify-center"
            aria-label="Previous month"
          >
            ‹
          </button>
          <h2 className="text-base font-semibold text-foreground tabular-nums w-44 text-center">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={() =>
              setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
            }
            className="w-8 h-8 rounded-md border border-border text-muted-foreground hover:border-purple-500/50 hover:text-foreground transition-colors flex items-center justify-center"
            aria-label="Next month"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date()
              setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))
              setSelectedIso(toIso(today))
            }}
            className="ml-1 px-2.5 py-1 text-[11px] rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-purple-500/40 transition-colors"
          >
            Today
          </button>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {totalThisMonth} follow-up{totalThisMonth === 1 ? '' : 's'} this month
        </div>
      </div>

      {/* DAY-OF-WEEK HEADERS */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div
            key={d}
            className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground text-center py-1.5"
          >
            {d}
          </div>
        ))}
      </div>

      {/* MONTH GRID */}
      <div className="grid grid-cols-7 gap-1">
        {gridDays.map(d => {
          const iso = toIso(d)
          const dayEntries = byDate.get(iso) ?? []
          const inMonth = d.getMonth() === viewMonth.getMonth()
          const isToday = iso === todayIsoStr
          const isSelected = iso === selectedIso

          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedIso(prev => (prev === iso ? null : iso))}
              className={`relative min-h-[72px] rounded-md border text-left p-1.5 transition-colors flex flex-col ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/10'
                  : isToday
                  ? 'border-purple-500/50 bg-purple-500/5 hover:bg-purple-500/10'
                  : inMonth
                  ? 'border-border bg-card/40 hover:bg-card/80'
                  : 'border-border/40 bg-transparent text-muted-foreground/50 hover:bg-card/20'
              }`}
              aria-label={`${d.toDateString()} — ${dayEntries.length} follow-up${dayEntries.length === 1 ? '' : 's'}`}
            >
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  isToday ? 'text-purple-500 font-bold' : ''
                }`}
              >
                {d.getDate()}
              </span>
              {dayEntries.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 items-start">
                  {dayEntries.slice(0, 3).map(e => (
                    <span
                      key={e.id}
                      className={`w-1.5 h-1.5 rounded-full ${dotClass(e, iso)}`}
                      aria-hidden
                    />
                  ))}
                  {dayEntries.length > 3 && (
                    <span className="text-[9px] font-bold text-muted-foreground leading-none">
                      +{dayEntries.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* SELECTED DAY SHEET */}
      {selectedIso && (
        <FollowUpDaySheet
          dateIso={selectedIso}
          entries={byDate.get(selectedIso) ?? []}
          onClose={() => setSelectedIso(null)}
          onOpenEntry={onOpenEntry}
          profile={profile}
        />
      )}

      {/* LEGEND */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Overdue / today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500" /> Due this week
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Future
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" /> Ghosted (No Response)
        </span>
      </div>
    </div>
  )
}

/**
 * Expanded "details for this day" panel that drops below the calendar
 * grid when the user clicks a day with follow-ups. Shows each lead
 * with quick-action buttons (email / IG / LinkedIn) and an "Open
 * details" button that fires onOpenEntry → LeadDetailModal.
 */
function FollowUpDaySheet({
  dateIso,
  entries,
  onClose,
  onOpenEntry,
  profile,
}: {
  dateIso: string
  entries: OutreachEntry[]
  onClose: () => void
  onOpenEntry: (id: string) => void
  profile: UserProfile | null
}) {
  const dateLabel = (() => {
    const d = parseLocalDate(dateIso)
    if (!d) return dateIso
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  })()
  return (
    <section className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
      <header className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {dateLabel}
          <span className="ml-2 text-muted-foreground font-normal">
            · {entries.length} follow-up{entries.length === 1 ? '' : 's'}
          </span>
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg leading-none px-1"
          aria-label="Close day"
        >
          ×
        </button>
      </header>
      {entries.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">
          No follow-ups scheduled for this day.
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map(e => {
            const igHandle = e.instagram?.replace('@', '').trim()
            const igUrl = igHandle ? `https://instagram.com/${igHandle}` : null
            const emailHref = e.email
              ? buildOutreachEmail(
                  {
                    channelName: e.channelName,
                    email: e.email,
                    videoTitles: [],
                    description: e.description,
                  } as unknown as Creator,
                  profile,
                  e.trackingId,
                )
              : null
            return (
              <li
                key={e.id}
                className="rounded-lg border border-border bg-card/40 p-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={e.channelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline truncate"
                    >
                      {e.channelName || 'Unnamed'}
                    </a>
                    <span
                      className={`text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border ${
                        e.status === 'Open'
                          ? 'border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-500/10'
                          : e.status === 'No Response'
                          ? 'border-purple-500/40 text-purple-700 dark:text-purple-400 bg-purple-500/10'
                          : 'border-border text-muted-foreground bg-muted'
                      }`}
                    >
                      {e.status || 'Not Outreached'}
                    </span>
                    {/* Date-state pill — same wording the List view shows
                        (Overdue by 3d / Due today / Follow up in 15d /
                        Ghosted) so calendar rows carry the same context.
                        Computed inline because the day sheet doesn't have
                        access to OutreachFollowUps's bucketOf closure. */}
                    {(() => {
                      const today = new Date(); today.setHours(0, 0, 0, 0)
                      const DAY = 86_400_000
                      const reached = parseLocalDate(e.dateReachedOut)
                      const reachedDays = reached
                        ? Math.round((today.getTime() - reached.getTime()) / DAY)
                        : null
                      // Mirrors the 30d ghosted threshold in the List view.
                      const ghosted =
                        e.status === 'No Response' && (reachedDays === null || reachedDays >= 30)
                      let label = 'No follow-up set'
                      let tone = 'border-border text-muted-foreground bg-muted/40'
                      if (ghosted) {
                        label = 'Ghosted'
                        tone = 'border-purple-500/40 text-purple-700 dark:text-purple-300 bg-purple-500/10'
                      } else {
                        const fu = parseLocalDate(e.followUpDate)
                        if (fu) {
                          fu.setHours(0, 0, 0, 0)
                          const diffDays = Math.round((fu.getTime() - today.getTime()) / DAY)
                          if (diffDays < 0) {
                            label = `Overdue by ${Math.abs(diffDays)}d`
                            tone = 'border-red-500/40 text-red-700 dark:text-red-300 bg-red-500/10'
                          } else if (diffDays === 0) {
                            label = 'Due today'
                            tone = 'border-red-500/40 text-red-700 dark:text-red-300 bg-red-500/10'
                          } else if (diffDays <= 7) {
                            label = `Follow up in ${diffDays}d`
                            tone = 'border-amber-500/40 text-amber-700 dark:text-yellow-300 bg-amber-500/10'
                          } else {
                            label = `Follow up in ${diffDays}d`
                            tone = 'border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-500/10'
                          }
                        }
                      }
                      return (
                        <span
                          className={`text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border ${tone}`}
                        >
                          {label}
                        </span>
                      )
                    })()}
                  </div>
                  {/* "Last followed up" chip — added per Dylan 2026-05-10
                      as a distinct visual element from the existing
                      status/date pills. markFollowedUp() updates
                      dateReachedOut on every manual follow-up, and the
                      cron stamps last_auto_followup_at — so the most
                      recent touch is max of those two. Touchpoints=0
                      means "reached but never followed up yet" — show
                      "Reached Xd ago" instead. */}
                  {(() => {
                    const tps = parseInt(e.touchpoints || '0', 10) || 0
                    const reachedTs = e.dateReachedOut ? parseLocalDate(e.dateReachedOut)?.getTime() ?? 0 : 0
                    const autoFuTs = e.lastAutoFollowupAt ?? 0
                    const lastTouchTs = Math.max(reachedTs, autoFuTs)
                    if (!lastTouchTs) return null
                    const daysSince = Math.round((Date.now() - lastTouchTs) / 86_400_000)
                    const label = tps >= 1 ? `Last followed up ${daysSince}d ago` : `Reached ${daysSince}d ago`
                    return (
                      <span className="inline-block mt-1.5 text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                        {label}
                      </span>
                    )
                  })()}
                  {/* Subtitle — medium + added-at context. The "last
                      touched" date moved out of here into the chip above. */}
                  <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-2">
                    {e.medium && <span>via {e.medium}</span>}
                    {!!e.addedAt && <span>· Added {formatAddedAtRelative(e.addedAt)}</span>}
                  </div>
                  {e.notes && (
                    <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {e.notes}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {emailHref && (
                    <a
                      href={emailHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={ev => {
                        if (!guardOutreachClick(ev, e.email, profile?.userEmail)) return
                        const content = buildOutreachContent(
                          { channelName: e.channelName, email: e.email, videoTitles: [], description: e.description } as unknown as Creator,
                          profile,
                          undefined,
                        )
                        maybeOpenUnipileSend(ev, profile, {
                          entryId: e.id,
                          to: e.email,
                          subject: content.subject,
                          body: content.body,
                          recipientLabel: e.channelName,
                        })
                      }}
                      title="Send outreach. If Gmail is connected via Unipile, opens preview modal; otherwise opens your Gmail compose."
                      className="text-[11px] font-medium px-2.5 py-1 rounded border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      📧 Email
                    </a>
                  )}
                  {igUrl && (
                    <a
                      href={igUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => copyInstagramDm(e.channelName)}
                      title="Open Instagram + copy DM template to clipboard"
                      className="text-[11px] font-medium px-2.5 py-1 rounded border border-pink-500/40 text-pink-700 dark:text-pink-400 hover:bg-pink-500/10 transition-colors inline-flex items-center gap-1"
                    >
                      {/* Actual Instagram logo (camera-square outline +
                          lens circle + corner dot). Replaces the
                          generic 📸 emoji per Dylan 2026-05-10 — the
                          emoji rendered differently on every platform
                          (Apple's was particularly off-brand). */}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                      </svg>
                      IG DM
                    </a>
                  )}
                  {e.linkedin && (
                    <a
                      href={e.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => copyLinkedInMessage(e.channelName)}
                      title="Open LinkedIn + copy message template to clipboard"
                      className="text-[11px] font-medium px-2.5 py-1 rounded border border-blue-500/40 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    >
                      in LinkedIn
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenEntry(e.id)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded border border-purple-500/40 text-purple-700 dark:text-purple-400 hover:bg-purple-500/10 transition-colors"
                  >
                    Open details →
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
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
  const accentText = { red: 'text-red-700 dark:text-red-300', yellow: 'text-amber-800 dark:text-yellow-300', blue: 'text-blue-700 dark:text-blue-300', green: 'text-emerald-700 dark:text-emerald-300' }[accent]
  const accentBorder = { red: 'border-red-200 dark:border-red-500/40', yellow: 'border-amber-200 dark:border-yellow-500/40', blue: 'border-blue-200 dark:border-blue-500/30', green: 'border-emerald-200 dark:border-emerald-500/30' }[accent]
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

// Inline pipeline value editor for the follow-ups row. Click → input
// appears, type a number, blur or Enter to save. Empty zero shows a
// faint $ placeholder so the click target is always there.
/**
 * Slide-out modal shell with hardened close behavior:
 *   - Click anywhere on the backdrop (left half of screen) → close.
 *   - Hit Escape from anywhere → close.
 *   - Click inside the panel content does NOT close (event stop).
 *   - Body scroll locked while open so the page underneath doesn't
 *     jump when the user mouses past the panel.
 *
 * Replaces the prior bare `<div onClick={close}>` backdrop pattern
 * which was missing keyboard support and was vulnerable to click
 * propagation issues. Used by the Analytics Customize panel; can
 * wrap other slide-outs the same way.
 */
function AnalyticsCustomizeShell({
  onClose,
  children,
}: {
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Lock body scroll while the panel is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        className="flex-1 bg-black/50 cursor-pointer"
      />
      {/* Stop click propagation INSIDE the panel so the backdrop
          click doesn't fire when the user interacts with controls. */}
      <div onClick={e => e.stopPropagation()} className="flex">
        {children}
      </div>
    </div>
  )
}

/**
 * Inline email editor that appears as a small "Edit" link by default,
 * then swaps in a textarea on click. Hides itself again on blur or
 * when the user hits Enter / Escape. Keeps the row compact in its
 * default state — the green clickable email link above is the
 * primary read affordance, this is just the rare "edit" path.
 */
function EmailEditToggle({
  email,
  onChange,
}: {
  email: string
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(email)

  // Keep the draft in sync if the parent value changes while we're
  // not actively editing (e.g. a deep-search result lands).
  useEffect(() => {
    if (!editing) setDraft(email)
  }, [email, editing])

  function commit() {
    const next = draft.trim()
    if (next !== email) onChange(next)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(email)
          setEditing(true)
        }}
        title="Edit email — replace, fix a typo, or paste a different address"
        className="self-start text-[10px] text-muted-foreground hover:text-foreground border border-border hover:border-purple-500/40 rounded px-1.5 py-0.5 transition-colors inline-flex items-center gap-1"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Edit email
      </button>
    )
  }

  return (
    <input
      type="email"
      autoFocus
      value={draft}
      onChange={ev => setDraft(ev.target.value)}
      onBlur={commit}
      onKeyDown={ev => {
        if (ev.key === 'Enter') {
          ev.preventDefault()
          commit()
        } else if (ev.key === 'Escape') {
          setDraft(email)
          setEditing(false)
        }
      }}
      placeholder="email@domain.com"
      className="bg-muted border border-purple-500/40 rounded px-2 py-0.5 text-xs text-foreground focus:outline-none focus:border-purple-500 w-full"
    />
  )
}

function PipelineChip({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const num = parseFloat(String(value || '').replace(/[^0-9.]/g, '')) || 0
  useEffect(() => { setDraft(value) }, [value])
  function commit() {
    const cleaned = draft.replace(/[^0-9.]/g, '')
    const display = cleaned ? `$${parseFloat(cleaned).toLocaleString()}` : ''
    onChange(display)
    setEditing(false)
  }
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { commit() }
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        placeholder="0"
        className="text-[10px] font-mono px-1.5 py-px rounded bg-card border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 w-20 focus:outline-none shrink-0"
      />
    )
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className={`text-[10px] font-mono px-1.5 py-px rounded border shrink-0 transition-colors ${num > 0
        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-300'
        : 'bg-muted/30 text-muted-foreground/60 border-border hover:border-border/80 hover:text-emerald-700 dark:hover:text-emerald-300'}`}
      title={num > 0 ? 'Pipeline value — click to edit' : 'Add pipeline $ — click to enter a value'}
    >
      {num > 0 ? `$${num.toLocaleString()}` : '$0'}
    </button>
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
    red: 'border-red-200 dark:border-red-500/30', yellow: 'border-amber-200 dark:border-yellow-500/30', blue: 'border-border',
    green: 'border-emerald-200 dark:border-emerald-500/30', gray: 'border-border',
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

function FollowUpRow({ entry: e, bucket, onUpdate, onSnooze, onMarkFollowedUp, onOpen, profile }: {
  entry: OutreachEntry
  bucket: FUBucket
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onSnooze: (e: OutreachEntry, days: number) => void
  onMarkFollowedUp: (e: OutreachEntry, opts?: { date?: string; status?: string }) => void
  onOpen: (id: string) => void
  /** Profile drives the compose URL (mailClient + authuser hint). */
  profile: UserProfile | null
}) {
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)
  const [followedUpOpen, setFollowedUpOpen] = useState(false)
  // Single vs double-click detector for the "Followed up" button.
  // Single click → opens the popover (manual cadence + status pick).
  // Double click → applies the user's last-saved cadence + status
  // immediately, no popover. First-time double-click before any
  // manual choice falls back to the default cadence.
  const followedUpClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    red: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40',
    yellow: 'bg-amber-50 dark:bg-yellow-500/15 text-amber-800 dark:text-yellow-300 border-amber-200 dark:border-yellow-500/40',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
    gray: 'bg-muted/30 text-muted-foreground border-border',
  }[accent]

  // Smart date label per bucket. Self-explanatory wording per Dylan's
  // 2026-05-10 feedback ("'15d' alone doesn't tell you whether it's till
  // next follow-up or since last contact"). Every label now includes the
  // semantic — "Follow up in Xd" / "Overdue by Xd" / "Due today" — so the
  // pill stands alone.
  const dateLabel = (() => {
    if (bucket === 'ghosted') return 'Ghosted'
    if (bucket === 'unset') return 'No follow-up set'
    const days = daysFromNow(e.followUpDate)
    if (bucket === 'high') {
      // Either overdue or due today — daysFromNow returns 0 for both, so we
      // need to check directly with parseLocalDate.
      const d = parseLocalDate(e.followUpDate)
      if (d) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        d.setHours(0, 0, 0, 0)
        if (d.getTime() < today.getTime()) return `Overdue by ${daysAgo(e.followUpDate)}`
      }
      return 'Due today'
    }
    return `Follow up in ${days}d`
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

        {/* Identity + stage + indicators.
            Refactored 2026-05-09: the channel name is its own
            click-to-open-detail button. The email / LinkedIn icons
            live OUTSIDE that button as separate clickable links so
            users can fire the compose URL directly without having
            to open the detail modal first. Favorite icon stays
            inert (just a status indicator). */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpen(e.id)}
              className="text-[12px] font-medium text-foreground truncate text-left hover:underline"
              title="Open lead details"
            >
              {e.channelName}
            </button>
            {e.favorite && (
              <Star
                className="w-3 h-3 text-amber-700 dark:text-yellow-400 shrink-0 fill-current"
                aria-label="Favorited"
              />
            )}
            {e.email && (
              <a
                href={buildOutreachEmail(
                  {
                    channelName: e.channelName,
                    email: e.email,
                    videoTitles: [],
                    description: e.description,
                  } as unknown as Creator,
                  profile,
                  e.trackingId,
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => {
                  ev.stopPropagation()
                  if (!guardOutreachClick(ev, e.email, profile?.userEmail)) return
                  const content = buildOutreachContent(
                    { channelName: e.channelName, email: e.email, videoTitles: [], description: e.description } as unknown as Creator,
                    profile,
                    undefined,
                  )
                  maybeOpenUnipileSend(ev, profile, {
                    entryId: e.id,
                    to: e.email,
                    subject: content.subject,
                    body: content.body,
                    recipientLabel: e.channelName,
                  })
                }}
                title={`Send outreach to ${e.email}. If Gmail is connected via Unipile, opens preview modal; otherwise opens your Gmail compose.`}
                aria-label={`Email ${e.email}`}
                className="inline-flex items-center text-emerald-700 dark:text-emerald-400/80 hover:text-emerald-500 transition-colors shrink-0"
              >
                <Mail className="w-3 h-3" />
              </a>
            )}
            {e.linkedin && (
              <a
                href={e.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => ev.stopPropagation()}
                title="Open LinkedIn"
                className="text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:text-blue-500 shrink-0 transition-colors"
              >
                in
              </a>
            )}
          </div>
          <button
            onClick={() => onOpen(e.id)}
            className="text-[10px] text-muted-foreground truncate text-left w-full hover:text-foreground/80 transition-colors"
            title="Open lead details"
          >
            <span className="text-foreground/80">{stageHint}</span>
            {e.medium && <span> · via {e.medium}</span>}
            {e.addedAt && <span> · Added {formatAddedAtRelative(e.addedAt)}</span>}
          </button>
          {/* "Last followed up" chip — added per Dylan 2026-05-10 as a
              distinct visual element. markFollowedUp() updates
              dateReachedOut on every manual follow-up; the cron stamps
              last_auto_followup_at. Take max of both for the most
              recent touch. Touchpoints=0 means "reached but never
              followed up yet" — show "Reached Xd ago" instead. */}
          {(() => {
            const reachedTs = e.dateReachedOut ? parseLocalDate(e.dateReachedOut)?.getTime() ?? 0 : 0
            const autoFuTs = e.lastAutoFollowupAt ?? 0
            const lastTouchTs = Math.max(reachedTs, autoFuTs)
            if (!lastTouchTs) return null
            const daysSince = Math.round((Date.now() - lastTouchTs) / 86_400_000)
            const label = tps >= 1 ? `Last followed up ${daysSince}d ago` : `Reached ${daysSince}d ago`
            return (
              <span className="inline-block mt-1 text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                {label}
              </span>
            )
          })()}
        </div>

        {/* Pipeline value chip — inline editable. Click the chip to type
            a new value. Empty / zero shows a faint $ placeholder. */}
        <PipelineChip
          value={e.dealValue || ''}
          onChange={v => onUpdate(e.id, 'dealValue', v)}
        />

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
              {/* Primary action — single click opens manual popover,
                  double click applies the last-saved cadence + status
                  immediately. The setTimeout-based detector defers
                  the single-click action by 250ms so a fast second
                  click can pre-empt it cleanly. */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (followedUpClickTimerRef.current) {
                      // Second click within the 250ms window → double click
                      clearTimeout(followedUpClickTimerRef.current)
                      followedUpClickTimerRef.current = null
                      // Read last-saved cadence + status from localStorage.
                      // Fallback to the smart cadence + current status when
                      // the user hasn't manually confirmed any follow-up yet.
                      const savedDays = (() => {
                        if (typeof window === 'undefined') return null
                        const v = parseInt(localStorage.getItem('followedUp:lastCadenceDays') || '', 10)
                        return Number.isFinite(v) && v > 0 && v < 365 ? v : null
                      })()
                      const savedStatus = typeof window !== 'undefined'
                        ? localStorage.getItem('followedUp:lastStatus') || ''
                        : ''
                      const days = savedDays ?? nextFollowUpDays(tps + 1)
                      const status = savedStatus || e.status || 'Open'
                      onMarkFollowedUp(e, {
                        date: isoDaysFromNow(days),
                        status,
                      })
                      return
                    }
                    // First click — defer the popover open in case a
                    // second click follows.
                    followedUpClickTimerRef.current = setTimeout(() => {
                      followedUpClickTimerRef.current = null
                      setFollowedUpOpen(v => !v)
                    }, 250)
                  }}
                  title="Single click: pick next date + status manually. Double click: apply your last-used cadence (defaults to the smart cadence the first time)."
                  className="text-[10px] font-medium text-purple-800 dark:text-purple-200 hover:text-foreground bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded px-2 py-0.5 transition-colors"
                >
                  Followed up
                </button>
                {followedUpOpen && (
                  <FollowedUpPopover
                    touchpoints={tps}
                    currentStatus={e.status}
                    onConfirm={({ date, status }) => {
                      // Persist the user's manual choice so the next
                      // double-click on any row in this browser uses
                      // these values. Days is computed from today —
                      // local-time, not UTC, to match the date input.
                      if (typeof window !== 'undefined' && date) {
                        const today = new Date(); today.setHours(0, 0, 0, 0)
                        const picked = parseLocalDate(date)
                        if (picked) {
                          picked.setHours(0, 0, 0, 0)
                          const days = Math.round((picked.getTime() - today.getTime()) / 86_400_000)
                          if (days > 0 && days < 365) {
                            localStorage.setItem('followedUp:lastCadenceDays', String(days))
                          }
                        }
                        if (status) localStorage.setItem('followedUp:lastStatus', status)
                      }
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

// (parseLocalDate / todayIso / isoDaysFromNow / daysAgo / daysFromNow
//  moved to lib/dates.ts — pure local-time date helpers shared with
//  follow-up cadence math. See top-of-file imports.)

/**
 * Right-click / two-finger-click context menu rendered when the user
 * triggers contextmenu on a column header in either table. Tiny
 * popover positioned at the click coordinates with two actions:
 *
 *   - Hide column     → flips visible=false on the matching colConfig
 *                       entry. Disabled for "favorite" (locked col).
 *   - Customize…      → opens the table's full customize modal so the
 *                       user can re-show / reorder later.
 *
 * Click anywhere outside or hit Escape to dismiss.
 */
function ColumnContextMenu({
  x,
  y,
  label,
  canHide,
  canMoveLeft,
  canMoveRight,
  onHide,
  onMoveLeft,
  onMoveRight,
  onCustomize,
  onClose,
}: {
  x: number
  y: number
  label: string
  canHide: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onHide: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onCustomize: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onMouseDown = () => onClose()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // Defer the listener registration by one tick so the same click
    // event that opened the menu doesn't immediately dismiss it.
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Clamp the menu inside the viewport — prevents the popover
  // overflowing off the right edge when the user right-clicks the
  // last column.
  const MENU_WIDTH = 220
  // Height bumped to fit the new "Move left / Move right" rows. The
  // viewport-clamp below uses this to keep the menu fully on-screen
  // when the header is near the bottom edge.
  const MENU_HEIGHT = 180
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768
  const left = Math.min(x, viewportW - MENU_WIDTH - 8)
  const top = Math.min(y, viewportH - MENU_HEIGHT - 8)

  return (
    <div
      role="menu"
      onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', left, top, width: MENU_WIDTH }}
      className="z-50 rounded-lg border border-border bg-card shadow-2xl shadow-black/30 overflow-hidden"
    >
      <div className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground border-b border-border truncate">
        {label}
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          if (!canMoveLeft) return
          onMoveLeft()
          onClose()
        }}
        disabled={!canMoveLeft}
        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Move left
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          if (!canMoveRight) return
          onMoveRight()
          onClose()
        }}
        disabled={!canMoveRight}
        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 border-t border-border"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
        Move right
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          if (!canHide) return
          onHide()
          onClose()
        }}
        disabled={!canHide}
        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 border-t border-border"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        Hide column
      </button>
      <button
        type="button"
        onClick={() => {
          onCustomize()
          onClose()
        }}
        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted border-t border-border transition-colors flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Customize columns…
      </button>
    </div>
  )
}

// (filterOutreachByKeyword / nextFollowUpDays / followUpStageLabel
//  moved to lib/outreach.ts; daysAgo + daysFromNow moved to lib/dates.ts.
//  See top-of-file imports.)

function OutreachAnalytics({ entries, customMetrics, onOpenCustomize, onExportExcel, onExportCsv }: {
  entries: OutreachEntry[]
  customMetrics: import('@/lib/types').CustomMetric[]
  onOpenCustomize: () => void
  /** Export the underlying outreach list — same handlers the Outreach
   *  table uses, just surfaced from the Analytics tab too so a user
   *  reading the metrics can export without switching tabs. */
  onExportExcel: () => void
  onExportCsv: () => void
}) {
  // Settings gear popover state (Customize Analytics + Export entries).
  // Click-outside / Escape closes — same UX pattern as the Results /
  // Outreach tab's settings gear.
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showSettings) return
    function onClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowSettings(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [showSettings])
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
        {/* Single Settings gear consolidating Customize + Export.
            Same pattern as the Results / Outreach tab settings gear:
            click → small popover; click outside or hit Escape → closes.
            Click-outside is bulletproof here (no slide-out modal that
            could trap focus) so this is the smoother UX Dylan wanted. */}
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            onClick={() => setShowSettings(v => !v)}
            title="Analytics settings — customize metrics or export"
            aria-label="Analytics settings"
            aria-expanded={showSettings}
            className={`flex items-center justify-center w-8 h-8 rounded-md border transition-colors ${
              showSettings
                ? 'border-border bg-muted/60 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-border/80'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {showSettings && (
            <div className="absolute right-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-2xl shadow-black/30 z-30 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  onOpenCustomize()
                  setShowSettings(false)
                }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-b border-border/60"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h13M3 12h13M3 18h7" />
                </svg>
                Customize metrics
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportExcel()
                  setShowSettings(false)
                }}
                disabled={entries.length === 0}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-base leading-none">📊</span>
                Export Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportCsv()
                  setShowSettings(false)
                }}
                disabled={entries.length === 0}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-t border-border/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-base leading-none">📄</span>
                Export CSV
              </button>
            </div>
          )}
        </div>
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

function OutreachTab({ entries, colConfig, onUpdate, onRemove, onOpenCustomize, onReorderCols, onOpenManualAdd, onSearchContacts, searchingIds, onSearchAll, bulkRunning, profile, emptyVariant, onOpenEntry, recentlyAddedIds, onClearRecentlyAdded, interactedNewIds, onMarkNewInteracted }: {
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
  onOpenEntry?: (id: string) => void
  /** IDs of entries to pin to the top regardless of sort. Lives in the
   *  parent so it survives this component remounting on tab switch. */
  recentlyAddedIds: Set<string>
  /** Called when the user clicks a column header — parent clears the
   *  pin so user-driven sort takes precedence. */
  onClearRecentlyAdded: () => void
  /** Subset of recentlyAddedIds whose purple highlight has already
   *  been dismissed by user click. The row stays pinned but loses the
   *  visual flair. */
  interactedNewIds: Set<string>
  /** Called once the first time the user clicks anywhere on a
   *  pinned-new row. Parent records the id so the highlight stops
   *  rendering on subsequent re-renders. */
  onMarkNewInteracted: (id: string) => void
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

  // recentlyAddedIds + onClearRecentlyAdded come in as props from
  // HomePage now (see comment on the parent state). Lifting fixed the
  // bug where switching Results → Outreach unmounted this component
  // and reset the pin set, hiding newly-added rows.

  // Right-click context menu state for column-header "Hide column"
  // affordance. One menu at a time across the table — opening on a
  // different header replaces the previous menu, which is what users
  // expect from native context menus.
  const [headerMenu, setHeaderMenu] = useState<{
    colId: keyof OutreachEntry
    label: string
    x: number
    y: number
  } | null>(null)
  const [showFavTooltip, setShowFavTooltip] = useState(false)
  const favTooltipRef = useRef<HTMLDivElement>(null)
  const [showStatusTooltip, setShowStatusTooltip] = useState(false)
  const statusTooltipRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onClick(ev: MouseEvent) {
      if (favTooltipRef.current && !favTooltipRef.current.contains(ev.target as Node)) {
        setShowFavTooltip(false)
      }
      if (statusTooltipRef.current && !statusTooltipRef.current.contains(ev.target as Node)) {
        setShowStatusTooltip(false)
      }
    }
    if (showFavTooltip || showStatusTooltip) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showFavTooltip, showStatusTooltip])

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
  // After sorting, recently-added rows are hoisted to the top in the order
  // they were added (regardless of the active sort) — see prevEntryIdsRef
  // useEffect above. The hoist is cleared whenever the user clicks a
  // column header.
  const sortedEntries = (() => {
    let result: OutreachEntry[]
    if (!sort.col) {
      result = entries
    } else {
      const col = sort.col
      const dir = sort.dir === 'asc' ? 1 : -1
      const numericCols: (keyof OutreachEntry)[] = ['avgViews', 'fitScore', 'addedAt', 'touchpoints']
      result = [...entries].sort((a, b) => {
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
    }
    // Hoist any recently-added rows. Within the pinned group, sort by
    // addedAt desc so the most recent is at the very top.
    if (recentlyAddedIds.size > 0) {
      const pinned = result
        .filter(e => recentlyAddedIds.has(e.id))
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      const rest = result.filter(e => !recentlyAddedIds.has(e.id))
      return [...pinned, ...rest]
    }
    return result
  })()

  function handleHeaderClick(colId: keyof OutreachEntry) {
    if (colId === 'favorite') return // Favorite header is the click-tooltip
    // Clearing the pin here is the "until refiltering happens" half of
    // the recently-added behavior. Once the user expresses a sort
    // intent, recently-added rows fall back into normal sort order.
    if (recentlyAddedIds.size > 0) onClearRecentlyAdded()
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
      <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-border">
        <table className="table-fixed text-sm border-collapse" style={{ width: totalWidth }}>
          <thead className="bg-card/95 backdrop-blur-md text-foreground/80 border-b border-border">
            <tr>
              {visibleCols.map((col, idx) => {
                const colId = col.id as string
                const isLocked = idx === 0
                const isOver = dragOverIdx === idx && !isLocked
                const ariaSort: 'ascending' | 'descending' | 'none' =
                  sort.col === col.id
                    ? (sort.dir === 'asc' ? 'ascending' : 'descending')
                    : 'none'
                return (
                  <th
                    key={colId}
                    scope="col"
                    aria-sort={ariaSort}
                    // Keyboard reachable. Tab moves through headers;
                    // Enter/Space sorts; Shift+F10 / ContextMenu key
                    // opens the column menu (Move left/right/Hide/
                    // Customize) — keyboard alternative to drag-to-
                    // reorder, satisfies WCAG 2.5.7. Locked column
                    // ('favorite') is not focusable since its menu
                    // would be no-op for everything but Hide-disabled.
                    tabIndex={isLocked ? -1 : 0}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        const target = e.target as HTMLElement
                        if (target.closest('[data-no-sort]')) return
                        e.preventDefault()
                        handleHeaderClick(col.id)
                        return
                      }
                      if (!isLocked && (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) {
                        e.preventDefault()
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setHeaderMenu({
                          colId: col.id,
                          label: col.label,
                          x: rect.left + 12,
                          y: rect.bottom + 4,
                        })
                      }
                    }}
                    onContextMenu={(e) => {
                      // Right-click / two-finger-click → "Hide column"
                      // popover. Suppress the browser's native menu.
                      e.preventDefault()
                      setHeaderMenu({
                        colId: col.id,
                        label: col.label,
                        x: e.clientX,
                        y: e.clientY,
                      })
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
                        {col.id === 'status' && (
                          <span
                            ref={statusTooltipRef}
                            className="relative inline-flex ml-1"
                            data-no-sort
                            onMouseEnter={() => setShowStatusTooltip(true)}
                            onMouseLeave={() => setShowStatusTooltip(false)}
                          >
                            <button
                              type="button"
                              data-no-sort
                              draggable={false}
                              onDragStart={(ev) => ev.preventDefault()}
                              onMouseDown={(e) => { e.stopPropagation() }}
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowStatusTooltip(v => !v) }}
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-purple-500/40 text-purple-700 dark:text-purple-400 text-[10px] font-bold hover:bg-purple-500/15 transition-colors leading-none"
                              aria-label="What does Status do?"
                              title="Status info — hover or click to see"
                            >i</button>
                            {showStatusTooltip && (
                              <div className="absolute left-0 top-6 z-30 w-80 rounded-lg border border-border bg-card shadow-xl p-3 text-xs text-foreground/80 normal-case font-normal space-y-2">
                                <div>
                                  <strong className="text-foreground">Status drives the Follow-ups tab.</strong> Each status maps to a state in your follow-up pipeline:
                                </div>
                                <ul className="space-y-1 ml-1">
                                  <li>
                                    <span className="text-muted-foreground">Not Outreached</span> — not on the follow-up board.
                                  </li>
                                  <li>
                                    <span className="text-amber-700 dark:text-yellow-400 font-medium">No Response</span> — sent, awaiting reply. Auto-schedules a follow-up date (3d → 7d → 14d → 21d as touchpoints accumulate).
                                  </li>
                                  <li>
                                    <span className="text-blue-700 dark:text-blue-400 font-medium">Open</span> — they replied positively, conversation is live. Stays on the follow-up board with a fresh date.
                                  </li>
                                  <li>
                                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">Successful</span> — closed/won. Drops off the follow-up board. Pops confetti 🎉.
                                  </li>
                                  <li>
                                    <span className="text-red-700 dark:text-red-400 font-medium">Rejected</span> — declined. Drops off the follow-up board.
                                  </li>
                                </ul>
                                <div className="text-[11px] text-muted-foreground italic pt-1 border-t border-border">
                                  Clicking the green email link sets status to <span className="text-amber-700 dark:text-yellow-400 font-medium">No Response</span> automatically — no manual change needed.
                                </div>
                              </div>
                            )}
                          </span>
                        )}
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
          {/*
            Per taste-skill Rule 4 "Anti-Card Overuse": at this density
            (>7), generic card containers BANNED. Each row used to be a
            zebra-striped card (bg-card/40 / bg-background). Replaced
            with divide-y rule lines + subtle hover wash. Reads tighter,
            more "operator dashboard" less "marketing card grid."
          */}
          <tbody className="divide-y divide-border">
            {sortedEntries.map((e, i) => {
              // Subtle highlight for newly-added rows. Stops rendering
              // on the first user click anywhere in the row (via the
              // onMouseDownCapture handler below) — the row stays
              // pinned at top until the next sort change, but the
              // visual flair fades so the table calms down once the
              // operator has acknowledged it.
              const isJustAdded = recentlyAddedIds.has(e.id) && !interactedNewIds.has(e.id)
              return (
              <AnimatedRow
                key={e.id}
                index={i}
                onMouseDownCapture={() => {
                  // Capture phase fires before any inner control's
                  // own click — guarantees the highlight fades on the
                  // first interaction even if the click lands on a
                  // dropdown or button cell. No-op if not currently
                  // pinned-new (cheap check inside the parent).
                  if (recentlyAddedIds.has(e.id) && !interactedNewIds.has(e.id)) {
                    onMarkNewInteracted(e.id)
                  }
                }}
                className={`transition-colors hover:bg-card/40 ${isJustAdded ? 'bg-purple-500/10 dark:bg-purple-500/15' : ''}`}
              >
                {visibleCols.map(col => (
                  <td key={col.id as string} className="px-3 py-2 align-top" style={{ width: widths[col.id as string] ?? col.defaultWidth }}>
                    {renderOutreachCell(col, e, onUpdate, profile, searchingIds.has(e.id), onSearchContacts)}
                  </td>
                ))}
                <td className="px-3 py-2 align-top whitespace-nowrap" style={{ width: 60 }}>
                  <div className="flex items-center gap-2">
                    {onOpenEntry && (
                      <button
                        onClick={() => onOpenEntry(e.id)}
                        className="text-muted-foreground/60 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                        title="Edit lead — open detail panel for full inline edits"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    <button onClick={() => onRemove(e.id)} className="text-muted-foreground/50 hover:text-red-700 dark:text-red-400 transition-colors" title="Remove from outreach"><TrashIcon /></button>
                  </div>
                </td>
              </AnimatedRow>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Context menu — right-click on any column header opens this. */}
      {headerMenu && (() => {
        // Compute move-left/right enablement against the visible
        // column ordering (the locked 'favorite' column stays at
        // index 0; user-visible columns start at index 1).
        const visibleIds = colConfig.filter(c => c.visible).map(c => c.id)
        const idx = visibleIds.indexOf(headerMenu.colId)
        const canMoveLeft = idx > 1 // can't move past the locked col 0
        const canMoveRight = idx >= 0 && idx < visibleIds.length - 1
        const swap = (delta: -1 | 1) => {
          const target = idx + delta
          if (target < 1 || target >= visibleIds.length) return
          const reordered = [...visibleIds]
          ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
          // Rebuild full colConfig: visible columns in new order, then hidden columns at the end.
          const visibleSet = new Set(reordered)
          const newConfig = [
            ...reordered.map(id => colConfig.find(c => c.id === id)!),
            ...colConfig.filter(c => !visibleSet.has(c.id)),
          ]
          onReorderCols(newConfig)
        }
        return (
          <ColumnContextMenu
            x={headerMenu.x}
            y={headerMenu.y}
            label={headerMenu.label}
            // 'favorite' is the locked leftmost column — can't hide it.
            canHide={headerMenu.colId !== 'favorite'}
            canMoveLeft={canMoveLeft}
            canMoveRight={canMoveRight}
            onMoveLeft={() => swap(-1)}
            onMoveRight={() => swap(1)}
            onHide={() => {
              const newConfig = colConfig.map(c =>
                c.id === headerMenu.colId ? { ...c, visible: false } : c,
              )
              onReorderCols(newConfig)
            }}
            onCustomize={onOpenCustomize}
            onClose={() => setHeaderMenu(null)}
          />
        )
      })()}
    </div>
  )
}

function CreatorTable({ creators, outreachIds, dismissedIds, onAddToOutreach, onDismiss, onReorderCols, loading, sorts, onSort, colConfig, loadMoreBatch, scoreWeights, scoreNarrative, activePlatform, totalUnfiltered, profile, onDeepSearch, deepSearchingIds, onDeepSearchAll, bulkRunning, emailFirst = true, onUpdateInstagram, onOpenCustomize }: {
  creators: Creator[], outreachIds: Set<string>, dismissedIds: Set<string>
  onAddToOutreach: (c: Creator) => void
  onDismiss: (c: Creator) => void
  onReorderCols: (newConfig: ColConfig[]) => void
  loading?: boolean
  sorts: SortKey[], onSort: (col: SortCol) => void
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
  emailFirst?: boolean
  /** Optional: when provided, the Instagram cell renders a "Find IG"
   *  button for creators where IG wasn't auto-resolved, plus a metrics
   *  badge that polls /api/instagram-status when an IG handle is known. */
  onUpdateInstagram?: (channelId: string, igUrl: string) => void
  /** Opens the parent's customize-columns modal. Surfaced via the
   *  right-click context menu on any column header. */
  onOpenCustomize?: () => void
}) {
  const { entries: guidanceEntries } = useContext(GuidanceContext)
  // Multi-key sort: pass the sorts array straight through to
  // sortCreators (which now accepts SortKey[] in its first overload).
  const sorted = useMemo(() => sortCreators(creators, sorts, 'desc', scoreWeights, guidanceEntries, emailFirst), [creators, sorts, scoreWeights, guidanceEntries, emailFirst])
  const visibleCols = colConfig.filter(c => c.visible)
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  // Right-click context menu state — same pattern as OutreachTab.
  const [headerMenu, setHeaderMenu] = useState<{
    colId: ColId
    label: string
    x: number
    y: number
  } | null>(null)
  // Fit Score column-header info popover. Position is calculated
  // from the icon's bounding rect on hover/click and rendered with
  // position:fixed so it ESCAPES the table's overflow-x-auto
  // clipping (the previous absolute-positioned version was getting
  // cut off and bouncing the table's scrollbars). Auto-clamps to the
  // viewport so it never falls off-screen.
  const [fitScoreTip, setFitScoreTip] = useState<{ x: number; y: number } | null>(null)
  function openFitScoreTip(target: HTMLElement) {
    const rect = target.getBoundingClientRect()
    const TIP_W = 320
    const TIP_H = 220
    const margin = 8
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    let x = rect.left
    let y = rect.bottom + 6
    if (x + TIP_W > viewportW - margin) x = viewportW - TIP_W - margin
    if (y + TIP_H > viewportH - margin) y = rect.top - TIP_H - 6 // flip above
    setFitScoreTip({ x: Math.max(margin, x), y: Math.max(margin, y) })
  }
  function closeFitScoreTip() {
    setFitScoreTip(null)
  }

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
    <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-card/95 backdrop-blur-md text-foreground/80 border-b border-border">
          <tr>
            <th className="px-2 py-3 text-center w-12" title="Dismiss — hide this creator from results">
              <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                <DismissIcon active={false} />
                <span className="text-[9px] font-semibold tracking-wide uppercase">Dismiss</span>
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
              // Current sort direction for this column, if any — drives
              // aria-sort so screen readers announce "ascending /
              // descending / none" alongside the column label.
              const currentSort = sc ? sorts.find(s => s.col === sc) : undefined
              const ariaSort: 'ascending' | 'descending' | 'none' = currentSort
                ? (currentSort.dir === 'asc' ? 'ascending' : 'descending')
                : 'none'
              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={sc ? ariaSort : undefined}
                  // Keyboard-reachable. Tab moves focus through column
                  // headers; Enter/Space sorts (when sortable);
                  // Shift+F10 or the ContextMenu key opens the column
                  // menu (Move left / right / Hide / Customize) —
                  // keyboard alternative to drag-to-reorder, satisfies
                  // WCAG 2.5.7.
                  tabIndex={0}
                  draggable
                  onDragStart={() => { dragIdx.current = idx }}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(idx) }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={e => { e.preventDefault(); handleColDrop(idx) }}
                  onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null) }}
                  onClick={() => sc && onSort(sc)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && sc) {
                      e.preventDefault()
                      onSort(sc)
                      return
                    }
                    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
                      e.preventDefault()
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setHeaderMenu({
                        colId: col.id,
                        label: col.label,
                        x: rect.left + 12,
                        y: rect.bottom + 4,
                      })
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setHeaderMenu({
                      colId: col.id,
                      label: col.label,
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }}
                  className={`text-left px-4 py-3 select-none whitespace-nowrap transition-colors ${sc ? 'cursor-grab hover:text-foreground' : ''} ${isOver ? 'border-l-2 border-blue-400 bg-muted' : ''}`}
                >
                  <span className="mr-1 text-muted-foreground/70 text-xs">⠿</span>
                  {col.label}
                  {sc && <SortIndicator col={sc} sorts={sorts} />}
                  {col.id === 'fitScore' && (
                    <span className="relative inline-flex ml-1.5 align-middle">
                      <button
                        type="button"
                        draggable={false}
                        onDragStart={(ev) => ev.preventDefault()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseEnter={(e) => openFitScoreTip(e.currentTarget)}
                        onMouseLeave={() => closeFitScoreTip()}
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          if (fitScoreTip) closeFitScoreTip()
                          else openFitScoreTip(e.currentTarget)
                        }}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-purple-500/40 text-purple-700 dark:text-purple-400 text-[10px] font-bold hover:bg-purple-500/15 transition-colors leading-none"
                        aria-label="What is Fit Score?"
                      >i</button>
                    </span>
                  )}
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
                  title="Dismiss — hide this creator from results"
                  aria-label={dismissedIds.has(c.channelId) ? `Undismiss ${c.channelName}` : `Dismiss ${c.channelName}`}
                  aria-pressed={dismissedIds.has(c.channelId)}
                  className={`transition-colors ${dismissedIds.has(c.channelId) ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground hover:text-red-700 dark:text-red-400'}`}
                >
                  <DismissIcon active={dismissedIds.has(c.channelId)} />
                </button>
              </td>
              <td className="px-2 py-3 text-center">
                <button
                  onClick={() => onAddToOutreach(c)}
                  title={outreachIds.has(c.channelId) ? 'Remove from Outreach' : 'Add to Outreach'}
                  aria-label={outreachIds.has(c.channelId) ? `Remove ${c.channelName} from outreach` : `Add ${c.channelName} to outreach`}
                  aria-pressed={outreachIds.has(c.channelId)}
                  className={`transition-colors ${outreachIds.has(c.channelId) ? 'text-purple-700 dark:text-purple-400' : 'text-muted-foreground hover:text-purple-700 dark:text-purple-400'}`}
                >
                  <PlusCircleIcon added={outreachIds.has(c.channelId)} />
                </button>
              </td>
              <td className="px-4 py-3"><a href={c.channelUrl} target="_blank" rel="noopener noreferrer" className="text-blue-800 dark:text-blue-400 hover:underline font-medium">{c.channelName}</a></td>
              {visibleCols.map(col => renderCell(col.id, c, scoreWeights, scoreNarrative, profile, deepSearchingIds.has(c.channelId), onDeepSearch, onUpdateInstagram))}
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
                      title="Dismiss — hide this creator from results"
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
                  {visibleCols.map(col => renderCell(col.id, c, scoreWeights, scoreNarrative, profile, deepSearchingIds.has(c.channelId), onDeepSearch, onUpdateInstagram))}
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>

      {/* Right-click context menu — same shared component used by
          OutreachTab. Hides the column, moves it left/right, or
          opens the customize modal. The Move-left/right entries are
          the keyboard alternative to drag-to-reorder (WCAG 2.5.7). */}
      {headerMenu && (() => {
        const visibleIds = colConfig.filter(c => c.visible).map(c => c.id)
        const idx = visibleIds.indexOf(headerMenu.colId)
        const canMoveLeft = idx > 0
        const canMoveRight = idx >= 0 && idx < visibleIds.length - 1
        const swap = (delta: -1 | 1) => {
          const target = idx + delta
          if (target < 0 || target >= visibleIds.length) return
          const reordered = [...visibleIds]
          ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
          const visibleSet = new Set(reordered)
          const newConfig = [
            ...reordered.map(id => colConfig.find(c => c.id === id)!),
            ...colConfig.filter(c => !visibleSet.has(c.id)),
          ]
          onReorderCols(newConfig)
        }
        return (
          <ColumnContextMenu
            x={headerMenu.x}
            y={headerMenu.y}
            label={headerMenu.label}
            canHide={true}
            canMoveLeft={canMoveLeft}
            canMoveRight={canMoveRight}
            onMoveLeft={() => swap(-1)}
            onMoveRight={() => swap(1)}
            onHide={() => {
              const newConfig = colConfig.map(c =>
                c.id === headerMenu.colId ? { ...c, visible: false } : c,
              )
              onReorderCols(newConfig)
            }}
            onCustomize={onOpenCustomize ?? (() => {})}
            onClose={() => setHeaderMenu(null)}
          />
        )
      })()}
      {/* Fit Score info popover — fixed-position so it escapes the
          table's overflow-x-auto clipping. Hover-on / hover-off via
          the icon's onMouseEnter / onMouseLeave; click toggles
          sticky. Width capped at 320px so the body doesn't wrap into
          a tall scrollable column. */}
      {fitScoreTip && (
        <div
          role="tooltip"
          onMouseEnter={() => { /* keep open while hovering the popover */ }}
          onMouseLeave={() => closeFitScoreTip()}
          style={{ position: 'fixed', left: fitScoreTip.x, top: fitScoreTip.y, width: 320 }}
          className="z-[60] rounded-lg border border-border bg-card shadow-2xl shadow-black/30 p-3.5 text-xs text-foreground/80 normal-case font-normal space-y-2"
        >
          <div>
            <strong className="text-foreground">Fit Score (0–100)</strong> — how well a creator matches your ideal-lead criteria. Higher = better fit.
          </div>
          <div className="text-muted-foreground">Computed from:</div>
          <ul className="space-y-1 ml-1 text-muted-foreground">
            <li>• <span className="text-foreground/90">Audience</span> — subs, avg views, last-uploaded recency.</li>
            <li>• <span className="text-foreground/90">Reachability</span> — has email + has socials.</li>
            <li>• <span className="text-foreground/90">Niche match</span> — keyword overlap between channel name / titles and your search terms.</li>
            <li>• <span className="text-foreground/90">Your guidance</span> — custom rules from the ⚡ panel.</li>
          </ul>
          <div className="text-[11px] text-muted-foreground italic pt-1 border-t border-border">
            Tweak weights via <span className="text-purple-700 dark:text-purple-400">⚡ Lead Criteria</span> — scores recompute live.
          </div>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const [keyword, setKeyword] = useState('')
  const maxResults = 100
  const [minViews, setMinViews] = useState(0)
  const [maxViews, setMaxViews] = useState(200000)
  const [minSubs, setMinSubs] = useState(0)
  const [maxSubs, setMaxSubs] = useState(0) // 0 = no upper limit
  // Default to 6 months — most current/active creators only. User
  // can widen via the Last Posted preset row in the filter panel.
  const [maxAgeDays, setMaxAgeDays] = useState<number>(180)
  // Niche filter for suggestions: null = all niches mixed.
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null)
  const [showNiches, setShowNiches] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 })
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState('')
  // Multi-column sort. Index 0 = highest priority (primary). Each
  // header click promotes that column to primary. Clicking the
  // already-primary column toggles direction. Clicking a column that
  // is already in the chain (but not primary) promotes it to primary.
  // To remove a column from the chain, click it past its second
  // direction (asc → desc → off). Default: fit score desc.
  const [sorts, setSorts] = useState<SortKey[]>([{ col: 'fitScore', dir: 'desc' }])

  /**
   * activeTab + outreachSubTab — persisted in the URL (`?tab=outreach&sub=followups`)
   * so refreshing the page keeps you on the same view. URL is source of
   * truth, lazily seeded on first read. We also sync back on every change
   * (replaceState — no extra history entry per click).
   *
   * Why URL over localStorage:
   *   • Shareable — a link to ?tab=outreach&sub=analytics takes someone
   *     directly to that view
   *   • Survives incognito + cross-device when you copy-paste
   *   • Plays nice with the browser's back/forward buttons
   */
  function readTabFromUrl(): { tab: ActiveTab; sub: 'all' | 'favorites' | 'analytics' | 'followups' } {
    if (typeof window === 'undefined') return { tab: 'results', sub: 'all' }
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    const s = params.get('sub')
    const tab: ActiveTab =
      t === 'outreach' || t === 'dismissed' || t === 'results' ? t : 'results'
    const sub: 'all' | 'favorites' | 'analytics' | 'followups' =
      s === 'favorites' || s === 'analytics' || s === 'followups' || s === 'all' ? s : 'all'
    return { tab, sub }
  }
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => readTabFromUrl().tab)
  const [outreachSubTab, setOutreachSubTab] = useState<'all' | 'favorites' | 'analytics' | 'followups'>(
    () => readTabFromUrl().sub,
  )

  // Sync state → URL on every change. replaceState (not pushState) so the
  // user's back button still goes back to where they came from on this site
  // rather than walking through every tab click.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    // Don't pollute the URL when on the default tab — only set the param
    // when the user has navigated to something other than the default.
    if (activeTab === 'results') params.delete('tab')
    else params.set('tab', activeTab)
    if (activeTab === 'outreach' && outreachSubTab !== 'all') {
      params.set('sub', outreachSubTab)
    } else {
      params.delete('sub')
    }
    const qs = params.toString()
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [activeTab, outreachSubTab])
  const [customMetrics, setCustomMetrics] = useState<import('@/lib/types').CustomMetric[]>([])
  const [editingMetric, setEditingMetric] = useState<import('@/lib/types').CustomMetric | null>(null)
  const [showAddMetric, setShowAddMetric] = useState(false)
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [viewingLeadId, setViewingLeadId] = useState<string | null>(null)
  const [showAnalyticsCustomize, setShowAnalyticsCustomize] = useState(false)
  const [draftMetrics, setDraftMetrics] = useState<import('@/lib/types').CustomMetric[]>([])
  const [outreach, setOutreach] = useState<OutreachEntry[]>([])
  const [outreachIds, setOutreachIds] = useState<Set<string>>(new Set())
  // Recently-added pin lives at the parent level so it survives the
  // OutreachTab unmount/remount that happens when the user toggles
  // between Results and Outreach tabs. Cleared on column-header sort
  // by OutreachTab via the onClearRecentlyAdded callback.
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<Set<string>>(new Set())
  // Subset of recentlyAddedIds that the user has already touched (any
  // click on the row). The purple highlight is only painted while a
  // row is in recentlyAddedIds AND NOT in this set — once you've
  // interacted with the new row, the highlight fades but the row
  // stays pinned at top until the next sort change.
  const [interactedNewIds, setInteractedNewIds] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  // Search mode pills (URL / Username / Occupation) on Results tab.
  // Auto-selected by classifySearchInput as the user types; user
  // clicks override and stick until keyword is cleared. Drives whether
  // the next search hits /api/lookup-channel (URL/Username) or
  // /api/search (Occupation), and powers the "no results → Search
  // similar" recovery pill.
  type SearchMode = 'url' | 'username' | 'occupation'
  const [searchMode, setSearchMode] = useState<SearchMode>('occupation')
  const [searchModeManual, setSearchModeManual] = useState(false)
  // Set to true after a targeted (URL/Username) search returns 0 hits
  // so we can render the "Search similar" recovery pill in the
  // empty-state spot.
  const [showSearchSimilar, setShowSearchSimilar] = useState(false)
  const [emailOnly, setEmailOnly] = useState(false)
  // Default sort prioritizes creators with email at the top. User can
  // toggle this off in the filter panel to see the raw column-only sort.
  const [emailFirstSort, setEmailFirstSort] = useState(true)
  const [showExport, setShowExport] = useState(false)
  // Ref + click-outside detection for the tab-nav Settings gear popover.
  // Auto-update search mode pill based on what the classifier sees
  // as the user types. Manual override (clicking a pill) sticks until
  // the keyword is cleared — at which point we drop back to auto.
  useEffect(() => {
    const trimmed = keyword.trim()
    if (!trimmed) {
      setSearchModeManual(false)
      setSearchMode('occupation') // default when empty
      setShowSearchSimilar(false) // clear recovery state on input clear
      return
    }
    if (searchModeManual) return
    const cls = classifySearchInput(trimmed)
    if (cls.kind === 'url') setSearchMode('url')
    else if (cls.kind === 'handle') setSearchMode('username')
    else setSearchMode('occupation')
  }, [keyword, searchModeManual])

  // Without this, the popover only closed by clicking the gear icon
  // again — clicking anywhere else left it stuck open.
  const exportMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showExport) return
    function onMouseDown(ev: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(ev.target as Node)) {
        setShowExport(false)
      }
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setShowExport(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showExport])
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
  // For niche-style searches, hold the underlying occupation list so
  // Load More can keep using the same multi-keyword expansion.
  const [currentKeywordsList, setCurrentKeywordsList] = useState<string[]>([])
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
  // Phase 2: Send-via-Unipile preview modal. Triggered by a CustomEvent
  // dispatched from the existing email-link click handlers when the
  // current user has a Unipile-connected Gmail. Falls back to the
  // compose-URL flow otherwise.
  const [sendPreview, setSendPreview] = useState<{
    entryId: string
    to: string
    subject: string
    body: string
    recipientLabel: string
  } | null>(null)
  const [unipileConnected, setUnipileConnected] = useState(false)
  // Phase 4: Conversation thread modal — opened by clicking the
  // 💬 icon on an outreach row that has a unipile_thread_id.
  const [threadModal, setThreadModal] = useState<{ entryId: string; label: string } | null>(null)
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
    // Per-platform metric columns to auto-show — IG today, more later
    // (TikTok / Twitter / LinkedIn would slot in here when we wire
    // those data sources). Comes from PLATFORM_AUTOSHOW_COLS in
    // lib/columns.ts so the platform-data plumbing stays in one
    // place.
    const autoShow = PLATFORM_AUTOSHOW_COLS[platformConfig.id] ?? []

    // For non-YouTube platforms: hide YouTube-only metrics, show & front-load the platform column
    let cols = colConfig.map(c => {
      if (!isYouTube && (c.id === 'avgViews' || c.id === 'subscribers' || c.id === 'lastVideo' || c.id === 'lastShort')) {
        return { ...c, visible: false }
      }
      if (platformConfig.column && c.id === platformConfig.column) {
        return { ...c, visible: true }
      }
      // Platform-specific auto-show columns (e.g. IG followers + posts
      // when activePlatform === 'instagram').
      if (autoShow.includes(c.id)) {
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
    // Move the auto-show metric columns right after the platform
    // column so the user sees them next to the handle they came from.
    if (autoShow.length > 0) {
      const insertAfter = cols.findIndex(c => c.id === platformConfig.column)
      const target = insertAfter >= 0 ? insertAfter + 1 : 0
      const moved: ColConfig[] = []
      for (const id of autoShow) {
        const idx = cols.findIndex(c => c.id === id)
        if (idx >= 0 && idx !== target + moved.length) {
          const [m] = cols.splice(idx, 1)
          moved.push(m)
        }
      }
      cols.splice(target, 0, ...moved)
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
          .select('full_name, linkedin_url, pitch_line, subject_template, mail_client, onboarded, timezone, unipile_account_id, unipile_account_email, unipile_connected_at')
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
            .select('full_name, linkedin_url, pitch_line, subject_template, mail_client, onboarded, timezone, unipile_account_id, unipile_account_email, unipile_connected_at')
            .single()
          profileRow = inserted
        }

        // Bump last_seen_at + auto-detect timezone on every load.
        //
        // last_seen_at: real "user is active" signal — auth's
        // last_sign_in_at only moves on re-authentication, so a
        // user with a valid session can be active daily and still
        // look idle in the admin dashboard. Backed by migration 0016.
        //
        // timezone: catches a user signing in from a new machine in a
        // different TZ. Backed by migration 0015. Cheap to write
        // unconditionally — it's a single TEXT column and we're
        // already writing the row.
        //
        // Failures non-fatal (e.g. a missing column on a not-yet-
        // migrated env): log + continue.
        try {
          const detectedTz =
            typeof Intl !== 'undefined'
              ? Intl.DateTimeFormat().resolvedOptions().timeZone || null
              : null
          const updates: Record<string, string> = {
            last_seen_at: new Date().toISOString(),
          }
          if (detectedTz && detectedTz !== profileRow?.timezone) {
            updates.timezone = detectedTz
          }
          await supabase
            .from('user_profile')
            .update(updates)
            .eq('user_id', user.id)
          if (profileRow && updates.timezone) profileRow.timezone = updates.timezone
        } catch (tzErr) {
          console.warn('[home-init] last_seen/timezone update failed:', tzErr)
        }

        if (profileRow) {
          setProfile({
            fullName: profileRow.full_name ?? '',
            linkedinUrl: profileRow.linkedin_url ?? '',
            pitchLine: profileRow.pitch_line ?? '',
            subjectTemplate: profileRow.subject_template ?? undefined,
            mailClient: (profileRow.mail_client ?? 'default') as UserProfile['mailClient'],
            // Auth email — used by composeUrl to pin the Gmail/Outlook
            // compose window to the right multi-account browser session.
            userEmail: user.email ?? undefined,
            unipileAccountId: profileRow.unipile_account_id ?? null,
            unipileAccountEmail: profileRow.unipile_account_email ?? null,
            unipileConnectedAt: profileRow.unipile_connected_at
              ? new Date(profileRow.unipile_connected_at).getTime()
              : null,
          })
          setUnipileConnected(!!profileRow.unipile_account_id)
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
        // Merge stored config with any new columns added since last
        // save. If a stored width is BELOW the current default, raise
        // it — we widen defaults occasionally for legibility (e.g. YT
        // 42 → 56) and existing users would otherwise stay clipped.
        const merged = ALL_OUTREACH_COLS.map(def => {
          const stored = storedOutreachCols.find(s => s.id === def.id)
          if (!stored) return { ...def, visible: def.defaultVisible, width: def.defaultWidth }
          const width = Math.max(stored.width, def.defaultWidth)
          return { ...def, visible: stored.visible, width }
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

  // Phase 2 send-via-Unipile bridge. Existing email-link click handlers
  // dispatch a `open-send-modal` CustomEvent with the prebuilt subject /
  // body / recipient when the user has a connected Unipile account.
  // We catch it here and open the SendPreviewModal — that way we don't
  // have to thread an onSendOutreach callback through every component
  // that renders an email link.
  useEffect(() => {
    function onOpenSendModal(ev: Event) {
      const detail = (ev as CustomEvent).detail as {
        entryId?: string
        to?: string
        subject?: string
        body?: string
        recipientLabel?: string
      } | undefined
      if (!detail?.entryId || !detail.to || !detail.subject || !detail.body) return
      setSendPreview({
        entryId: detail.entryId,
        to: detail.to,
        subject: detail.subject,
        body: detail.body,
        recipientLabel: detail.recipientLabel ?? detail.to,
      })
    }
    function onOpenThreadModal(ev: Event) {
      const detail = (ev as CustomEvent).detail as { entryId?: string; label?: string } | undefined
      if (!detail?.entryId) return
      setThreadModal({ entryId: detail.entryId, label: detail.label ?? '' })
    }
    window.addEventListener('open-send-modal', onOpenSendModal)
    window.addEventListener('open-thread-modal', onOpenThreadModal)
    return () => {
      window.removeEventListener('open-send-modal', onOpenSendModal)
      window.removeEventListener('open-thread-modal', onOpenThreadModal)
    }
  }, [])

  /**
   * Multi-column-sort click handler. Clicking any column header:
   *   - If column is already PRIMARY: toggles direction (desc → asc).
   *     A second click on asc removes the column from the chain
   *     entirely (so users can clear without a "reset" button).
   *   - If column is in the chain but NOT primary: promotes to
   *     primary, demotes the rest by one priority level. Direction
   *     resets to desc.
   *   - If column is NEW: prepends as primary, demotes the rest.
   *     Direction defaults to desc.
   *
   * Three-state per-column cycle: off → desc → asc → off.
   */
  function handleSort(col: SortCol) {
    setSorts(prev => {
      const idx = prev.findIndex(s => s.col === col)
      if (idx === 0) {
        // Currently primary → toggle dir, or remove on second toggle.
        const cur = prev[0]
        if (cur.dir === 'desc') {
          return [{ col, dir: 'asc' }, ...prev.slice(1)]
        } else {
          return prev.slice(1) // remove primary
        }
      }
      // Promote (or insert) as new primary.
      const without = prev.filter(s => s.col !== col)
      return [{ col, dir: 'desc' }, ...without]
    })
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
      // Short opaque ID embedded in outbound email subjects so the
      // inbound webhook can match replies. 8 chars of base36 ≈ 2.8e12
      // possible values — collision-free at our scale.
      trackingId: Math.random().toString(36).slice(2, 10),
      notes: '',
      followUpDate: '',
      dateReachedOut: '',
      touchpoints: '',
      responseDate: '',
      subscribers: c.subscribers || '',
      avgViews: c.avgViews || 0,
      fitScore: computeFitScore(c, scoreWeights, effectiveGuidanceEntries),
      linkedin: c.linkedin || '',
      instagram: c.instagram || '',
      twitter: c.twitter || '',
      tiktok: c.tiktok || '',
      website: c.website || '',
      contentNiche: '',
      phone: '',
      dealValue: '',
      contractSent: false,
      meetingScheduled: '',
    }
    saveOutreach([...outreach, entry])
    // Pin the newly-added id so it shows at the top of the Outreach
    // tab, even if the user is currently on Results and the
    // OutreachTab component will mount fresh when they switch over.
    setRecentlyAddedIds(prev => new Set([...prev, entry.id]))
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
        // No toasts on status changes (Successful / Rejected / No
        // Response / Not Outreached / Open) — every transition was
        // popping a notification in the bottom-right which felt
        // noisy for routine triage. The confetti animation still
        // fires on first-time Successful so the dopamine moment
        // isn't lost.
        if (value === 'Successful' && e.status !== 'Successful') {
          celebrateSuccess()
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
  const [dismissedBulkRunning, setDismissedBulkRunning] = useState(false)
  const [dismissedSearchingIds, setDismissedSearchingIds] = useState<Set<string>>(new Set())

  // Aggressive single-row email search for a Dismissed creator. Saves the
  // updated record back to dismissed_creators in Supabase so re-opens of
  // the tab keep the found email.
  async function deepSearchDismissedEmail(channelId: string) {
    const c = dismissed.find(x => x.channelId === channelId)
    if (!c) return
    setDismissedSearchingIds(s => new Set(s).add(channelId))
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
      // Functional updater so we always merge against the latest
      // dismissed array — guards against state having moved between
      // when the function was called and when the fetch resolved.
      const cleanEmail = String(extra.email || '').trim()
      let persistedSnapshot: Creator[] | null = null
      setDismissed(prev => {
        const next = prev.map(x => {
          if (x.channelId !== channelId) return x
          return {
            ...x,
            email: x.email || cleanEmail,
            linkedin: x.linkedin || extra.linkedin || '',
            instagram: x.instagram || extra.instagram || '',
            twitter: x.twitter || extra.twitter || '',
            tiktok: x.tiktok || extra.tiktok || '',
            website: x.website || extra.website || '',
            subscribers: x.subscribers || extra.subscribers || '',
            avgViews: x.avgViews || (extra.avgViews && !isNaN(extra.avgViews) ? extra.avgViews : 0),
          }
        })
        persistedSnapshot = next
        return next
      })
      // Persist the snapshot we just committed to state (not the
      // pre-update closure-captured `dismissed`, which could miss
      // concurrent updates).
      if (persistedSnapshot) void persistDismissed(persistedSnapshot)
      if (cleanEmail && !c.email) toast.success(`Found email for ${c.channelName}`)
    } catch (err: any) {
      toast.error(`Search failed: ${err?.message || err}`)
    } finally {
      setDismissedSearchingIds(s => { const n = new Set(s); n.delete(channelId); return n })
    }
  }

  // Bulk aggressive search across every Dismissed creator missing an email.
  // Keeps running in the background as the user navigates other tabs (the
  // SPA stays mounted, the toast tracks progress globally).
  async function deepSearchAllDismissed() {
    const targets = dismissed.filter(c => !c.email).map(c => c.channelId)
    if (targets.length === 0 || dismissedBulkRunning) return
    setDismissedBulkRunning(true)
    const toastId = toast.loading(`Deep-searching emails: 0 / ${targets.length} dismissed`, { duration: 600_000 })
    try {
      const CONCURRENCY = 3
      let done = 0
      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const batch = targets.slice(i, i + CONCURRENCY)
        await Promise.all(batch.map(id => deepSearchDismissedEmail(id)))
        done += batch.length
        toast.loading(`Deep-searching emails: ${done} / ${targets.length} dismissed`, { id: toastId, duration: 600_000 })
      }
      toast.success(`Done. ${done} dismissed creators rechecked.`, { id: toastId })
    } finally {
      setDismissedBulkRunning(false)
    }
  }

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
            instagram: c.instagram || '',
            twitter: c.twitter || '',
            tiktok: c.tiktok || '',
            website: c.website || '',
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

  /**
   * Manually update an IG URL on a creator (the "Find IG" button in
   * the InstagramCell). Triggers two side effects:
   *   1. The cell will start polling /api/instagram-status now that
   *      a handle exists — Meta Graph metrics fill in if available.
   *   2. We POST the new handle to /api/enrich to refresh the
   *      enrichment cache, which fires a QStash job too.
   * Fire-and-forget on the API hit — the UI doesn't block on it.
   */
  function updateInstagramHandle(channelId: string, igUrl: string) {
    setCreators(list => list.map(x =>
      x.channelId === channelId ? { ...x, instagram: igUrl } : x,
    ))
    // Refresh enrichment in background so the QStash worker also kicks in.
    const c = creators.find(x => x.channelId === channelId)
    if (c) {
      const params = new URLSearchParams({
        name: c.channelName,
        channelId: c.channelId,
        description: c.description || '',
        website: c.website || '',
        instagram: igUrl,
        tiktok: c.tiktok || '',
      })
      void fetch(`/api/enrich?${params}`).catch(() => { /* swallow — UI already updated */ })
    }
  }

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

  const runSearch = useCallback(async (
    kw: string,
    keywordsList?: string[],
    /** Optional mode override — passed by pill clicks so the search
     *  uses the freshly-selected mode without waiting for the
     *  setSearchMode setState to propagate through React's batching. */
    modeOverride?: SearchMode,
  ) => {
    if (!kw.trim() && !(keywordsList && keywordsList.length)) return
    const version = ++searchVersion.current
    setLoading(true)
    setCreators([])
    setLoadMoreCreators([])
    setCurrentKeyword(kw)
    setCurrentKeywordsList(keywordsList ?? [])
    seenChannelIds.current = new Set()
    setEnrichProgress({ current: 0, total: 0 })
    setActiveTab('results')
    setShowSearchSimilar(false) // reset every fresh search

    // Effective mode for this run — caller-passed override wins over
    // state. Pill clicks pass override so they don't race the state
    // setter.
    const effectiveMode: SearchMode = modeOverride ?? searchMode

    // Niche-list searches (multiple comma-joined occupations) are always
    // broad keyword searches regardless of the pill state — the niche
    // chips only appear in occupation contexts and shouldn't try to
    // lookup a username.
    const useTargetedLookup =
      !keywordsList?.length &&
      (effectiveMode === 'url' || effectiveMode === 'username')

    if (useTargetedLookup) {
      // Build the lookup query based on the selected pill. URL mode
      // sends the input as ?url=, Username mode strips a leading @ and
      // sends ?handle=. Both hit /api/lookup-channel which resolves
      // everything to a YouTube channel (cross-platform handles tend
      // to match — Instagram URL → user looked up as YouTube handle).
      const trimmed = kw.trim()
      let lookupQs: string
      let displayLabel: string
      if (effectiveMode === 'url') {
        // Try to surface what the URL points at for the status text.
        const cls = classifySearchInput(trimmed)
        if (cls.kind === 'url') {
          // Recognised social URL — pass to the lookup as a URL when
          // the host is YouTube; otherwise pass the extracted handle
          // (the route resolves both forms via the YouTube backbone).
          if (cls.sourcePlatform === 'youtube') {
            lookupQs = `url=${encodeURIComponent(trimmed)}`
            displayLabel = cls.handle ? `@${cls.handle}` : 'channel'
          } else {
            const h = cls.handle || ''
            lookupQs = `handle=${encodeURIComponent(h)}`
            displayLabel = h ? `@${h}` : 'channel'
          }
        } else {
          // User clicked URL pill but typed something that's not a
          // recognised URL. Pass it through anyway — the server will
          // 404 it, then the "Search similar" pill recovers.
          lookupQs = `url=${encodeURIComponent(trimmed)}`
          displayLabel = trimmed.length > 30 ? trimmed.slice(0, 30) + '…' : trimmed
        }
      } else {
        // Username mode — strip a leading @ if present.
        const handle = trimmed.replace(/^@+/, '')
        lookupQs = `handle=${encodeURIComponent(handle)}`
        displayLabel = `@${handle}`
      }

      setStatus(`Looking up ${displayLabel}...`)

      try {
        const r = await fetch(`/api/lookup-channel?${lookupQs}`)
        const lookup = await r.json()
        if (version !== searchVersion.current) return

        if (!r.ok || !lookup.channelId) {
          // No automatic fallback — user picks "Search similar" pill
          // explicitly if they want to switch to broad keyword search.
          // The pill in the UI flips searchMode to 'occupation' and
          // re-fires runSearch with the same input.
          setStatus(`No matches for ${displayLabel} on YouTube.`)
          setShowSearchSimilar(true)
          setLoading(false)
          return
        }
        // Resolved to a real channel.
        {
          if (dismissedIds.has(lookup.channelId) || outreachIds.has(lookup.channelId)) {
            setStatus(`${lookup.channelName || displayLabel} is already in your outreach or dismissed list.`)
            setLoading(false)
            return
          }
          seenChannelIds.current.add(lookup.channelId)
          // The data model is YouTube-centric and the platform tabs
          // filter results to creators who have that social linked.
          // Right after a lookup the new creator hasn't been enriched
          // yet, so an IG/TikTok/X tab would hide the result behind
          // its filter ("0 of 1 — none have Instagram"). Snap to the
          // YouTube tab so the result is always visible, then the
          // user can flip tabs once the social columns populate.
          if (activePlatform !== 'youtube') {
            setActivePlatform('youtube')
          }
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
            matchedVia: effectiveMode === 'url' ? 'url' : 'handle',
            videoTitles: [],
            videoDates: [],
            shortDates: [],
            description: lookup.description || '',
            enriching: true,
          }
          setCreators([baseCreator])
          setEnrichProgress({ current: 0, total: 1 })
          setStatus(`Found ${lookup.channelName || displayLabel}. Enriching contact info...`)
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
              shortDates: extra.shortDates || [],
              avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : 0,
              linkedin: extra.linkedin || '',
              instagram: extra.instagram || '',
              twitter: extra.twitter || '',
              tiktok: extra.tiktok || '',
              website: extra.website || '',
            }])
            setEnrichProgress({ current: 1, total: 1 })
            setStatus(`Done. ${lookup.channelName || displayLabel} ready — click + to add to Outreach.`)
          } catch {
            setCreators([{ ...baseCreator, enriching: false }])
            setStatus('Done (could not fetch extra contact info).')
          }
          setLoading(false)
          return
        }
      } catch (err: any) {
        // Targeted lookup failed at the network layer — show the
        // recovery pill (Search similar) instead of silently falling
        // through. User chooses whether to broaden.
        setStatus(`Lookup failed: ${err?.message || err}`)
        setShowSearchSimilar(true)
        setLoading(false)
        return
      }
    }

    // Occupation mode (or niche-list search) → broad keyword search.
    setStatus('Searching...')

    try {
      const regionCodes = regions.length > 0 ? regions : ['']
      // Niche-mode: pass the full list of occupations to the API as
      // `keywords=` so the server skips topic-map expansion and uses
      // each occupation directly. Single-keyword mode unchanged.
      const queryFragment = keywordsList && keywordsList.length
        ? `keywords=${encodeURIComponent(keywordsList.join(','))}`
        : `keyword=${encodeURIComponent(kw)}`
      const allResponses = await Promise.all(
        regionCodes.map(code => {
          const glParam = code ? `&gl=${encodeURIComponent(code)}` : ''
          return fetch(`/api/search?${queryFragment}&maxResults=${maxResults}&minViews=${minViews}&maxViews=${maxViews}${glParam}`).then(r => r.json())
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
      let visible = (data.channels as Creator[]).filter(
        (c: Creator) => !dismissedIds.has(c.channelId) && !outreachIds.has(c.channelId)
      )

      // Name-match narrowing for handle-shaped inputs that landed in
      // broad-keyword mode. Two ways this fires:
      //   1. User clicked the "Search similar" pill after a username
      //      lookup failed — they typed `TinaHuang1`, occupation
      //      search runs, we narrow to channels whose name matches.
      //   2. User manually picked occupation mode but typed something
      //      that looks like a handle/url. We still help.
      // For pure phrase searches (`fitness`, `productivity coach`)
      // this doesn't fire — classifier returns 'phrase' and we keep
      // the full keyword pile.
      const inputCls = classifySearchInput(kw)
      const handleHint =
        inputCls.kind === 'handle' ? inputCls.handle :
        (inputCls.kind === 'url' && inputCls.handle) ? inputCls.handle :
        null
      if (handleHint) {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
        const target = norm(handleHint)
        const targetCore = target.replace(/\d+$/, '') // drop trailing digits (TinaHuang1 → tinahuang)
        const matches = visible.filter(c => {
          const n = norm(c.channelName)
          if (!n || !target) return false
          return n === target
            || n === targetCore
            || (target.length >= 4 && n.includes(target))
            || (targetCore.length >= 4 && n.includes(targetCore))
            || (n.length >= 4 && (target.includes(n) || targetCore.includes(n)))
        })
        if (matches.length > 0 && matches.length <= 3) {
          visible = matches
          setStatus(`Found ${matches.length} close match${matches.length === 1 ? '' : 'es'} for @${handleHint}.`)
        } else if (matches.length > 0) {
          visible = matches.slice(0, 5)
          setStatus(`${matches.length} channels match @${handleHint} — showing the closest 5.`)
        }
        // matches.length === 0 → keep the full keyword pile, status
        // stays "Searching..." from the broad-search step.
      }

      const enriched = visible.map(c => ({ ...c, enriching: true }))
      setCreators([...enriched])
      setEnrichProgress({ current: 0, total: enriched.length })
      setStatus(`Found ${enriched.length} creators. Resolving handles...`)

      // Two-phase enrichment.
      //
      // Phase A (fast, blocking): /api/enrich?fast=true for everyone,
      // BATCH=20 in parallel. ~1.5–2s per creator → ~10–15s for 100.
      // Returns YouTube /about + videos + shorts only — i.e. all
      // social handles (IG/TT/X/LinkedIn) + subscribers + recency.
      // Email column stays empty until Phase B fills it in. The IG /
      // TikTok / X / LinkedIn filter tabs work immediately at the
      // end of Phase A.
      //
      // Phase B (slow, background): /api/enrich (full mode) for
      // everyone, BATCH=8 to be polite to DDG. Fills in emails as
      // they resolve. User keeps interacting; rows update in place.
      // Doesn't block setLoading(false); the spinner stops after A.

      async function runPhase(fast: boolean, concurrency: number, statusFn: (i: number, total: number) => string) {
        for (let i = 0; i < enriched.length; i += concurrency) {
          if (version !== searchVersion.current) return
          const batchIndices = Array.from({ length: Math.min(concurrency, enriched.length - i) }, (_, k) => i + k)
          await Promise.all(batchIndices.map(async (idx) => {
            const c = enriched[idx]
            try {
              const params = new URLSearchParams({
                name: c.channelName, channelId: c.channelId,
                website: c.website || '', instagram: c.instagram || '',
                tiktok: c.tiktok || '', description: c.description || '',
              })
              if (fast) params.set('fast', 'true')
              const r = await fetch(`/api/enrich?${params}`)
              const extra = await r.json()
              // In Phase A we keep `enriching:true` so the email
              // column shows "looking..." until Phase B writes the
              // email. In Phase B we flip it to false.
              enriched[idx] = {
                ...c,
                enriching: fast ? true : false,
                email: c.email || extra.email || enriched[idx].email || '',
                subscribers: c.subscribers || extra.subscribers || enriched[idx].subscribers || '',
                videoDates: (extra.videoDates?.length ? extra.videoDates : enriched[idx].videoDates) || [],
                shortDates: (extra.shortDates?.length ? extra.shortDates : enriched[idx].shortDates) || [],
                avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : enriched[idx].avgViews,
                linkedin: c.linkedin || extra.linkedin || enriched[idx].linkedin || '',
                instagram: c.instagram || extra.instagram || enriched[idx].instagram || '',
                twitter: c.twitter || extra.twitter || enriched[idx].twitter || '',
                tiktok: c.tiktok || extra.tiktok || enriched[idx].tiktok || '',
                website: c.website || extra.website || enriched[idx].website || '',
              }
            } catch {
              if (!fast) enriched[idx] = { ...enriched[idx], enriching: false }
            }
          }))
          if (version === searchVersion.current) {
            setEnrichProgress({ current: Math.min(i + concurrency, enriched.length), total: enriched.length })
            setStatus(statusFn(Math.min(i + concurrency, enriched.length), enriched.length))
            setCreators([...enriched])
          }
        }
      }

      // Phase A — fast pass (fills socials + subs + recency).
      await runPhase(
        true,
        20,
        (done, total) => `Resolving handles ${done} / ${total}...`,
      )

      if (version !== searchVersion.current) return

      // Phase A done — user can already see + filter rows. Drop the
      // blocking spinner and let Phase B trickle emails in.
      setLoading(false)
      setStatus(`Found ${enriched.length} creators. Looking up emails in background...`)
      setEnrichProgress({ current: 0, total: enriched.length })

      // Phase B — slow pass, in background. Lower concurrency to be
      // polite to DDG (we don't want to get rate-limited mid-search).
      await runPhase(
        false,
        8,
        (done, total) => `Looking up emails ${done} / ${total}...`,
      )

      if (version === searchVersion.current) {
        setStatus(`Done — ${enriched.length} creators found.`)
        setEnrichProgress({ current: 0, total: 0 })
      }
    } catch (err: any) {
      if (version === searchVersion.current) {
        setStatus(`Error: ${err.message}`)
        setLoading(false)
      }
    }
  }, [minViews, maxViews, maxResults, regions, dismissedIds, outreachIds, searchMode, activePlatform])

  async function handleSearch() { await runSearch(keyword) }

  const handleLoadMore = useCallback(async () => {
    if (!currentKeyword || loadingMore || loading) return
    setLoadingMore(true)
    try {
      const regionCodes = regions.length > 0 ? regions : ['']
      const queryFragment = currentKeywordsList.length > 0
        ? `keywords=${encodeURIComponent(currentKeywordsList.join(','))}`
        : `keyword=${encodeURIComponent(currentKeyword)}`
      const allResponses = await Promise.all(
        regionCodes.map(code => {
          const glParam = code ? `&gl=${encodeURIComponent(code)}` : ''
          return fetch(`/api/search?${queryFragment}&maxResults=${maxResults}&minViews=${minViews}&maxViews=${maxViews}${glParam}`).then(r => r.json())
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

      // Enrich in parallel batches. Bumped from 10 → 20 since user
      // already sees rows; we want load-more to fill in fast.
      const enriched = [...batch]
      const BATCH = 20
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
              shortDates: (extra.shortDates?.length ? extra.shortDates : c.shortDates) || [],
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
  }, [currentKeyword, currentKeywordsList, loadingMore, loading, minViews, maxViews, maxResults, regions, dismissedIds, outreachIds])

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
    // Hide dismissed creators immediately even if they linger in
    // `creators` state momentarily — same logic the icon uses, so the
    // row + icon are always in sync.
    .filter(c => !dismissedIds.has(c.channelId))
    .filter(c => c.avgViews >= minViews && c.avgViews <= maxViews)
    .filter(c => {
      if (minSubs === 0 && maxSubs === 0) return true
      const n = parseSubscriberCount(c.subscribers)
      if (n == null) return minSubs === 0 // unknown subs only pass when there's no min
      if (minSubs > 0 && n < minSubs) return false
      if (maxSubs > 0 && n > maxSubs) return false
      return true
    })
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
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Sticky glass top bar — same width-feel as the page below */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className={`${activeTab === 'outreach' || activeTab === 'results' ? 'w-full px-6' : 'max-w-7xl mx-auto px-8'} py-5`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/landing" title="Visit the public site" className="hover:opacity-80 transition-opacity">
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent leading-none">Creator Outreach</h1>
              </Link>
              {/* "Find [platform] creators" — every child explicitly
                  uses h-7 + flex items-center so they share the same
                  vertical metrics. Earlier attempts with just
                  items-center on the parent + various line-height
                  combos produced a 1-2px offset because the icon
                  inside the dropdown button has different intrinsic
                  height (16px) than the surrounding text x-height.
                  Locking everyone to 28px tall sidesteps the issue. */}
              <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="inline-flex items-center h-7 leading-none">Find</span>
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
                <span className="inline-flex items-center h-7 leading-none">creators</span>
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

      <div className={`${activeTab === 'outreach' || activeTab === 'results' ? 'w-full px-6' : 'max-w-7xl mx-auto px-8'} pt-6 pb-16`}>

        {/* Search-area wrapper — groups the mode pills + the search row
            so the pills can fade in/out based on whether anything inside
            has focus. Per Dylan 2026-05-10: hover trigger removed —
            clicking into the search bar is the only way to surface the
            pills. Hover was too easy to trip on mouseover, making the
            UI feel jumpy. */}
        <div className="group/searchgroup">

        {/* Search-mode pills — three modes (URL / Username / Occupation
            or Field) above the search bar. Auto-selected based on what
            the classifier sees as you type; clicking a pill overrides
            and sticks until the input is cleared. Drives whether the
            next search is a targeted /api/lookup-channel call (URL +
            Username) or a broad /api/search call (Occupation). Only
            visible on Results tab — Outreach/Dismissed use the search
            input as a local filter, not a search trigger. */}
        {activeTab === 'results' && (
          <div className="overflow-hidden transition-all duration-150 ease-out opacity-0 max-h-0 group-focus-within/searchgroup:opacity-100 group-focus-within/searchgroup:max-h-12">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">Mode</span>
              {([
                { id: 'url' as const, label: 'URL', hint: 'youtube.com/@handle, instagram.com/...' },
                { id: 'username' as const, label: 'Username', hint: '@mrbeast or just a handle' },
                { id: 'occupation' as const, label: 'Occupation / Field', hint: 'fitness coach, productivity, etc.' },
              ]).map(p => {
                const isActive = searchMode === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    // 2026-05-10 per Dylan: clicking a pill made it disappear
                    // before the click registered, because Safari/Firefox
                    // don't grant focus to buttons on click — focus left
                    // the input, group-focus-within flipped false, the
                    // container collapsed. preventDefault on mousedown
                    // stops the input from losing focus so the pill row
                    // stays visible through the entire click cycle.
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => {
                      setSearchMode(p.id)
                      setSearchModeManual(true)
                      // If there's already a keyword and this is a real
                      // change, re-fire the search with the new mode so
                      // the user sees the effect immediately. The mode
                      // override param sidesteps React's setState batch —
                      // runSearch sees the new mode this turn.
                      if (!isActive && keyword.trim()) {
                        runSearch(keyword, undefined, p.id)
                      }
                    }}
                    title={`${p.hint}${searchModeManual && isActive ? ' (manual)' : ''}`}
                    aria-pressed={isActive}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      isActive
                        ? 'bg-purple-500/15 border-purple-500/50 text-purple-700 dark:text-purple-300 font-medium'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/40'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
              {searchModeManual && keyword.trim() && (
                <button
                  type="button"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => setSearchModeManual(false)}
                  className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors underline-offset-2 hover:underline"
                  title="Reset to auto-detect"
                >
                  reset auto-detect
                </button>
              )}
            </div>
          </div>
        )}

        {/* Premium search bar — chunkier sizing + gradient glow on focus.
            The outer wrapper renders an absolute-positioned blur that
            fades in when any child is focused (group-focus-within),
            giving the whole row a soft purple-blue halo without
            adding state or refs. The input itself is taller (py-3 vs
            py-2.5) with rounded-xl corners and a wider focus ring. */}
        <div className="relative group/search mb-2">
          {/* Soft ambient glow visible only when something inside the
              search row has focus. Sits beneath everything, doesn't
              capture clicks. */}
          <div
            className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-purple-500/10 via-blue-500/8 to-purple-500/10 opacity-0 blur-2xl transition-opacity duration-500 group-focus-within/search:opacity-100 pointer-events-none"
            aria-hidden
          />
          <div className="relative flex gap-2 flex-wrap">
            <div className="flex-1 min-w-64 relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] text-muted-foreground/80 group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                aria-label={
                  activeTab === 'outreach'
                    ? 'Filter outreach by name, email, notes, or niche'
                    : 'Search creators — by topic, YouTube URL, handle, or natural-language description'
                }
                className="w-full bg-card/70 backdrop-blur-sm border border-border/80 rounded-xl pl-11 pr-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/15 focus:bg-card hover:border-border transition-all duration-200 shadow-sm"
                placeholder={
                  activeTab === 'outreach'
                    ? 'Filter your outreach by name, email, notes, niche…'
                    : 'Search a topic, paste a YouTube URL, or @handle to find a specific creator…'
                }
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => {
                  // On Outreach tab, Enter is a no-op — the filter is
                  // already live as the user types. Suppressing prevents
                  // accidental YouTube search triggers from people who
                  // hit Enter out of habit.
                  if (e.key === 'Enter' && activeTab !== 'outreach') handleSearch()
                }}
              />
            </div>
          {/* Score settings icon — sized to match the chunkier input. */}
          <button
            onClick={() => setShowScoreSettings(true)}
            title="Lead Criteria"
            aria-label="Lead criteria — configure AI fit score"
            className={`px-3.5 py-3 rounded-xl border transition-all flex items-center gap-1.5 ${JSON.stringify(scoreWeights) !== JSON.stringify(DEFAULT_WEIGHTS) || scoreNarrative || effectiveGuidanceEntries.length > 0 ? 'bg-gradient-to-br from-purple-600 to-purple-700 border-purple-500/60 text-white shadow-md shadow-purple-500/20' : 'bg-card/70 backdrop-blur-sm border-border/80 text-muted-foreground hover:text-foreground hover:border-border'}`}
          >
            <span className="text-sm" aria-hidden>⚡</span>
          </button>
          {/* Filter icon */}
          <button
            onClick={() => setShowFilter(v => !v)}
            title={regions.length === 0 ? 'Filters — English-language search (no regional filter)' : regions.length === REGIONS.length ? 'Filters — Global (all regions)' : `Filters — searching: ${regions.map(code => REGIONS.find(r => r.code === code)?.label).join(', ')}`}
            aria-label={regions.length === 0 ? 'Filters — English-language search, no region selected' : regions.length === REGIONS.length ? 'Filters — searching globally across all regions' : `Filters — searching ${regions.map(code => REGIONS.find(r => r.code === code)?.label).join(', ')}`}
            aria-expanded={showFilter}
            aria-pressed={regions.length > 0}
            className={`px-3.5 py-3 rounded-xl border transition-all flex items-center gap-1.5 ${showFilter || regions.length > 0 ? 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500/60 text-white shadow-md shadow-blue-500/20' : 'bg-card/70 backdrop-blur-sm border-border/80 text-muted-foreground hover:text-foreground hover:border-border'}`}
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
          {/* Search button — spinner + "Searching…" stay visible the
              entire time `loading` is true, regardless of whether the
              user typed a new query mid-flight. Reflects "something
              is searching" honestly. When the user types a new query
              while one's in flight, the button BECOMES CLICKABLE again
              (the only state difference) so they can cancel + restart
              with Enter or a click — but the spinner keeps spinning
              until the loading state actually clears. */}
          {(() => {
            const typedSinceSearch =
              loading && keyword.trim().toLowerCase() !== currentKeyword.trim().toLowerCase()
            const onOutreach = activeTab === 'outreach'
            // Disabled only when truly idle-loading (not typed since
            // search). Lets the user click to fire a new search even
            // while the spinner is still going for the previous one.
            const isClickable = (!loading || typedSinceSearch) && !onOutreach
            return (
              <button
                onClick={handleSearch}
                disabled={!isClickable}
                title={
                  onOutreach
                    ? 'On Outreach tab the search bar filters your list — switch to Results to search YouTube.'
                    : typedSinceSearch
                    ? 'Hit Enter or click to search this new query — the spinner will reflect the new request.'
                    : undefined
                }
                className="relative bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold text-white shadow-md shadow-purple-500/20 transition-all hover:shadow-lg hover:shadow-purple-500/30 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading && (
                    <svg
                      className="w-3.5 h-3.5 animate-spin opacity-90"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
                  {loading ? 'Searching…' : 'Search'}
                </span>
                {/* Shimmer animates the entire time we're loading — the
                    spinner + shimmer combo signals ongoing work even
                    after the user typed something new. */}
                {loading && (
                  <span className="absolute inset-0 shimmer-bg rounded-xl pointer-events-none" aria-hidden />
                )}
              </button>
            )
          })()}
          {/* Export moved out of the search bar (2026-05-09). It now
              lives inline with the tab nav, right next to Customize —
              closer to the actual data the user is exporting and out
              of the way of the search controls. See the tab bar
              section further below. */}
        </div>
        </div>
        </div>{/* /group/searchgroup — closes the focus/hover scope
                  that drives the smooth-hide of the mode pills above */}

        {/* (The previous live classification badge was removed in
            favor of the explicit search-mode pills above the search
            bar — pills carry the same affordance with a clearer
            interaction model.) */}

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
                  className={`text-xs px-3 py-1 rounded border transition-colors ${minViews === p.min && maxViews === p.max ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-border pt-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Subscribers:</span>
              <input type="number" min={0} value={minSubs || ''}
                onChange={e => setMinSubs(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-muted border border-border rounded px-3 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500"
                placeholder="Min" />
              <span className="text-muted-foreground/70 text-xs">to</span>
              <input type="number" min={0} value={maxSubs || ''}
                onChange={e => setMaxSubs(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-muted border border-border rounded px-3 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500"
                placeholder="Max" />
              <span className="text-muted-foreground/70 text-xs">|</span>
              {[
                { label: '< 1K', min: 0, max: 1_000 },
                { label: '1K – 10K', min: 1_000, max: 10_000 },
                { label: '10K – 100K', min: 10_000, max: 100_000 },
                { label: '100K – 500K', min: 100_000, max: 500_000 },
                { label: '500K – 1M', min: 500_000, max: 1_000_000 },
                { label: '1M – 5M', min: 1_000_000, max: 5_000_000 },
                { label: '5M – 10M', min: 5_000_000, max: 10_000_000 },
                { label: '10M+', min: 10_000_000, max: 0 },
                { label: 'Any', min: 0, max: 0 },
              ].map(p => (
                <button key={p.label} onClick={() => { setMinSubs(p.min); setMaxSubs(p.max) }}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${minSubs === p.min && maxSubs === p.max ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}>
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
                  className={`text-xs px-3 py-1 rounded border transition-colors ${maxAgeDays === p.days ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-border pt-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Show only:</span>
              <button
                onClick={() => setEmailOnly(v => !v)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${emailOnly ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
              >
                Has email
              </button>
              <button
                onClick={() => setEmailFirstSort(v => !v)}
                title="When on, creators with a discovered email always sort to the top regardless of which column you're sorting by"
                className={`text-xs px-3 py-1 rounded border transition-colors ${emailFirstSort ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
              >
                Email-first sort
              </button>
            </div>
            <div className="flex items-start gap-3 flex-wrap border-t border-border pt-3">
              <div className="flex flex-col w-20 shrink-0 mt-1 gap-0.5">
                <span className="text-xs text-muted-foreground">Region:</span>
                <span className="text-[10px] text-muted-foreground/70 leading-snug">Pick countries or go Global for all</span>
              </div>
              <div className="flex flex-wrap gap-1.5 flex-1" role="group" aria-label="Region filter">
                {/* English = no region filter (default) */}
                <button
                  onClick={() => setRegions([])}
                  title="No regional filter — English-language creators only"
                  aria-pressed={regions.length === 0}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.length === 0 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
                >
                  <span aria-hidden>🌐</span>
                  <span>English</span>
                </button>
                {/* Global = all countries */}
                <button
                  onClick={() => setRegions(REGIONS.map(r => r.code))}
                  title="Search across all countries simultaneously — slower but surfaces creators from every region"
                  aria-pressed={regions.length === REGIONS.length}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.length === REGIONS.length ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
                >
                  <span aria-hidden>🗺️</span>
                  <span>Global</span>
                </button>
                {REGIONS.map(r => (
                  <button
                    key={r.code}
                    onClick={() => setRegions(prev => regions.includes(r.code) ? prev.filter(c => c !== r.code) : [...prev, r.code])}
                    aria-pressed={regions.includes(r.code)}
                    aria-label={`${r.label}${regions.includes(r.code) ? ' (selected)' : ''}`}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.includes(r.code) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
                  >
                    <span aria-hidden>{r.flag}</span>
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading progress — wrapped in role=status + aria-live=polite
            so screen readers announce the search/enrich progress
            without interrupting the user. Both the loading and idle
            status share the same live region so transitions read
            naturally ("Searching..." → "Enriching 12 / 100 creators"
            → "Done — 100 creators found"). */}
        <div role="status" aria-live="polite" aria-atomic="true" className="contents">
          {loading && (
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-1.5">
                <Spinner />
                <span className="text-sm text-foreground/80">
                  {enrichProgress.total === 0
                    ? 'Searching...'
                    : `Enriching ${enrichProgress.current} / ${enrichProgress.total} creators`}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">{elapsed}s elapsed</span>
              </div>
              {enrichProgress.total > 0 && (
                <div
                  className="w-full bg-muted rounded-full h-1.5"
                  role="progressbar"
                  aria-valuenow={enrichProgress.current}
                  aria-valuemin={0}
                  aria-valuemax={enrichProgress.total}
                  aria-label="Enrichment progress"
                >
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {!loading && status && (
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <p className="text-xs text-muted-foreground">{status}</p>
              {/* Search similar pill — appears when a targeted (URL or
                  Username) lookup returns no matches. Click to switch
                  the pill to Occupation/Field mode and re-run the
                  same input as a broad keyword search. The classifier
                  inside runSearch's broad-search path will narrow
                  results to channel-name fuzzy matches when the input
                  still looks handle-shaped. */}
              {showSearchSimilar && keyword.trim() && activeTab === 'results' && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchMode('occupation')
                    setSearchModeManual(true)
                    setShowSearchSimilar(false)
                    // Pass override to bypass setSearchMode batching —
                    // see pill onClick for the same pattern.
                    runSearch(keyword, undefined, 'occupation')
                  }}
                  className="text-xs px-3 py-1 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/40 hover:bg-purple-500/25 transition-colors font-medium inline-flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Search similar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Suggestions bar — niche filter on top, occupations below */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setShowSuggestions(v => !v)} className="text-xs text-muted-foreground hover:text-foreground/80 uppercase tracking-wide flex items-center gap-1 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${showSuggestions ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Suggested searches
            </button>
            {/* Refresh chips — always available when the suggestion list
                is not narrowed to a specific niche. */}
            {showSuggestions && !(showNiches && selectedNiche) && (
              <button onClick={() => setSuggestions(pickRandom(ALL_OCCUPATIONS, 25))} title="Shuffle suggestions" aria-label="Shuffle suggested searches" className="text-muted-foreground hover:text-foreground/80 border border-border rounded p-0.5 hover:border-border transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
          {showSuggestions && (
            <>
              {/* Niche row — collapsed by default. The 'See niches' pill on the
                  left expands the row of all niches; clicking a niche fires a
                  multi-occupation search across every occupation in that niche. */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  onClick={() => {
                    setShowNiches(v => {
                      const next = !v
                      // Hiding the niche row also clears any active niche
                      // filter so the suggestions return to the mixed
                      // random sample.
                      if (!next) setSelectedNiche(null)
                      return next
                    })
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${showNiches ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
                  title="Search every occupation in a niche at once"
                >
                  <span>{showNiches ? '✕' : '🎯'}</span>
                  <span>{showNiches ? 'Hide niches' : 'See niches'}</span>
                </button>
                {showNiches && (
                  <>
                    <button
                      onClick={() => setSelectedNiche(null)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedNiche == null ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
                    >
                      All niches
                    </button>
                    {NICHE_BUCKETS.map(n => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setSelectedNiche(n.id)
                          setKeyword(n.label)
                          runSearch(n.label, n.occupations)
                        }}
                        title={`Search all ${n.occupations.length} occupations: ${n.occupations.slice(0, 4).join(', ')}${n.occupations.length > 4 ? '…' : ''}`}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${selectedNiche === n.id ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
                      >
                        <span>{n.emoji}</span>
                        <span>{n.label}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Occupation chips — quick single-occupation searches.
                  When the niche row is open AND a niche is selected, drill
                  into that niche's occupations. Otherwise show the random
                  mixed sample. */}
              <div className="flex flex-wrap gap-2">
                {(showNiches && selectedNiche
                  ? (NICHE_BUCKETS.find(n => n.id === selectedNiche)?.occupations || [])
                  : suggestions
                ).map(s => (
                  <button key={s} onClick={() => { setKeyword(s); runSearch(s) }}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted text-foreground/80 hover:bg-muted hover:text-foreground border border-border hover:border-border transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tabs + Customize */}
        <div className="flex items-center mb-4 border-b border-border">
          <AnimatedTabs<ActiveTab>
            layoutGroup="main-tabs"
            ariaLabel="Main view"
            tabs={[
              {
                id: 'results',
                // Tab counter — show filtered count when a platform filter
                // is on so the visible row count and the displayed number
                // match. Earlier behavior showed e.g. "(100)" when only
                // 5 rows were visible because IG-filtered. Now: amber
                // pill highlights the filter-narrowed count.
                label: (() => {
                  const filtered = currentList.length
                  const total = creators.length
                  if (total === 0) return <>Results</>
                  const isNarrowed = filtered !== total
                  const platformLabel = activePlatform !== 'youtube'
                    ? PLATFORM_CONFIGS.find(p => p.id === activePlatform)?.label
                    : null
                  return (
                    <>Results{' '}
                      {isNarrowed ? (
                        <span className="ml-1 text-xs inline-flex items-center gap-1">
                          <span className="text-amber-700 dark:text-amber-400 font-medium">{filtered}</span>
                          <span className="text-muted-foreground">of {total}</span>
                          {platformLabel && (
                            <span className="text-muted-foreground/70 hidden sm:inline">· {platformLabel}</span>
                          )}
                        </span>
                      ) : (
                        <span className="ml-1 text-xs text-muted-foreground">({total})</span>
                      )}
                    </>
                  )
                })(),
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
            onChange={(next) => {
              // Clear the keyword when changing tabs — the search bar
              // means different things per tab (YouTube search on
              // Results, local filter on Outreach / Dismissed) and a
              // leftover keyword from one context silently filtering
              // another led to "only newly-added showing" confusion.
              // Cleaner to start each tab with a blank search.
              if (next !== activeTab) setKeyword('')
              setActiveTab(next)
            }}
          />
          {/* Settings gear in the main tab nav — combines Customize
              columns + Export options. Hidden on:
                - Dismissed (no customize, no export wired)
                - Outreach > Analytics (has its OWN dedicated gear
                  with Customize metrics + Export, see OutreachAnalytics)
                - Outreach > Follow-ups (no column-customize concept,
                  no export needed there per Dylan)
              The remaining surfaces (Results, Outreach > All / Favorites)
              still get the gear with Export options. */}
          {activeTab !== 'dismissed' &&
            !(activeTab === 'outreach' && (outreachSubTab === 'analytics' || outreachSubTab === 'followups')) && (
            <div ref={exportMenuRef} className="ml-auto relative">
              <button
                onClick={() => setShowExport(v => !v)}
                title="View settings — customize columns or export this list"
                aria-label="View settings"
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border hover:border-border/80 transition-colors mb-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {showExport && (
                <div className="absolute right-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-2xl shadow-black/30 z-30 overflow-hidden">
                  {/* Customize columns — only shown on Results
                      (Outreach has its own customize entrypoint
                      inside its sub-tab nav). */}
                  {activeTab === 'results' && (
                    <button
                      onClick={() => {
                        const draft = activePlatform === 'youtube'
                          ? colConfig
                          : colConfig.filter(c => !YOUTUBE_ONLY_COL_IDS.includes(c.id))
                        setDraftCols(draft)
                        setShowCustomize(true)
                        setShowExport(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-b border-border/60"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h13M3 12h13M3 18h7" />
                      </svg>
                      Customize columns
                    </button>
                  )}
                  {/* Export — disabled when the active list is empty. */}
                  {activeTab === 'outreach' ? (
                    <>
                      <button
                        onClick={handleExportOutreachExcel}
                        disabled={outreach.length === 0}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Export Excel
                      </button>
                      <button
                        onClick={handleExportOutreachCSV}
                        disabled={outreach.length === 0}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-t border-border/60 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="text-base leading-none">📄</span>
                        Export CSV
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleExportExcel(currentList)}
                        disabled={currentList.length === 0}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="text-base leading-none">📊</span>
                        Export Excel
                      </button>
                      <button
                        onClick={() => handleExportCSV(currentList)}
                        disabled={currentList.length === 0}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-t border-border/60 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="text-base leading-none">📄</span>
                        Export CSV
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Old standalone Customize button removed (2026-05-09).
              On Results tab, customize is now an entry inside the
              Settings gear popover above. On Outreach the in-tab
              "Customize columns" link in OutreachTab still works.
              On Dismissed there's nothing to customize (fixed
              schema). */}
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
          <AnalyticsCustomizeShell onClose={() => setShowAnalyticsCustomize(false)}>
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
          </AnalyticsCustomizeShell>
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

        {/*
          Tab content fade — wrap each branch in a motion.div keyed
          by activeTab. Motion auto-plays the initial transition on
          every key change, giving a soft cross-fade between Results /
          Outreach / Dismissed without any extra state plumbing. ~150
          ms is the sweet spot — fast enough not to feel laggy, slow
          enough to read as a transition rather than a jarring swap.
        */}
        <motion.div
          key={activeTab}
          // Tab panel — id + aria-labelledby connect to the
          // matching <button role="tab"> in AnimatedTabs above.
          // Single panel that swaps content keyed by activeTab; the
          // id/labelledby pair updates with the active tab so screen
          // readers always announce the right relationship.
          id={tabPanelId('main-tabs', activeTab)}
          role="tabpanel"
          aria-labelledby={tabId('main-tabs', activeTab)}
          tabIndex={0}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
        {activeTab === 'outreach' ? (
          <>
            {/* Active-keyword chip — only shown when the user has
                something typed in the main search bar AND we're on
                the Outreach tab (where keyword filters the local
                list, not a YouTube search). Makes the filter state
                visible so it's clear why the All / Favorites views
                are narrowed. Click × to clear. Follow-ups + Analytics
                are unaffected by the filter (action queue / dashboard
                shouldn't be search-narrowed). */}
            {keyword.trim() && (
              <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-xs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700 dark:text-amber-300" aria-hidden>
                  <line x1="22" y1="3" x2="3" y2="22" />
                  <path d="M22 3L13 22l-2-9-9-2L22 3z" />
                </svg>
                <span className="text-amber-900 dark:text-amber-200">
                  Filtering Outreach by <strong>&ldquo;{keyword.trim()}&rdquo;</strong>
                </span>
                <span className="text-amber-700/70 dark:text-amber-300/70">·</span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300/80">
                  Follow-ups &amp; Analytics show all entries
                </span>
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  aria-label="Clear keyword filter"
                  className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
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
            {/* Sub-tab panel — same id/labelledby pattern as the
                main tabs above. Single wrapping div whose ARIA
                attributes update with the active sub-tab. */}
            <div
              role="tabpanel"
              id={tabPanelId('outreach-subtabs', outreachSubTab)}
              aria-labelledby={tabId('outreach-subtabs', outreachSubTab)}
              tabIndex={0}
            >
            {outreachSubTab === 'analytics' ? (
              <OutreachAnalytics
                entries={outreach}
                customMetrics={customMetrics}
                onOpenCustomize={() => { setDraftMetrics(customMetrics); setShowAnalyticsCustomize(true) }}
                onExportExcel={handleExportOutreachExcel}
                onExportCsv={handleExportOutreachCSV}
              />
            ) : outreachSubTab === 'followups' ? (
              // Follow-ups uses UNFILTERED outreach — it's an action
              // queue (what to do next), not a search view. The
              // dueCount badge above also reads from unfiltered
              // outreach, so this keeps badge + view in sync. Keyword
              // filter on the Outreach tab applies only to All /
              // Favorites views (which are search-oriented).
              <OutreachFollowUps
                entries={outreach}
                onUpdate={updateOutreachEntry}
                onOpenEntry={(id: string) => setViewingLeadId(id)}
                profile={profile}
              />
            ) : (
              <OutreachTab
                entries={filterOutreachByKeyword(
                  outreachSubTab === 'favorites' ? outreach.filter(e => e.favorite) : outreach,
                  keyword,
                )}
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
                onOpenEntry={(id: string) => setViewingLeadId(id)}
                // Disable recently-added pinning when a keyword
                // filter is active. Keyword search is a "find specific
                // entry" workflow; pinning recently-added on top of a
                // filtered list creates the misleading "only showing
                // newly added" perception. Browsing (no keyword) keeps
                // pinning so new entries surface naturally.
                recentlyAddedIds={keyword.trim() ? new Set() : recentlyAddedIds}
                onClearRecentlyAdded={() => {
                  setRecentlyAddedIds(new Set())
                  setInteractedNewIds(new Set())
                }}
                interactedNewIds={interactedNewIds}
                onMarkNewInteracted={(id) => setInteractedNewIds(prev => {
                  if (prev.has(id)) return prev // no-op if already marked
                  const next = new Set(prev)
                  next.add(id)
                  return next
                })}
              />
            )}
            </div>
          </>
        ) : activeTab === 'dismissed' ? (
          <DismissedTab
            dismissed={dismissed}
            onUndismiss={undismissCreator}
            onDeepSearch={deepSearchDismissedEmail}
            deepSearchingIds={dismissedSearchingIds}
            onSearchAll={deepSearchAllDismissed}
            bulkRunning={dismissedBulkRunning}
            profile={profile}
          />
        ) : (
          <>
            <CreatorTable
              creators={currentList} outreachIds={outreachIds}
              dismissedIds={dismissedIds}
              onAddToOutreach={addToOutreach}
              onDismiss={dismissCreator}
              onReorderCols={reorderResultCols}
              loading={loading}
              sorts={sorts} onSort={handleSort}
              colConfig={effectiveColConfig}
              emailFirst={emailFirstSort}
              loadMoreBatch={activeTab === 'results' ? loadMoreCreators.filter(c =>
                !dismissedIds.has(c.channelId) &&
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
              onOpenCustomize={() => { setDraftCols(colConfig); setShowCustomize(true) }}
              bulkRunning={resultsBulkRunning}
              onUpdateInstagram={updateInstagramHandle}
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
        </motion.div>
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
                .select('full_name, linkedin_url, pitch_line, subject_template, mail_client')
                .eq('user_id', userId)
                .single()
              if (data) setProfile({
                fullName: data.full_name ?? '',
                linkedinUrl: data.linkedin_url ?? '',
                pitchLine: data.pitch_line ?? '',
                subjectTemplate: data.subject_template ?? undefined,
                mailClient: (data.mail_client ?? 'default') as UserProfile['mailClient'],
                userEmail: userEmail ?? undefined,
              })
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

      {threadModal && (
        <ThreadModal
          entryId={threadModal.entryId}
          recipientLabel={threadModal.label}
          userEmail={userEmail}
          onClose={() => setThreadModal(null)}
        />
      )}

      {sendPreview && (
        <SendPreviewModal
          entryId={sendPreview.entryId}
          to={sendPreview.to}
          initialSubject={sendPreview.subject}
          initialBody={sendPreview.body}
          recipientLabel={sendPreview.recipientLabel}
          onClose={() => setSendPreview(null)}
          onSent={(result) => {
            // Optimistically reflect the send in the local outreach state:
            // bump status to "No Response" if it was untouched, and stamp
            // the Unipile ids so the conversation view / open tracking
            // can attribute back. Server already persisted these — we
            // just mirror to avoid a full refetch.
            setOutreach(prev => prev.map(e => {
              if (e.id !== result.entryId) return e
              const wasUntouched = e.status === 'Not Outreached' || !e.status
              return {
                ...e,
                unipileMessageId: result.messageId,
                unipileProviderId: result.providerId,
                unipileThreadId: result.threadId,
                unipileTrackingId: result.trackingId,
                unipileSentAt: Date.now(),
                status: wasUntouched ? 'No Response' : e.status,
                reachedOut: wasUntouched ? true : e.reachedOut,
                dateReachedOut: wasUntouched ? new Date().toISOString() : e.dateReachedOut,
              }
            }))
          }}
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
