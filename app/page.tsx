'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef, useContext } from 'react'
import type {
  Creator, SortCol, SortDir, ColId, ActiveTab, ScoreWeights,
  GuidanceCondition, GuidanceRule, GuidanceEntry, GuidancePreset, GuidanceContextType,
  OutreachEntry, OutreachColDef, OutreachColConfig,
  ColConfig, PlatformId, PlatformConfig, UserProfile,
} from '@/lib/types'
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
import {
  getOutreach, saveOutreach as persistOutreach,
  getDismissed, saveDismissed as persistDismissed,
  saveColConfig,
  getOutreachColConfig, saveOutreachColConfig,
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
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute z-50 left-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl text-xs flex flex-col"
          style={{ width: '20rem', maxWidth: 'calc(100vw - 1rem)', maxHeight: 'min(560px, 80vh)' }}
        >
          {/* ── GUIDANCE DETAIL VIEW ── */}
          {guidanceView ? (
            <>
              {/* Sticky header */}
              <div className="shrink-0 flex items-center justify-between px-3 pt-3 pb-2 border-b border-gray-800">
                <button onClick={() => setGuidanceView(false)} className="text-gray-500 hover:text-white flex items-center gap-1 text-[11px]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <span className="font-semibold text-gray-200 text-[11px]">✨ Your Lead Criteria</span>
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white leading-none">✕</button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5 min-h-0">

                {/* Score contribution card — always visible */}
                <div className="bg-gray-800/70 rounded-lg p-2.5 space-y-2 border border-gray-700/40">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-medium">Score contribution</span>
                    <span className={`font-bold font-mono text-sm ${guidanceActualPts > 0 ? 'text-purple-300' : 'text-gray-500'}`}>
                      {guidanceActualPts} <span className="text-gray-600 font-normal text-[10px]">/ {guidanceMaxPts} pts</span>
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: guidanceMaxPts > 0 ? `${Math.round((guidanceActualPts / guidanceMaxPts) * 100)}%` : '0%',
                        backgroundColor: guidanceMaxPts > 0 && guidanceActualPts / guidanceMaxPts >= 0.7 ? 'rgb(168,85,247)' : guidanceMaxPts > 0 && guidanceActualPts / guidanceMaxPts >= 0.4 ? 'rgb(139,92,246)' : 'rgb(75,85,99)',
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-500 leading-snug">
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
                  <p className="text-gray-500 text-center py-3 text-[11px] leading-relaxed">
                    No criteria active. Open <strong className="text-gray-400">Score Settings</strong> to select what makes a great lead.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry: GuidanceEntry) => {
                      const entryFired = fired.filter(f => f.entryId === entry.id)
                      const entryMissed = missed.filter(m => m.entryId === entry.id)
                      const allMatch = entryFired.length > 0 && entryMissed.length === 0
                      const noneMatch = entryFired.length === 0
                      return (
                        <div key={entry.id} className="border border-gray-800 rounded-md overflow-hidden">
                          {/* Criterion header */}
                          <div className="px-2 pt-2 pb-1.5">
                            <div className="text-gray-400 text-[10px] italic leading-snug break-words">"{entry.text}"</div>
                            {entry.summary && (
                              <div className="text-gray-300 text-[11px] mt-1 leading-snug break-words">
                                <span className="text-purple-400 not-italic font-medium">AI: </span>{entry.summary}
                              </div>
                            )}
                          </div>
                          {/* Scoring logic */}
                          {entry.rules.length > 0 && (
                            <div className="bg-gray-800/40 px-2 py-1.5 space-y-1.5">
                              <div className="text-[9px] text-gray-600 uppercase tracking-wide font-semibold">Result for this creator</div>
                              {entryFired.map((f, fi) => {
                                const ruleObj = entry.rules.find(r => r.label === f.ruleLabel) || entry.rules[fi]
                                const evidence = ruleObj ? getGuidanceRuleEvidence(ruleObj, c) : ''
                                return (
                                  <div key={fi} className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-green-500 shrink-0">✓</span>
                                      <span className="flex-1 text-gray-200 font-medium leading-snug break-words">{f.ruleLabel}</span>
                                      <span className={`font-mono font-bold shrink-0 ${f.pts > 0 ? 'text-green-400' : 'text-red-400'}`}>{f.pts > 0 ? '+' : ''}{f.pts}</span>
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
                                  <span className="text-gray-700 shrink-0">✗</span>
                                  <span className="flex-1 text-gray-600 leading-snug break-words">{m.ruleLabel}</span>
                                  <span className="font-mono shrink-0 text-gray-700">{m.pts > 0 ? '+' : ''}{m.pts}</span>
                                </div>
                              ))}
                              <div className={`text-[10px] font-medium pt-0.5 border-t border-gray-800/50 ${allMatch ? 'text-green-400' : noneMatch ? 'text-gray-600' : 'text-yellow-500'}`}>
                                {allMatch ? '✓ Fully matched' : noneMatch ? '✗ Not matched' : `⚡ Partial — ${entryFired.length}/${entry.rules.length} rules hit`}
                              </div>
                            </div>
                          )}
                          {entry.rules.length === 0 && (
                            <div className="bg-gray-800/40 px-2 py-1.5">
                              <span className="text-gray-600 text-[10px]">No evaluatable rules — criterion may need rephrasing.</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Sticky footer — link to Score Settings */}
              <div className="shrink-0 border-t border-gray-800 px-3 py-2.5 flex items-center justify-between">
                <span className="text-[10px] text-gray-600">Manage criteria in Score Settings</span>
                <button
                  onClick={() => { setOpen(false); setGuidanceView(false) }}
                  className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-0.5"
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            /* ── MAIN BREAKDOWN VIEW ── */
            <>
              {/* Sticky header */}
              <div className="shrink-0 flex items-center justify-between px-3 pt-3 pb-2 border-b border-gray-800">
                <span className="font-semibold text-gray-200">Fit Score Breakdown</span>
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white leading-none">✕</button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-3 py-2.5 min-h-0">
                <div className="space-y-1.5">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`w-6 text-right font-mono font-bold shrink-0 leading-snug ${item.pts > 0 ? 'text-green-400' : item.pts < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {item.pts > 0 ? '+' : ''}{item.pts}
                      </span>
                      <div className="flex-1 min-w-0">
                        {item.isGuidance ? (
                          <button onClick={() => setGuidanceView(true)} className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-left">
                            <span>✨ Your Criteria</span>
                            <span className="text-gray-600">/ {item.max}</span>
                            <span className="text-gray-500 text-[10px] ml-0.5">view →</span>
                          </button>
                        ) : (
                          <span className="text-gray-300 leading-snug">{item.label}
                            {item.max > 0 && <span className="text-gray-600 ml-1">/ {item.max}</span>}
                          </span>
                        )}
                        {item.note && (
                          <div className="text-gray-500 text-[10px] leading-snug break-words mt-0.5">{item.note}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="mt-2 pt-2 border-t border-gray-800 flex items-center justify-between">
                  <span className="text-gray-400">Total</span>
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
                    <div className="mt-3 pt-2 border-t border-gray-800 space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                        <span>Score breakdown</span>
                        {chipMode ? <span className="text-purple-400 normal-case font-normal">✨ Your criteria</span> : <span className="text-gray-700 normal-case font-normal">Default</span>}
                      </div>
                      {/* Stacked bar */}
                      <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-gray-800">
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
                              <span className={`text-[9px] truncate ${chipMode ? 'text-purple-400' : 'text-gray-600'}`}>{seg.label.split(' ').slice(0,2).join(' ')} {pct}%</span>
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

function renderCell(id: ColId, c: Creator, weights: ScoreWeights, narrative: string, profile: UserProfile | null): React.ReactNode {
  switch (id) {
    case 'fitScore': {
      return <FitScoreCell key={id} c={c} weights={weights} narrative={narrative} />
    }
    case 'avgViews':    return <td key={id} className="px-4 py-3">{c.avgViews.toLocaleString()}</td>
    case 'subscribers': return <td key={id} className="px-4 py-3 text-gray-300">{formatSubscribers(c.subscribers)}</td>
    case 'lastPosted':  return (
      <td key={id} className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
        {c.videoDates?.[0] ? <><div>{c.videoDates[0]}</div>{c.videoDates[1] && <div className="text-gray-600">{c.videoDates[1]}</div>}</> : <span className="text-gray-700">—</span>}
      </td>
    )
    case 'email': return (
      <td key={id} className="px-4 py-3 text-xs">
        {c.email ? <a href={buildOutreachEmail(c, profile)} className="text-green-400 hover:underline">{c.email}</a>
          : c.enriching ? <span className="flex items-center gap-1 text-gray-500"><Spinner />looking...</span> : '—'}
      </td>
    )
    case 'linkedin':  return <td key={id} className="px-4 py-3">{c.linkedin  ? <a href={c.linkedin}  target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'website':   return <td key={id} className="px-4 py-3">{c.website   ? <a href={c.website}   target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'instagram': return <td key={id} className="px-4 py-3">{c.instagram ? <a href={c.instagram} target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'twitter':   return <td key={id} className="px-4 py-3">{c.twitter   ? <a href={c.twitter}   target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'tiktok':    return <td key={id} className="px-4 py-3">{c.tiktok    ? <a href={c.tiktok}    target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}</td>
  }
}

// priority: email=3, linkedin only=2, enriching=1, nothing=0
function renderOutreachCell(col: OutreachColConfig, e: OutreachEntry, onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void, profile: UserProfile | null): React.ReactNode {
  const id = col.id
  switch (id) {
    case 'channelName':
      return <AutoTextarea value={e.channelName} onChange={v => onUpdate(e.id, 'channelName', v)} className="text-blue-400 font-medium" />
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
          <AutoTextarea value={e.email} onChange={v => onUpdate(e.id, 'email', v)} placeholder="Add email..." className={e.email ? 'text-gray-600' : 'text-gray-400'} />
        </div>
      )
    case 'description':
      return <AutoTextarea value={e.description} onChange={v => onUpdate(e.id, 'description', v)} placeholder="—" className="text-gray-400" />
    case 'product':
      return <AutoTextarea value={e.product} onChange={v => onUpdate(e.id, 'product', v)} placeholder="Add product..." className="text-gray-200" />
    case 'reachedOut':
      return <input type="checkbox" checked={e.reachedOut} onChange={ev => onUpdate(e.id, 'reachedOut', ev.target.checked)} className="w-4 h-4 rounded accent-purple-500 cursor-pointer mt-0.5" />
    case 'medium':
      return (
        <div className="flex flex-col gap-1">
          <select value={e.medium} onChange={ev => onUpdate(e.id, 'medium', ev.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 w-full">
            <option value="">—</option>
            <option value="Email">Email</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Other">Other</option>
          </select>
          {e.medium === 'Other' && <AutoTextarea value={e.mediumOther} onChange={v => onUpdate(e.id, 'mediumOther', v)} placeholder="specify..." className="text-gray-200" />}
        </div>
      )
    case 'headerUsed':
      return <AutoTextarea value={e.headerUsed} onChange={v => onUpdate(e.id, 'headerUsed', v)} placeholder="Subject line used..." className="text-gray-200" />
    case 'status':
      return (
        <select value={e.status} onChange={ev => onUpdate(e.id, 'status', ev.target.value)}
          className={`w-full rounded px-2 py-0.5 text-xs focus:outline-none border ${e.status === 'Successful' ? 'bg-green-900 border-green-700 text-green-300' : e.status === 'Open' ? 'bg-blue-900 border-blue-700 text-blue-300' : e.status === 'Rejected' ? 'bg-red-900 border-red-700 text-red-300' : e.status === 'No Response' ? 'bg-gray-800 border-gray-600 text-gray-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
          <option value="">—</option>
          <option value="Open">Open</option>
          <option value="No Response">No Response</option>
          <option value="Successful">Successful</option>
          <option value="Rejected">Rejected</option>
        </select>
      )
    case 'notes':
      return <AutoTextarea value={e.notes || ''} onChange={v => onUpdate(e.id, 'notes', v)} placeholder="Notes..." className="text-gray-300" />
    case 'followUpDate':
    case 'dateReachedOut':
    case 'responseDate':
    case 'meetingScheduled':
      return <input type="date" value={(e[id] as string) || ''} onChange={ev => onUpdate(e.id, id, ev.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 w-full" />
    case 'touchpoints':
      return <input type="number" min={0} value={e.touchpoints || ''} onChange={ev => onUpdate(e.id, 'touchpoints', ev.target.value)} placeholder="0" className="w-full bg-transparent text-gray-200 focus:outline-none focus:bg-gray-800 rounded px-1 text-xs" />
    case 'subscribers':
      return <span className="text-xs text-gray-400">{formatSubscribers(e.subscribers || '')}</span>
    case 'avgViews':
      return <span className="text-xs text-gray-400">{e.avgViews ? e.avgViews.toLocaleString() : '—'}</span>
    case 'fitScore': {
      const { label, color } = fitScoreMeta(e.fitScore || 0)
      return <span className={`text-xs font-bold ${color}`}>{e.fitScore || 0} <span className="font-normal opacity-70">{label}</span></span>
    }
    case 'linkedin':
      return e.linkedin ? <a href={e.linkedin} target="_blank" className="text-blue-400 hover:underline text-xs">link</a> : <AutoTextarea value={e.linkedin || ''} onChange={v => onUpdate(e.id, 'linkedin', v)} placeholder="Add URL..." className="text-gray-400" />
    case 'contentNiche':
      return <AutoTextarea value={e.contentNiche || ''} onChange={v => onUpdate(e.id, 'contentNiche', v)} placeholder="e.g. golf, finance..." className="text-gray-200" />
    case 'phone':
      return <AutoTextarea value={e.phone || ''} onChange={v => onUpdate(e.id, 'phone', v)} placeholder="Add phone..." className="text-gray-200" />
    case 'dealValue':
      return <AutoTextarea value={e.dealValue || ''} onChange={v => onUpdate(e.id, 'dealValue', v)} placeholder="$..." className="text-gray-200" />
    case 'contractSent':
      return <input type="checkbox" checked={!!e.contractSent} onChange={ev => onUpdate(e.id, 'contractSent', ev.target.checked)} className="w-4 h-4 rounded accent-blue-500 cursor-pointer mt-0.5" />
    default:
      return null
  }
}

function OutreachTab({ entries, colConfig, onUpdate, onRemove, onOpenCustomize, onReorderCols, profile }: {
  entries: OutreachEntry[]
  colConfig: OutreachColConfig[]
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onRemove: (id: string) => void
  onOpenCustomize: () => void
  onReorderCols: (newConfig: OutreachColConfig[]) => void
  profile: UserProfile | null
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

  function handleColDrop(targetIdx: number) {
    const from = dragIdx.current
    // index 0 is channelName — always locked
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

  if (entries.length === 0) {
    return (
      <div className="mt-4">
        <div className="flex justify-end mb-3">
          <button onClick={onOpenCustomize} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded px-3 py-1.5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Customize Columns
          </button>
        </div>
        <div className="mt-2 border border-dashed border-gray-800 rounded-xl py-16 px-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Your outreach list is empty</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Run a search in <span className="text-gray-300">Results</span>, then click the <span className="text-purple-400">+</span> icon on any creator to add them here. Or use the menu &rarr; Import to upload an Excel of past outreach.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={onOpenCustomize} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded px-3 py-1.5 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Customize Columns
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="table-fixed text-sm border-collapse" style={{ width: totalWidth }}>
          <thead className="bg-gray-800 text-gray-300">
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
                    className={`relative text-left px-3 py-3 select-none font-medium transition-colors ${!isLocked ? 'cursor-grab' : ''} ${isOver ? 'border-l-2 border-blue-400 bg-gray-700' : ''}`}
                  >
                    <span className="truncate flex items-center gap-1">
                      {!isLocked && <span className="text-gray-600 text-xs">⠿</span>}
                      {col.label}
                    </span>
                    <div onMouseDown={e => startResize(e, colId)} className="absolute right-0 top-0 h-full w-2 cursor-col-resize group flex items-center justify-center">
                      <div className="w-px h-4 bg-gray-600 group-hover:bg-blue-400 transition-colors" />
                    </div>
                  </th>
                )
              })}
              <th style={{ width: 36 }} className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-950'}>
                {visibleCols.map(col => (
                  <td key={col.id as string} className="px-3 py-2 align-top" style={{ width: widths[col.id as string] ?? col.defaultWidth }}>
                    {renderOutreachCell(col, e, onUpdate, profile)}
                  </td>
                ))}
                <td className="px-3 py-2 align-top" style={{ width: 36 }}>
                  <button onClick={() => onRemove(e.id)} className="text-gray-700 hover:text-red-400 transition-colors"><TrashIcon /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CreatorTable({ creators, outreachIds, dismissedIds, onAddToOutreach, onDismiss, onReorderCols, loading, sortCol, sortDir, onSort, colConfig, loadMoreBatch, scoreWeights, scoreNarrative, activePlatform, totalUnfiltered, profile }: {
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
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-800 text-gray-300">
          <tr>
            <th className="px-2 py-3 text-center w-12" title="Skip — hide this creator from results">
              <div className="flex flex-col items-center gap-0.5 text-gray-500">
                <DismissIcon active={false} />
                <span className="text-[9px] font-semibold tracking-wide uppercase">Skip</span>
              </div>
            </th>
            <th className="px-2 py-3 text-center w-12" title="Add to Outreach list">
              <div className="flex flex-col items-center gap-0.5 text-gray-500">
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
                  className={`text-left px-4 py-3 select-none whitespace-nowrap transition-colors ${sc ? 'cursor-grab hover:text-white' : ''} ${isOver ? 'border-l-2 border-blue-400 bg-gray-700' : ''}`}
                >
                  <span className="mr-1 text-gray-600 text-xs">⠿</span>
                  {col.label}
                  {sc && <SortIndicator col={sc} sortCol={sortCol} sortDir={sortDir} />}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && !loading && (
            <tr>
              <td colSpan={3 + visibleCols.length} className="px-6 py-10 text-center text-gray-600 text-sm">
                {totalUnfiltered > 0 && activePlatform !== 'youtube'
                  ? `None of the ${totalUnfiltered} results have ${PLATFORM_CONFIGS.find(p => p.id === activePlatform)?.label} linked — try a broader search`
                  : 'Search for a topic above to find creators'}
              </td>
            </tr>
          )}
          {sorted.map((c, i) => (
            <tr key={c.channelId} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-950'}>
              <td className="px-2 py-3 text-center">
                <button
                  onClick={() => onDismiss(c)}
                  title="Skip — hide this creator from results"
                  className={`transition-colors ${dismissedIds.has(c.channelId) ? 'text-red-400' : 'text-gray-500 hover:text-red-400'}`}
                >
                  <DismissIcon active={dismissedIds.has(c.channelId)} />
                </button>
              </td>
              <td className="px-2 py-3 text-center">
                <button
                  onClick={() => onAddToOutreach(c)}
                  title={outreachIds.has(c.channelId) ? 'Remove from Outreach' : 'Add to Outreach'}
                  className={`transition-colors ${outreachIds.has(c.channelId) ? 'text-purple-400' : 'text-gray-500 hover:text-purple-400'}`}
                >
                  <PlusCircleIcon added={outreachIds.has(c.channelId)} />
                </button>
              </td>
              <td className="px-4 py-3"><a href={c.channelUrl} target="_blank" className="text-blue-400 hover:underline font-medium">{c.channelName}</a></td>
              {visibleCols.map(col => renderCell(col.id, c, scoreWeights, scoreNarrative, profile))}
            </tr>
          ))}
          {loadMoreBatch && loadMoreBatch.length > 0 && (
            <>
              <tr>
                <td colSpan={3 + visibleCols.length} className="px-4 py-2 bg-gray-800/60 border-t-2 border-b border-gray-700">
                  <span className="text-xs text-gray-400 font-medium tracking-wide">— {loadMoreBatch.length} additional results —</span>
                </td>
              </tr>
              {loadMoreBatch.map((c, i) => (
                <tr key={`lm-${c.channelId}`} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-950'}>
                  <td className="px-2 py-3 text-center">
                    <button
                      onClick={() => onDismiss(c)}
                      title="Skip — hide this creator from results"
                      className={`transition-colors ${dismissedIds.has(c.channelId) ? 'text-red-400' : 'text-gray-500 hover:text-red-400'}`}
                    >
                      <DismissIcon active={dismissedIds.has(c.channelId)} />
                    </button>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button
                      onClick={() => onAddToOutreach(c)}
                      title={outreachIds.has(c.channelId) ? 'Remove from Outreach' : 'Add to Outreach'}
                      className={`transition-colors ${outreachIds.has(c.channelId) ? 'text-purple-400' : 'text-gray-600 hover:text-purple-400'}`}
                    >
                      <PlusCircleIcon added={outreachIds.has(c.channelId)} />
                    </button>
                  </td>
                  <td className="px-4 py-3"><a href={c.channelUrl} target="_blank" className="text-blue-400 hover:underline font-medium">{c.channelName}</a></td>
                  {visibleCols.map(col => renderCell(col.id, c, scoreWeights, scoreNarrative, profile))}
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
      reachedOut: false,
      medium: '',
      mediumOther: '',
      headerUsed: '',
      status: '',
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
    saveOutreach(outreach.map(e => e.id === id ? { ...e, [field]: value } : e))
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
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className={activeTab === 'outreach' ? 'w-full px-2' : 'max-w-7xl mx-auto'}>

        {/* Header row: title + hamburger */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-3xl font-bold">Creator Outreach</h1>
            <p className="text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
              Find
              <PlatformDropdown activePlatform={activePlatform} onChange={async (newPlatform) => {
                // Save current platform's scoring state
                void savePlatformWeights(activePlatform, scoreWeights)
                void savePlatformNarrative(activePlatform, scoreNarrative)
                void savePlatformGuidance(activePlatform, guidanceEntries)
                // Load new platform's scoring state
                const { weights, narrative, guidance } = await loadPlatformState(newPlatform)
                setScoreWeights(weights)
                setScoreNarrative(narrative)
                setGuidanceEntries(guidance)
                setActivePlatform(newPlatform)
              }} />
              creators and their contact info
            </p>
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
          />
        </div>

        <div className="mb-5" />

        {/* Search bar */}
        <div className="flex gap-3 mb-2 flex-wrap">
          <input
            className="flex-1 min-w-64 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="Search by topic or occupation (e.g. basketball, banking, fitness)"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          {/* Score settings icon */}
          <button
            onClick={() => setShowScoreSettings(true)}
            title="Lead Criteria"
            className={`px-3 py-2 rounded border transition-colors flex items-center gap-1.5 ${JSON.stringify(scoreWeights) !== JSON.stringify(DEFAULT_WEIGHTS) || scoreNarrative || effectiveGuidanceEntries.length > 0 ? 'bg-purple-700 border-purple-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}`}
          >
            <span className="text-sm">⚡</span>
          </button>
          {/* Filter icon */}
          <button
            onClick={() => setShowFilter(v => !v)}
            title={regions.length === 0 ? 'Filters — English-language search (no regional filter)' : regions.length === REGIONS.length ? 'Filters — Global (all regions)' : `Filters — searching: ${regions.map(code => REGIONS.find(r => r.code === code)?.label).join(', ')}`}
            className={`px-3 py-2 rounded border transition-colors flex items-center gap-1.5 ${showFilter || regions.length > 0 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {regions.length > 0 && (
              <span className="text-sm flex gap-px">
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
          <button onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded font-semibold">
            {loading ? 'Searching...' : 'Search'}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExport(v => !v)}
              disabled={activeTab === 'outreach' ? outreach.length === 0 : activeTab === 'dismissed' ? true : currentList.length === 0}
              title="Export"
              className="bg-green-700 hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2 rounded flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            {showExport && (
              <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded shadow-lg z-10">
                {activeTab === 'outreach' ? <>
                  <button onClick={handleExportOutreachExcel} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 flex items-center gap-2">
                    📊 Excel (.xlsx)
                  </button>
                  <button onClick={handleExportOutreachCSV} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 flex items-center gap-2">
                    📄 CSV (Google Sheets)
                  </button>
                </> : <>
                  <button onClick={() => handleExportExcel(currentList)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 flex items-center gap-2">
                    📊 Excel (.xlsx)
                  </button>
                  <button onClick={() => handleExportCSV(currentList)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 flex items-center gap-2">
                    📄 CSV (Google Sheets)
                  </button>
                </>}
              </div>
            )}
          </div>
        </div>

        {/* Filter panel — hidden by default */}
        {showFilter && (
          <div className="flex flex-col gap-3 mb-3 p-3 bg-gray-900 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-400 w-20 shrink-0">Avg views:</span>
              <input type="number" min={0} value={minViews}
                onChange={e => setMinViews(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Min" />
              <span className="text-gray-600 text-xs">to</span>
              <input type="number" min={0} value={maxViews}
                onChange={e => setMaxViews(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Max" />
              <span className="text-gray-600 text-xs">|</span>
              {VIEW_PRESETS.map(p => (
                <button key={p.label} onClick={() => { setMinViews(p.min); setMaxViews(p.max) }}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${minViews === p.min && maxViews === p.max ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-gray-800 pt-3">
              <span className="text-xs text-gray-400 w-20 shrink-0">Last posted:</span>
              {[
                { label: 'Last 7 days', days: 7 },
                { label: 'Last 30 days', days: 30 },
                { label: 'Last 90 days', days: 90 },
                { label: 'Last 6 months', days: 180 },
                { label: 'Any time', days: Infinity },
              ].map(p => (
                <button key={p.label} onClick={() => setMaxAgeDays(p.days)}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${maxAgeDays === p.days ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-gray-800 pt-3">
              <span className="text-xs text-gray-400 w-20 shrink-0">Show only:</span>
              <button
                onClick={() => setEmailOnly(v => !v)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${emailOnly ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}
              >
                Has email
              </button>
            </div>
            <div className="flex items-start gap-3 flex-wrap border-t border-gray-800 pt-3">
              <div className="flex flex-col w-20 shrink-0 mt-1 gap-0.5">
                <span className="text-xs text-gray-400">Region:</span>
                <span className="text-[10px] text-gray-600 leading-snug">Pick countries or go Global for all</span>
              </div>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {/* English = no region filter (default) */}
                <button
                  onClick={() => setRegions([])}
                  title="No regional filter — English-language creators only"
                  className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.length === 0 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}
                >
                  <span>🌐</span>
                  <span>English</span>
                </button>
                {/* Global = all countries */}
                <button
                  onClick={() => setRegions(REGIONS.map(r => r.code))}
                  title="Search across all countries simultaneously — slower but surfaces creators from every region"
                  className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.length === REGIONS.length ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}
                >
                  <span>🗺️</span>
                  <span>Global</span>
                </button>
                {REGIONS.map(r => (
                  <button
                    key={r.code}
                    onClick={() => setRegions(prev => regions.includes(r.code) ? prev.filter(c => c !== r.code) : [...prev, r.code])}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.includes(r.code) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}
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
              <span className="text-sm text-gray-300">
                {enrichProgress.total === 0
                  ? 'Searching YouTube...'
                  : `Enriching ${enrichProgress.current} / ${enrichProgress.total} creators`}
              </span>
              <span className="text-xs text-gray-500 ml-auto">{elapsed}s elapsed</span>
            </div>
            {enrichProgress.total > 0 && (
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </div>
        )}

        {!loading && status && <p className="text-xs text-gray-500 mb-4">{status}</p>}

        {/* Suggestions bar */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setShowSuggestions(v => !v)} className="text-xs text-gray-500 hover:text-gray-300 uppercase tracking-wide flex items-center gap-1 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${showSuggestions ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Suggested searches
            </button>
            {showSuggestions && (
              <button onClick={() => setSuggestions(pickRandom(ALL_OCCUPATIONS, 25))} title="Shuffle suggestions" className="text-gray-500 hover:text-gray-300 border border-gray-700 rounded p-0.5 hover:border-gray-500 transition-colors">
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
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs + Customize */}
        <div className="flex items-center mb-4 border-b border-gray-800">
          <div className="flex gap-1">
            <button onClick={() => setActiveTab('results')} className={`px-5 py-2 text-sm font-medium rounded-t transition-colors ${activeTab === 'results' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              Results {currentList.length > 0 && <span className="ml-1 text-xs text-gray-400">({currentList.length}{currentList.length !== creators.length ? ` of ${creators.length}` : ''})</span>}
            </button>
            <button onClick={() => setActiveTab('outreach')} className={`px-5 py-2 text-sm font-medium rounded-t transition-colors ${activeTab === 'outreach' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              Outreach {outreach.length > 0 && <span className="ml-1 text-xs text-purple-400">({outreach.length})</span>}
            </button>
            <button onClick={() => setActiveTab('dismissed')} className={`px-5 py-2 text-sm font-medium rounded-t transition-colors ${activeTab === 'dismissed' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              Dismissed {dismissed.length > 0 && <span className="ml-1 text-xs text-red-400">({dismissed.length})</span>}
            </button>
          </div>
          <button
            onClick={() => {
              const draft = activePlatform === 'youtube'
                ? colConfig
                : colConfig.filter(c => !YOUTUBE_ONLY_COL_IDS.includes(c.id))
              setDraftCols(draft)
              setShowCustomize(true)
            }}
            className={`ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded px-3 py-1.5 transition-colors mb-1 ${activeTab === 'outreach' || activeTab === 'dismissed' ? 'invisible' : ''}`}
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
            <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <h2 className="font-semibold text-white">Customize Columns</h2>
                <button onClick={() => setShowCustomize(false)} className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 px-5 pt-3 pb-1">Channel is always shown first.</p>
              {activePlatform !== 'youtube' && (
                <p className="text-xs text-gray-600 px-5 pb-2">YouTube-only metrics hidden for {platformConfig.label} view.</p>
              )}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
                {draftCols.map((col, idx) => {
                  const isLocked = platformConfig.column === col.id
                  return (
                    <div key={col.id} className={`flex items-center gap-3 py-2 px-3 rounded group ${isLocked ? 'opacity-60' : 'hover:bg-gray-800'}`}>
                      <input
                        type="checkbox" checked={col.visible}
                        disabled={isLocked}
                        onChange={() => !isLocked && setDraftCols(d => d.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))}
                        className="w-4 h-4 rounded accent-blue-500 disabled:cursor-not-allowed"
                      />
                      <span className="flex-1 text-sm text-gray-200">{col.label}</span>
                      {isLocked
                        ? <span className="text-[10px] text-gray-500 shrink-0">auto-on</span>
                        : (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              disabled={idx === 0}
                              onClick={() => setDraftCols(d => { const n = [...d]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })}
                              className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed px-1"
                            >↑</button>
                            <button
                              disabled={idx === draftCols.length - 1}
                              onClick={() => setDraftCols(d => { const n = [...d]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })}
                              className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed px-1"
                            >↓</button>
                          </div>
                        )
                      }
                    </div>
                  )
                })}
              </div>
              <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
                <button
                  onClick={() => setDraftCols(DEFAULT_COLS)}
                  className="flex-1 px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded hover:border-gray-500 hover:text-white transition-colors"
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

        {showOutreachCustomize && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/50" onClick={() => setShowOutreachCustomize(false)} />
            <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <h2 className="font-semibold text-white">Outreach Columns</h2>
                <button onClick={() => setShowOutreachCustomize(false)} className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 px-5 pt-3 pb-1">Toggle columns on/off and drag to reorder.</p>
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
                {draftOutreachCols.map((col, idx) => (
                  <div key={col.id as string} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-gray-800 group">
                    <input type="checkbox" checked={col.visible}
                      onChange={() => setDraftOutreachCols(d => d.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))}
                      className="w-4 h-4 rounded accent-purple-500"
                    />
                    <span className="flex-1 text-sm text-gray-200">{col.label}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button disabled={idx === 0} onClick={() => setDraftOutreachCols(d => { const n = [...d]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })} className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed px-1">↑</button>
                      <button disabled={idx === draftOutreachCols.length - 1} onClick={() => setDraftOutreachCols(d => { const n = [...d]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })} className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed px-1">↓</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
                <button onClick={() => setDraftOutreachCols(DEFAULT_OUTREACH_COLS)} className="flex-1 px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded hover:border-gray-500 hover:text-white transition-colors">Reset</button>
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
          <OutreachTab
            entries={outreach}
            colConfig={outreachColConfig}
            onUpdate={updateOutreachEntry}
            onRemove={removeOutreachEntry}
            onOpenCustomize={() => { setDraftOutreachCols(outreachColConfig); setShowOutreachCustomize(true) }}
            onReorderCols={reorderOutreachCols}
            profile={profile}
          />
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
            />
            {activeTab === 'results' && (
              <div className="mt-5 flex flex-col items-center gap-2">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Spinner />
                    <span>Loading more creators...</span>
                  </div>
                ) : (
                  <button
                    onClick={handleLoadMore}
                    disabled={!currentKeyword || loading}
                    className="px-6 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
    </main>
    </GuidanceContext.Provider>
  )
}
