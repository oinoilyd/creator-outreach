'use client'

/**
 * OutreachAnalytics v4 — preset-driven dashboard with global time
 * range, density toggle, period-over-period deltas, AI insight card,
 * and Recharts-backed widgets.
 *
 * Three presets:
 *   • "Sales pipeline"    — funnel, outreach KPIs, velocity, status
 *                            mix, by-medium volume + conversion
 *   • "Active clients"    — engagement KPIs, lifecycle donut,
 *                            completed-engagement quality, wins source
 *   • "Cash flow"         — $ KPIs (booked, personal, avg, completed),
 *                            cumulative-revenue line, $ by medium
 *
 * Global controls (top bar):
 *   • Preset selector — segmented pill control
 *   • Time range     — Last 7d / 30d / 90d / YTD / All / Custom
 *   • Density        — Comfortable / Compact
 *   • Settings gear  — Customize metrics + Export CSV/Excel
 *
 * Persistence:
 *   Preset, density, time range live in localStorage. Survives reload
 *   without a DB migration. Custom metrics + AI insight cache also
 *   client-side.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { OutreachEntry } from '@/lib/types'
import { CustomMetricCard } from '@/components/outreach/CustomMetricCard'
import {
  computeMetrics, filterByTimeRange, resolveTimeRange, previousTimeRange,
  bucketedSeries, type TimeRangeId, type TimeRange, type ComputedMetrics,
} from '@/components/outreach/analyticsMetrics'
import {
  ChartCard, StatCard, FunnelHero, VelocityChart, CumulativeRevenueChart,
  MediumBarChart, LifecycleDonut, StatusStack, MediumConversionRow,
} from '@/components/outreach/analyticsWidgets'
import { AnalyticsInsightCard } from '@/components/outreach/AnalyticsInsightCard'
import {
  Target, Briefcase, Wallet, Award, Activity, Star, TrendingUp,
  Calendar, LayoutGrid, Rows3,
} from 'lucide-react'

// ── Preset definitions ──────────────────────────────────────────────

type PresetId = 'sales' | 'active' | 'cash'

const PRESETS: { id: PresetId; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'sales',  label: 'Sales pipeline', icon: <Target    className="w-3.5 h-3.5" />, description: 'Lead → reached → responded → won' },
  { id: 'active', label: 'Active clients', icon: <Briefcase className="w-3.5 h-3.5" />, description: 'Engagement health + quality' },
  { id: 'cash',   label: 'Cash flow',      icon: <Wallet    className="w-3.5 h-3.5" />, description: 'Booked, personal revenue, deal mix' },
]

type Density = 'comfortable' | 'compact'

const TIME_RANGE_OPTIONS: { id: TimeRangeId; label: string }[] = [
  { id: 'last7',  label: '7d' },
  { id: 'last30', label: '30d' },
  { id: 'last90', label: '90d' },
  { id: 'ytd',   label: 'YTD' },
  { id: 'all',   label: 'All' },
]

// ── localStorage keys ───────────────────────────────────────────────

const LS_PRESET   = 'creator-outreach.analytics.preset'
const LS_DENSITY  = 'creator-outreach.analytics.density'
const LS_RANGE    = 'creator-outreach.analytics.range'

function readLS<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const v = window.localStorage.getItem(key)
  return (v && (allowed as readonly string[]).includes(v)) ? (v as T) : fallback
}

function writeLS(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, value) } catch { /* ignore */ }
}

// ── Main component ──────────────────────────────────────────────────

export function OutreachAnalytics({ entries, customMetrics, onOpenCustomize, onExportExcel, onExportCsv }: {
  entries: OutreachEntry[]
  customMetrics: import('@/lib/types').CustomMetric[]
  onOpenCustomize: () => void
  onExportExcel: () => void
  onExportCsv: () => void
}) {
  // Persisted prefs
  const [preset, setPresetState] = useState<PresetId>(() =>
    readLS<PresetId>(LS_PRESET, ['sales', 'active', 'cash'], 'sales'),
  )
  const [density, setDensityState] = useState<Density>(() =>
    readLS<Density>(LS_DENSITY, ['comfortable', 'compact'], 'comfortable'),
  )
  const [rangeId, setRangeIdState] = useState<TimeRangeId>(() =>
    readLS<TimeRangeId>(LS_RANGE, ['last7', 'last30', 'last90', 'ytd', 'all', 'custom'], 'all'),
  )

  function setPreset(v: PresetId)   { setPresetState(v);   writeLS(LS_PRESET, v) }
  function setDensity(v: Density)   { setDensityState(v);  writeLS(LS_DENSITY, v) }
  function setRangeId(v: TimeRangeId) { setRangeIdState(v); writeLS(LS_RANGE, v) }

  // Settings gear popover state — same affordance as before.
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showSettings) return
    function onClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setShowSettings(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [showSettings])

  // Resolve range + compute metrics for current and previous periods.
  const range = useMemo(() => resolveTimeRange(rangeId), [rangeId])
  const prevRange = useMemo(() => previousTimeRange(range), [range])

  const filteredCurrent = useMemo(() => filterByTimeRange(entries, range), [entries, range])
  const filteredPrev    = useMemo(() => prevRange ? filterByTimeRange(entries, prevRange) : null, [entries, prevRange])

  const m  = useMemo(() => computeMetrics(filteredCurrent), [filteredCurrent])
  const pm = useMemo(() => filteredPrev ? computeMetrics(filteredPrev) : null, [filteredPrev])

  const series = useMemo(() => bucketedSeries(filteredCurrent, range), [filteredCurrent, range])

  if (entries.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center">
        <p className="text-muted-foreground text-sm">
          No outreach yet — add some entries first to see analytics.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* LEFT — preset selector */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 border border-border">
          {PRESETS.map(p => {
            const active = preset === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                title={p.description}
                aria-pressed={active}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors',
                  active
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                ].join(' ')}
              >
                {p.icon}
                {p.label}
              </button>
            )
          })}
        </div>

        {/* RIGHT — time range + density + settings */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 border border-border">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground ml-1.5 mr-0.5" aria-hidden />
            {TIME_RANGE_OPTIONS.map(opt => {
              const active = rangeId === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRangeId(opt.id)}
                  aria-pressed={active}
                  className={[
                    'px-2.5 py-1 rounded-md text-[11.5px] font-medium tabular-nums transition-colors',
                    active
                      ? 'bg-card text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-1 border border-border" role="group" aria-label="Density">
            <button
              type="button"
              onClick={() => setDensity('comfortable')}
              aria-pressed={density === 'comfortable'}
              title="Comfortable density"
              className={[
                'w-7 h-7 inline-flex items-center justify-center rounded-md transition-colors',
                density === 'comfortable'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              ].join(' ')}
            >
              <Rows3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDensity('compact')}
              aria-pressed={density === 'compact'}
              title="Compact density"
              className={[
                'w-7 h-7 inline-flex items-center justify-center rounded-md transition-colors',
                density === 'compact'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              ].join(' ')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Settings gear */}
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              onClick={() => setShowSettings(v => !v)}
              title="Analytics settings"
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
                  Customize metrics
                </button>
                <button
                  type="button"
                  onClick={() => { onExportExcel(); setShowSettings(false) }}
                  disabled={entries.length === 0}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => { onExportCsv(); setShowSettings(false) }}
                  disabled={entries.length === 0}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-t border-border/60 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Export CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI insight (always shown, above the preset) ──────────── */}
      <AnalyticsInsightCard
        current={m}
        previous={pm ?? undefined}
        rangeLabel={range.label}
        cacheKey={`${preset}-${rangeId}`}
      />

      {/* ── Preset body ──────────────────────────────────────────── */}
      {preset === 'sales'  && <SalesPipelinePreset  m={m} pm={pm} series={series} density={density} />}
      {preset === 'active' && <ActiveClientsPreset  m={m} pm={pm} density={density} />}
      {preset === 'cash'   && <CashFlowPreset       m={m} pm={pm} series={series} density={density} />}

      {/* ── Custom metrics — always available regardless of preset ─ */}
      {customMetrics.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-foreground tracking-tight mb-3">
            My metrics
          </div>
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

// ── Presets ──────────────────────────────────────────────────────────

interface PresetProps {
  m: ComputedMetrics
  pm: ComputedMetrics | null
  density: Density
}

interface PresetWithSeriesProps extends PresetProps {
  series: ReturnType<typeof bucketedSeries>
}

function SalesPipelinePreset({ m, pm, series, density }: PresetWithSeriesProps) {
  return (
    <div className="space-y-5">
      <FunnelHero
        leads={m.total}
        reachedOut={m.reachedOut}
        responded={m.responseReceived}
        won={m.successful}
        activeNow={m.activeNow}
        density={density}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard density={density} label="In pipeline"      value={m.total}            previous={pm?.total} />
        <StatCard density={density} label="Reached out"      value={m.reachedOut}       previous={pm?.reachedOut} />
        <StatCard density={density} label="Responded"        value={m.responseReceived} previous={pm?.responseReceived} sub="Successful + Rejected" />
        <StatCard density={density} label="Response rate"    value={`${m.responseRate}%`} sub={`${m.responseReceived} of ${m.reachedOut}`} />
        <StatCard density={density} label="Win rate"         value={`${m.winRate}%`}     sub={`${m.successful} of ${m.responseReceived}`} />
        <StatCard density={density} label="Pipeline $"       value={m.pipelineValue > 0 ? `$${m.pipelineValue.toLocaleString()}` : '—'} sub="non-rejected" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard density={density} title="Velocity" subtitle="Added / reached out / won over time" icon={<Activity className="w-3.5 h-3.5" />}>
            <VelocityChart data={series} />
          </ChartCard>
        </div>
        <ChartCard density={density} title="Status breakdown" icon={<TrendingUp className="w-3.5 h-3.5" />}>
          <StatusStack
            successful={m.successful}
            open={m.open}
            noResponse={m.noResponse}
            rejected={m.rejected}
            notOutreached={m.notOutreached}
            total={m.total}
          />
        </ChartCard>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard density={density} title="By medium" subtitle="Reached vs won by channel" icon={<Activity className="w-3.5 h-3.5" />}>
          <MediumBarChart
            data={[
              { medium: 'Email',    reached: m.byMedium.Email.reached,    won: m.byMedium.Email.won    },
              { medium: 'LinkedIn', reached: m.byMedium.LinkedIn.reached, won: m.byMedium.LinkedIn.won },
              { medium: 'Other',    reached: m.byMedium.Other.reached,    won: m.byMedium.Other.won    },
            ]}
          />
        </ChartCard>
        <ChartCard density={density} title="Conversion by medium" subtitle="Outreach → active client rate" icon={<TrendingUp className="w-3.5 h-3.5" />}>
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
        </ChartCard>
      </div>
    </div>
  )
}

function ActiveClientsPreset({ m, pm, density }: PresetProps) {
  if (m.successful === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-12 px-6 text-center">
        <p className="text-[13px] text-muted-foreground/85">
          No engagements yet. Mark an outreach entry <strong>Successful</strong>{' '}
          to start seeing active-client analytics here.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard density={density} label="Total clients"   value={m.successful}                                                          previous={pm?.successful} />
        <StatCard density={density} label="Total booked"    value={m.totalBooked > 0 ? `$${m.totalBooked.toLocaleString()}` : '—'}        sub={`${m.withBudgetCount} priced`} />
        <StatCard density={density} label="Personal revenue" value={m.personalRevenue > 0 ? `$${m.personalRevenue.toLocaleString()}` : '—'} sub={m.totalCollaboratorShare > 0 ? `$${m.totalCollaboratorShare.toLocaleString()} to team` : 'no team splits'} />
        <StatCard density={density} label="Avg deal"        value={m.avgDeal > 0 ? `$${Math.round(m.avgDeal).toLocaleString()}` : '—'}    sub={m.withBudgetCount > 0 ? `${m.withBudgetCount} priced` : undefined} />
        <StatCard density={density} label="Completed"       value={m.completedCount}                                                       sub={m.totalCompletedValue > 0 ? `$${m.totalCompletedValue.toLocaleString()} realised` : undefined} />
        <StatCard density={density} label="Avg engagement"  value={m.avgDurationDays != null ? `${m.avgDurationDays}d` : '—'}              sub={m.durationCount > 0 ? `${m.durationCount} dated` : 'no dates set'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard density={density} title="Lifecycle" subtitle="Distribution across engagement states" icon={<Briefcase className="w-3.5 h-3.5" />}>
          <LifecycleDonut
            active={m.lifecycle.active}
            paused={m.lifecycle.paused}
            completed={m.lifecycle.completed}
            churned={m.lifecycle.churned}
          />
        </ChartCard>

        {m.completedCount > 0 ? (
          <>
            <ChartCard density={density} title="Client satisfaction" subtitle={`Across ${m.ratedCount} rated completion${m.ratedCount === 1 ? '' : 's'}`} icon={<Award className="w-3.5 h-3.5" />}>
              {m.avgRating != null ? (
                <>
                  <div className="flex items-baseline gap-2 mb-2">
                    <div className="text-3xl font-bold text-foreground tabular-nums">{m.avgRating.toFixed(1)}</div>
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
                </>
              ) : (
                <p className="text-[12.5px] text-muted-foreground/75 italic">
                  No ratings yet — fill in the rating when wrapping up.
                </p>
              )}
            </ChartCard>
            <ChartCard density={density} title="Repeat likelihood" subtitle="Pulled from wrap-up data" icon={<Activity className="w-3.5 h-3.5" />}>
              {m.repeatCount > 0 ? (
                <RepeatBreakdown repeat={m.repeat} total={m.repeatCount} />
              ) : (
                <p className="text-[12.5px] text-muted-foreground/75 italic">
                  No repeat-likelihood data yet — set it when wrapping up.
                </p>
              )}
            </ChartCard>
          </>
        ) : (
          <div className="lg:col-span-2 border border-dashed border-border rounded-xl p-6 text-center text-[12.5px] text-muted-foreground/85">
            Complete an engagement (set lifecycle to <strong>Completed</strong>) to populate
            satisfaction + repeat-likelihood widgets.
          </div>
        )}
      </div>

      <ChartCard density={density} title="Where wins came from" subtitle="What predicts a Successful outcome" icon={<TrendingUp className="w-3.5 h-3.5" />}>
        <div className="space-y-2">
          <KVRow label="With contract sent"      value={m.winsWithContract}  sub={`${pct(m.winsWithContract, m.successful)}% of wins`} />
          <KVRow label="With meeting scheduled"  value={m.winsWithMeeting}   sub={`${pct(m.winsWithMeeting, m.successful)}% of wins`} />
          <KVRow label="Favorited at some point" value={m.winsFavorited}     sub={`${pct(m.winsFavorited, m.successful)}% of wins`} />
          <KVRow label="Avg touchpoints"         value={m.avgTouchpointsToWin ?? '—'} />
        </div>
      </ChartCard>
    </div>
  )
}

function CashFlowPreset({ m, pm, series, density }: PresetWithSeriesProps) {
  // Cumulative-won-$ series from the bucketed won counts × avg deal.
  // Honest about the approximation: we don't have per-deal dollar
  // history, so this assumes wins in each bucket are valued at the
  // overall avgDeal. Good enough for a trend line; we'll do real
  // per-deal $ history once we have an outreach_events log.
  const cumulative = useMemo(() => {
    const avg = m.avgDeal || 0
    let running = 0
    return series.map(b => {
      running += b.won * avg
      return { label: b.label, cumulative: Math.round(running) }
    })
  }, [series, m.avgDeal])

  const outstanding = Math.max(0, m.totalBooked - m.totalCompletedValue)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard density={density} label="Pipeline $"       value={m.pipelineValue > 0 ? `$${m.pipelineValue.toLocaleString()}` : '—'} sub="non-rejected" />
        <StatCard density={density} label="Total booked"     value={m.totalBooked > 0 ? `$${m.totalBooked.toLocaleString()}` : '—'} previous={pm?.totalBooked} sub={`${m.withBudgetCount} priced`} />
        <StatCard density={density} label="Personal revenue" value={m.personalRevenue > 0 ? `$${m.personalRevenue.toLocaleString()}` : '—'} previous={pm?.personalRevenue} sub={m.totalCollaboratorShare > 0 ? `$${m.totalCollaboratorShare.toLocaleString()} to team` : 'no team splits'} />
        <StatCard density={density} label="Avg deal"         value={m.avgDeal > 0 ? `$${Math.round(m.avgDeal).toLocaleString()}` : '—'} previous={pm?.avgDeal} sub={m.withBudgetCount > 0 ? `${m.withBudgetCount} priced` : undefined} />
        <StatCard density={density} label="Realised"         value={m.totalCompletedValue > 0 ? `$${m.totalCompletedValue.toLocaleString()}` : '—'} sub={`${m.completedCount} completed`} />
        <StatCard density={density} label="Outstanding"      value={outstanding > 0 ? `$${outstanding.toLocaleString()}` : '—'} sub="booked − realised" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard density={density} title="Cumulative revenue" subtitle="Won deals × avg deal value, accumulated over time" icon={<Activity className="w-3.5 h-3.5" />}>
            {cumulative.length > 0 && cumulative.some(c => c.cumulative > 0) ? (
              <CumulativeRevenueChart data={cumulative} />
            ) : (
              <div className="py-6 text-center text-[12.5px] text-muted-foreground/85 italic">
                No won deals in this range yet.
              </div>
            )}
          </ChartCard>
        </div>
        <ChartCard density={density} title="Where the $ came from" subtitle="Wins by medium" icon={<TrendingUp className="w-3.5 h-3.5" />}>
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
        </ChartCard>
      </div>
    </div>
  )
}

// ── Small shared helpers ─────────────────────────────────────────────

function KVRow({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12.5px] py-1.5 border-t border-border/50 first:border-t-0 first:pt-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2 tabular-nums">
        <span className="text-foreground font-semibold">{value}</span>
        {sub && <span className="text-[10.5px] text-muted-foreground/75">{sub}</span>}
      </div>
    </div>
  )
}

function pct(num: number, den: number): number {
  if (!den) return 0
  return Math.round((num / den) * 100)
}

function RepeatBreakdown({
  repeat, total,
}: {
  repeat: { definitely: number; likely: number; maybe: number; no: number }
  total: number
}) {
  const segments = [
    { label: 'Definitely', value: repeat.definitely, color: 'bg-green-500' },
    { label: 'Likely',     value: repeat.likely,     color: 'bg-blue-500'  },
    { label: 'Maybe',      value: repeat.maybe,      color: 'bg-amber-500' },
    { label: 'No',         value: repeat.no,         color: 'bg-rose-500'  },
  ]
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
        {segments.map(s => s.value > 0 && (
          <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[11px]">
        {segments.map(s => (
          <span key={s.label} className="inline-flex items-center gap-1 tabular-nums">
            <span className={`w-2 h-2 rounded-sm ${s.color}`} aria-hidden />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="text-foreground font-medium">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
