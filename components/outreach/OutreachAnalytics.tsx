'use client'

/**
 * OutreachAnalytics — comprehensive cross-tab analytics for the
 * outreach pipeline AND active-client engagements.
 *
 * v3 (2026-05-21):
 *   • Pipeline funnel hero visualises lead → reached out → responded
 *     → won → active. Conversion % between each step.
 *   • Active-client block: total clients, total booked, personal
 *     revenue (net of team splits), lifecycle distribution,
 *     completed-engagement quality (rating + repeat likelihood).
 *   • Cross-references: outreach medium → active-client conversion,
 *     status path breakdown.
 *   • Existing outreach stats + status breakdown + velocity + medium
 *     + custom metrics all preserved.
 *
 * All metrics derive from the same `entries` array — active clients
 * are entries with status='Successful', so we don't need a second
 * data source. Personal revenue uses resolveCollaboratorShare to
 * respect each row's $/% share type.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { OutreachEntry } from '@/lib/types'
import { AStat } from '@/components/shared/AStat'
import { StackedBar } from '@/components/shared/StackedBar'
import { CustomMetricCard } from '@/components/outreach/CustomMetricCard'
import { computeMetrics, isReachedOut, pct } from '@/components/outreach/analyticsMetrics'
import {
  Users, Briefcase, TrendingUp, Award, Star,
  Activity, Target, ArrowRight,
} from 'lucide-react'

export function OutreachAnalytics({ entries, customMetrics, onOpenCustomize, onExportExcel, onExportCsv }: {
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

  // ── Mediums-by-scope toggle (existing widget) ──────────────────────
  const [mediumScope, setMediumScope] = useState<'all' | 'successful' | 'rejected'>('all')

  // ── All metric computation, memoised so the visual layer is dumb ──
  const m = useMemo(() => computeMetrics(entries), [entries])

  if (entries.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center">
        <p className="text-muted-foreground text-sm">
          No outreach yet — add some entries first to see analytics.
        </p>
      </div>
    )
  }

  // Medium-by-scope counts use the live toggle so they don't go into
  // the useMemo above (would re-compute every metric on toggle).
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
    <div className="space-y-8">
      {/* Settings gear (top right) — same affordance as before */}
      <div className="flex justify-end -mt-2">
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
                onClick={() => { onOpenCustomize(); setShowSettings(false) }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-b border-border/60"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h13M3 12h13M3 18h7" />
                </svg>
                Customize metrics
              </button>
              <button
                type="button"
                onClick={() => { onExportExcel(); setShowSettings(false) }}
                disabled={entries.length === 0}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-base leading-none">📊</span>
                Export Excel
              </button>
              <button
                type="button"
                onClick={() => { onExportCsv(); setShowSettings(false) }}
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

      {/* ── HERO — Pipeline funnel ─────────────────────────────────── */}
      <FunnelHero
        leads={m.total}
        reachedOut={m.reachedOut}
        responded={m.responseReceived}
        won={m.successful}
        activeNow={m.activeNow}
      />

      {/* ── Outreach section ───────────────────────────────────────── */}
      <SectionHeader
        title="Outreach"
        subtitle="Pipeline volume, response and win rates, follow-up health"
        icon={<Target className="w-4 h-4" />}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <AStat label="In pipeline" value={m.total} />
        <AStat
          label="Reached out"
          value={m.reachedOut}
          sub={m.total > 0 ? `${pct(m.reachedOut, m.total)}% of pipeline` : undefined}
        />
        <AStat label="Response received" value={m.responseReceived} sub="Successful + Rejected" />
        <AStat
          label="Response rate"
          value={`${m.responseRate}%`}
          sub={`${m.responseReceived} of ${m.reachedOut} reached out`}
        />
        <AStat
          label="Win rate"
          value={`${m.winRate}%`}
          sub={`${m.successful} of ${m.responseReceived} responses`}
        />
        <AStat
          label="Pipeline $"
          value={m.pipelineValue > 0 ? `$${m.pipelineValue.toLocaleString()}` : '—'}
          sub="non-rejected"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <AStat label="Stale follow-ups" value={m.stale} highlight={m.stale > 0} />
        <AStat
          label="Avg time to respond"
          value={m.avgRespondDays != null ? `${m.avgRespondDays}d` : '—'}
          sub="reached out → response"
        />
        <AStat
          label="Avg touchpoints to win"
          value={m.avgTouchpointsToWin != null ? m.avgTouchpointsToWin : '—'}
          sub="across Successful entries"
        />
        <AStat
          label="Favorites"
          value={m.favoritedCount}
          sub={m.total > 0 ? `${pct(m.favoritedCount, m.total)}% of pipeline` : undefined}
        />
        <AStat label="Contracts sent" value={m.contractsSentCount} />
        <AStat label="Meetings scheduled" value={m.meetingsScheduledCount} />
      </div>

      {/* Status breakdown */}
      <div className="bg-card/40 border border-border rounded-xl p-5">
        <div className="text-sm font-semibold text-foreground mb-3">Status breakdown</div>
        <StackedBar
          segments={[
            { label: 'Successful', value: m.successful, color: 'bg-green-500' },
            { label: 'Open', value: m.open, color: 'bg-blue-500' },
            { label: 'No Response', value: m.noResponse, color: 'bg-gray-500' },
            { label: 'Rejected', value: m.rejected, color: 'bg-red-500' },
            { label: 'Not Outreached', value: m.notOutreached, color: 'bg-muted' },
          ]}
          total={m.total}
        />
      </div>

      {/* ── Active Clients section ─────────────────────────────────── */}
      <SectionHeader
        title="Active Clients"
        subtitle="Engagements that converted from outreach to paying work"
        icon={<Briefcase className="w-4 h-4" />}
      />
      {m.successful === 0 ? (
        <EmptyHint>
          No engagements yet. Mark an outreach entry <strong>Successful</strong>{' '}
          to see active-client analytics here.
        </EmptyHint>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <AStat label="Total clients" value={m.successful} />
            <AStat
              label="Total booked"
              value={m.totalBooked > 0 ? `$${m.totalBooked.toLocaleString()}` : '—'}
              sub={m.withBudgetCount > 0 ? `${m.withBudgetCount} priced` : 'none priced yet'}
            />
            <AStat
              label="Personal revenue"
              value={m.personalRevenue > 0 ? `$${m.personalRevenue.toLocaleString()}` : '—'}
              sub={m.totalCollaboratorShare > 0
                ? `$${m.totalCollaboratorShare.toLocaleString()} to team`
                : 'no team splits'}
            />
            <AStat
              label="Avg deal"
              value={m.avgDeal > 0 ? `$${Math.round(m.avgDeal).toLocaleString()}` : '—'}
              sub={m.withBudgetCount > 0 ? `${m.withBudgetCount} priced` : undefined}
            />
            <AStat
              label="Completed"
              value={m.completedCount}
              sub={m.totalCompletedValue > 0 ? `$${m.totalCompletedValue.toLocaleString()} realised` : undefined}
            />
            <AStat
              label="Avg engagement"
              value={m.avgDurationDays != null ? `${m.avgDurationDays}d` : '—'}
              sub={m.durationCount > 0 ? `${m.durationCount} dated` : 'no dates set'}
            />
          </div>

          {/* Lifecycle distribution */}
          <div className="bg-card/40 border border-border rounded-xl p-5">
            <div className="text-sm font-semibold text-foreground mb-3">Lifecycle</div>
            <StackedBar
              segments={[
                { label: 'Active', value: m.lifecycle.active, color: 'bg-green-500' },
                { label: 'Paused', value: m.lifecycle.paused, color: 'bg-amber-500' },
                { label: 'Completed', value: m.lifecycle.completed, color: 'bg-blue-500' },
                { label: 'Churned', value: m.lifecycle.churned, color: 'bg-rose-500' },
              ]}
              total={m.successful}
            />
          </div>

          {/* Completed-engagement quality */}
          {m.completedCount > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-card/40 border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-foreground">Client satisfaction</div>
                  <Award className="w-4 h-4 text-amber-500" aria-hidden />
                </div>
                {m.avgRating != null ? (
                  <>
                    <div className="flex items-baseline gap-2 mb-2">
                      <div className="text-3xl font-bold text-foreground tabular-nums">
                        {m.avgRating.toFixed(1)}
                      </div>
                      <div className="text-sm text-muted-foreground">/ 5.0</div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star
                          key={n}
                          className={`w-4 h-4 ${n <= Math.round(m.avgRating!) ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30'}`}
                          aria-hidden
                        />
                      ))}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2">
                      Across {m.ratedCount} rated completed engagement{m.ratedCount === 1 ? '' : 's'}.
                    </div>
                  </>
                ) : (
                  <p className="text-[12.5px] text-muted-foreground/75 italic">
                    No ratings yet — fill in the rating when wrapping up a completed engagement.
                  </p>
                )}
              </div>

              <div className="bg-card/40 border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-foreground">Repeat likelihood</div>
                  <Activity className="w-4 h-4 text-purple-500" aria-hidden />
                </div>
                {m.repeatCount > 0 ? (
                  <StackedBar
                    segments={[
                      { label: 'Definitely', value: m.repeat.definitely, color: 'bg-green-500' },
                      { label: 'Likely',     value: m.repeat.likely,     color: 'bg-blue-500' },
                      { label: 'Maybe',      value: m.repeat.maybe,      color: 'bg-amber-500' },
                      { label: 'No',         value: m.repeat.no,         color: 'bg-rose-500' },
                    ]}
                    total={m.repeatCount}
                  />
                ) : (
                  <p className="text-[12.5px] text-muted-foreground/75 italic">
                    No repeat-likelihood data yet — set it when wrapping up.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Conversion / cross-references ──────────────────────────── */}
      <SectionHeader
        title="Conversion"
        subtitle="Which outreach paths actually turn into paying clients"
        icon={<TrendingUp className="w-4 h-4" />}
      />
      <div className="grid md:grid-cols-2 gap-4">
        {/* Medium → active conversion */}
        <div className="bg-card/40 border border-border rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-3">By medium</div>
          {(['Email', 'LinkedIn', 'Other'] as const).map(med => {
            const stats = m.byMedium[med]
            return (
              <MediumConversionRow
                key={med}
                label={med}
                reached={stats.reached}
                won={stats.won}
              />
            )
          })}
        </div>

        {/* Win-rate-by-segment */}
        <div className="bg-card/40 border border-border rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-3">Where wins came from</div>
          <div className="space-y-2">
            <KeyValueRow
              label="With contract sent"
              valueLeft={m.winsWithContract}
              valueRight={`${pct(m.winsWithContract, m.successful)}% of wins`}
            />
            <KeyValueRow
              label="With meeting scheduled"
              valueLeft={m.winsWithMeeting}
              valueRight={`${pct(m.winsWithMeeting, m.successful)}% of wins`}
            />
            <KeyValueRow
              label="Favorited at some point"
              valueLeft={m.winsFavorited}
              valueRight={`${pct(m.winsFavorited, m.successful)}% of wins`}
            />
            <KeyValueRow
              label="Avg touchpoints"
              valueLeft={m.avgTouchpointsToWin ?? '—'}
              valueRight={undefined}
            />
          </div>
        </div>
      </div>

      {/* ── Velocity + medium volume (existing) ────────────────────── */}
      <SectionHeader
        title="Activity"
        subtitle="Recent additions, reach-outs, and outreach mix"
        icon={<Activity className="w-4 h-4" />}
      />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card/40 border border-border rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-3">Velocity (last 7 days)</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-2xl font-bold text-foreground tabular-nums">{m.addedLast7}</div>
              <div className="text-[11px] text-muted-foreground">added</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tabular-nums">{m.reachedLast7}</div>
              <div className="text-[11px] text-muted-foreground">reached out</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tabular-nums">{m.wonLast30}</div>
              <div className="text-[11px] text-muted-foreground">won (30d)</div>
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
                { label: 'Email',    value: mediumCounts.Email,    color: 'bg-purple-500' },
                { label: 'LinkedIn', value: mediumCounts.LinkedIn, color: 'bg-blue-500' },
                { label: 'Other',    value: mediumCounts.Other,    color: 'bg-gray-500' },
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

      {/* ── Custom metrics ─────────────────────────────────────────── */}
      {customMetrics.length > 0 && (
        <div>
          <SectionHeader
            title="My metrics"
            subtitle="Custom counts and rates you've defined"
            icon={<Users className="w-4 h-4" />}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {customMetrics.map(cm => (
              <CustomMetricCard key={cm.id} metric={cm} entries={entries} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────

function SectionHeader({
  title, subtitle, icon,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 mt-2 mb-1">
      {icon && (
        <div className="shrink-0 w-8 h-8 rounded-lg bg-muted/60 border border-border flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-base font-semibold text-foreground tracking-tight">{title}</div>
        {subtitle && (
          <div className="text-[12px] text-muted-foreground/80 truncate">{subtitle}</div>
        )}
      </div>
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-border rounded-xl py-6 px-5 text-center text-[13px] text-muted-foreground/85">
      {children}
    </div>
  )
}

/**
 * FunnelHero — visual pipeline funnel: Leads → Reached → Responded
 * → Won → Active now. Each step renders as a bar whose width is the
 * count relative to the leads baseline. Conversion % between adjacent
 * steps surfaces in small chips above the arrow.
 */
function FunnelHero({
  leads, reachedOut, responded, won, activeNow,
}: {
  leads: number
  reachedOut: number
  responded: number
  won: number
  activeNow: number
}) {
  const max = Math.max(1, leads)
  const steps = [
    { id: 'leads',    label: 'Leads',         value: leads,      color: 'bg-purple-500/80' },
    { id: 'reached',  label: 'Reached out',   value: reachedOut, color: 'bg-blue-500/80' },
    { id: 'response', label: 'Responded',     value: responded,  color: 'bg-cyan-500/80' },
    { id: 'won',      label: 'Won',           value: won,        color: 'bg-green-500/80' },
    { id: 'active',   label: 'Active now',    value: activeNow,  color: 'bg-emerald-500/80' },
  ]
  return (
    <div className="bg-gradient-to-br from-purple-500/[0.06] via-card/40 to-blue-500/[0.06] border border-border rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-purple-500" aria-hidden />
        <h2 className="text-base font-semibold text-foreground tracking-tight">Pipeline funnel</h2>
        <span className="text-[11.5px] text-muted-foreground/80">— from lead to active client</span>
      </div>
      <div className="space-y-2">
        {steps.map((step, i) => {
          const prev = i > 0 ? steps[i - 1].value : null
          const conv = prev != null && prev > 0 ? Math.round((step.value / prev) * 100) : null
          const widthPct = Math.max(2, (step.value / max) * 100)
          return (
            <div key={step.id}>
              {i > 0 && (
                <div className="flex items-center gap-1.5 pl-1 py-0.5 text-[10.5px] text-muted-foreground/75">
                  <ArrowRight className="w-3 h-3" aria-hidden />
                  <span className="tabular-nums">{conv != null ? `${conv}%` : '—'}</span>
                  <span>convert</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-[12.5px] text-foreground font-medium">{step.label}</div>
                <div className="flex-1 h-7 bg-muted/40 rounded-md overflow-hidden">
                  <div
                    className={`h-full ${step.color} transition-[width] duration-500 flex items-center justify-end px-2`}
                    style={{ width: `${widthPct}%` }}
                  >
                    <span className="text-[11px] font-semibold text-white tabular-nums drop-shadow">
                      {step.value}
                    </span>
                  </div>
                </div>
                <div className="w-12 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                  {leads > 0 ? `${Math.round((step.value / leads) * 100)}%` : '—'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MediumConversionRow({
  label, reached, won,
}: {
  label: string
  reached: number
  won: number
}) {
  const conv = reached > 0 ? Math.round((won / reached) * 100) : 0
  return (
    <div className="py-2 border-t border-border/50 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[12.5px] font-medium text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          <span className="text-foreground font-semibold">{won}</span> won{' '}
          <span className="text-muted-foreground/60">/</span>{' '}
          <span>{reached}</span> reached
        </div>
      </div>
      <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500/70 transition-[width]"
          style={{ width: reached > 0 ? `${conv}%` : '0%' }}
          aria-hidden
        />
      </div>
      <div className="text-[10.5px] text-muted-foreground mt-1 tabular-nums">
        {reached > 0 ? `${conv}% conversion to active` : 'no outreach yet'}
      </div>
    </div>
  )
}

function KeyValueRow({
  label, valueLeft, valueRight,
}: {
  label: string
  valueLeft: number | string
  valueRight?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12.5px] py-1.5 border-t border-border/50 first:border-t-0 first:pt-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2 tabular-nums">
        <span className="text-foreground font-semibold">{valueLeft}</span>
        {valueRight && (
          <span className="text-[10.5px] text-muted-foreground/75">{valueRight}</span>
        )}
      </div>
    </div>
  )
}

