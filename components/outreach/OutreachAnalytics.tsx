'use client'

/**
 * OutreachAnalytics v5 — five layouts, click-into picker, cinematic
 * visuals.
 *
 * Layouts:
 *   • Overview        — everything visible in one scroll
 *   • Sales pipeline  — funnel-centric lens
 *   • Active clients  — engagement health
 *   • Cash flow       — money in flight and realised
 *   • Activity        — calendar heatmap focus
 *
 * Header controls:
 *   • "Change layout" button → opens AnalyticsLayoutPicker modal
 *   • Time range — 7d / 30d / 90d / YTD / All
 *   • Settings gear — customize metrics + export
 *
 * Visual upgrades vs v4:
 *   • HeroBanner — animated gradient backdrop, giant typography
 *   • StatCardWithSparkline — inline trend on every key metric
 *   • CalendarHeatmap — GitHub-style year-at-a-glance
 *   • Motion transitions between layouts (framer-motion)
 *   • Anti-template: cream/navy/purple/blue accents per layout, no
 *     "generic SaaS template" defaults
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { OutreachEntry } from '@/lib/types'
import { CustomMetricCard } from '@/components/outreach/CustomMetricCard'
import {
  computeMetrics, filterByTimeRange, resolveTimeRange, previousTimeRange,
  bucketedSeries, dailyActivity, sparklineSeries,
  type TimeRangeId, type ComputedMetrics,
} from '@/components/outreach/analyticsMetrics'
import {
  ChartCard, StatCard, StatCardWithSparkline, FunnelHero, HeroBanner,
  VelocityChart, CumulativeRevenueChart, MediumBarChart, LifecycleDonut,
  StatusStack, MediumConversionRow, CalendarHeatmap, Sparkline,
} from '@/components/outreach/analyticsWidgets'
import { AnalyticsInsightCard } from '@/components/outreach/AnalyticsInsightCard'
import {
  AnalyticsLayoutPicker, LAYOUT_OPTIONS, type LayoutId,
} from '@/components/outreach/AnalyticsLayoutPicker'
import {
  Briefcase, Activity as ActivityIcon, Star, TrendingUp, Calendar,
  LayoutGrid, ChevronDown, Award,
} from 'lucide-react'

const LS_LAYOUT = 'creator-outreach.analytics.layout'
const LS_RANGE  = 'creator-outreach.analytics.range'

const TIME_RANGE_OPTIONS: { id: TimeRangeId; label: string }[] = [
  { id: 'last7',  label: '7d'  },
  { id: 'last30', label: '30d' },
  { id: 'last90', label: '90d' },
  { id: 'ytd',   label: 'YTD' },
  { id: 'all',   label: 'All' },
]

function readLS<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const v = window.localStorage.getItem(key)
  return (v && (allowed as readonly string[]).includes(v)) ? (v as T) : fallback
}
function writeLS(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, value) } catch { /* ignore */ }
}

export function OutreachAnalytics({ entries, customMetrics, onOpenCustomize, onExportExcel, onExportCsv }: {
  entries: OutreachEntry[]
  customMetrics: import('@/lib/types').CustomMetric[]
  onOpenCustomize: () => void
  onExportExcel: () => void
  onExportCsv: () => void
}) {
  const [layout, setLayoutState] = useState<LayoutId>(() =>
    readLS<LayoutId>(LS_LAYOUT, ['overview', 'sales', 'active', 'cash', 'activity'], 'overview'),
  )
  const [rangeId, setRangeIdState] = useState<TimeRangeId>(() =>
    readLS<TimeRangeId>(LS_RANGE, ['last7', 'last30', 'last90', 'ytd', 'all', 'custom'], 'all'),
  )
  const [pickerOpen, setPickerOpen] = useState(false)

  function setLayout(v: LayoutId)    { setLayoutState(v); writeLS(LS_LAYOUT, v) }
  function setRangeId(v: TimeRangeId) { setRangeIdState(v); writeLS(LS_RANGE, v) }

  // Settings gear popover state.
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

  const range = useMemo(() => resolveTimeRange(rangeId), [rangeId])
  const prevRange = useMemo(() => previousTimeRange(range), [range])
  const filteredCurrent = useMemo(() => filterByTimeRange(entries, range), [entries, range])
  const filteredPrev    = useMemo(() => prevRange ? filterByTimeRange(entries, prevRange) : null, [entries, prevRange])
  const m  = useMemo(() => computeMetrics(filteredCurrent), [filteredCurrent])
  const pm = useMemo(() => filteredPrev ? computeMetrics(filteredPrev) : null, [filteredPrev])
  const series = useMemo(() => bucketedSeries(filteredCurrent, range), [filteredCurrent, range])
  // Calendar uses the full entries set (not time-filtered) so the
  // year-at-a-glance is always a year. Time range filter still drives
  // the metric cards on the layout.
  const calendar = useMemo(() => dailyActivity(entries, 365), [entries])

  // Sparkline data — precomputed once so individual stat cards can
  // pluck what they need without recomputing the bucketed series.
  const spark = useMemo(() => ({
    added:      sparklineSeries(series, 'added'),
    reachedOut: sparklineSeries(series, 'reachedOut'),
    responded:  sparklineSeries(series, 'responded'),
    won:        sparklineSeries(series, 'won'),
  }), [series])

  const currentLayout = LAYOUT_OPTIONS.find(o => o.id === layout)!

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
      {/* ── Header bar ─────────────────────────────────────────────
          On phones the row stacks: layout button takes full width
          (easier tap target), then the time-range + settings cluster
          gets its own row, justified-between so the gear stays
          right-aligned. At sm+ everything is one row, as before. */}
      <div className="flex max-sm:flex-col items-stretch sm:items-center sm:justify-between gap-3 sm:flex-wrap">
        {/* Layout switcher — prominent click-into button */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted/40 hover:border-border/80 transition-colors max-sm:w-full"
        >
          <span className="shrink-0 w-7 h-7 rounded-md bg-gradient-to-br from-purple-500/20 to-blue-500/15 text-purple-700 dark:text-purple-300 flex items-center justify-center">
            {currentLayout.icon}
          </span>
          <span className="flex flex-col items-start min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Layout</span>
            <span className="text-[13px] font-semibold text-foreground -mt-0.5">{currentLayout.title}</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors ml-1" />
        </button>

        {/* RIGHT — time range + settings. On phone, full-width row
            with justify-between so the gear hugs the right edge and
            the range pills span the available space. */}
        <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">
          <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 border border-border max-sm:flex-1">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground ml-1.5 mr-0.5 max-sm:hidden" aria-hidden />
            {TIME_RANGE_OPTIONS.map(opt => {
              const active = rangeId === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRangeId(opt.id)}
                  aria-pressed={active}
                  className={[
                    // Phone: stretch each pill to fill the row evenly
                    // (makes the cluster look intentional vs cramped)
                    // and bump padding for a friendlier tap target.
                    'max-sm:flex-1 rounded-md text-[11.5px] font-medium tabular-nums transition-colors max-sm:px-2 max-sm:py-1.5 sm:px-2.5 sm:py-1',
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

          <div ref={settingsRef} className="relative">
            <button
              type="button"
              onClick={() => setShowSettings(v => !v)}
              title="Analytics settings"
              aria-label="Analytics settings"
              aria-expanded={showSettings}
              className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
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

      {/* ── AI insight (always shown) ──────────────────────────── */}
      <AnalyticsInsightCard
        current={m}
        previous={pm ?? undefined}
        rangeLabel={range.label}
        cacheKey={`v2-${layout}-${rangeId}`}
        layout={layout}
        layoutLabel={currentLayout.title}
      />

      {/* ── Layout body with motion transition ────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={layout}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="space-y-5"
        >
          {layout === 'overview' && (
            <OverviewLayout m={m} pm={pm} series={series} spark={spark} calendar={calendar} />
          )}
          {layout === 'sales' && (
            <SalesPipelineLayout m={m} pm={pm} series={series} spark={spark} />
          )}
          {layout === 'active' && (
            <ActiveClientsLayout m={m} pm={pm} />
          )}
          {layout === 'cash' && (
            <CashFlowLayout m={m} pm={pm} series={series} spark={spark} />
          )}
          {layout === 'activity' && (
            <ActivityLayout m={m} calendar={calendar} series={series} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Custom metrics — always available regardless of layout */}
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

      {/* Layout picker modal */}
      {pickerOpen && (
        <AnalyticsLayoutPicker
          current={layout}
          onPick={setLayout}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

// ── Layouts ──────────────────────────────────────────────────────────

interface LayoutProps {
  m: ComputedMetrics
  pm: ComputedMetrics | null
}

interface LayoutWithSeriesProps extends LayoutProps {
  series: ReturnType<typeof bucketedSeries>
  spark: {
    added: number[]
    reachedOut: number[]
    responded: number[]
    won: number[]
  }
}

interface OverviewLayoutProps extends LayoutWithSeriesProps {
  calendar: ReturnType<typeof dailyActivity>
}

interface ActivityLayoutProps {
  /** Activity layout doesn't need previous-period comparison data,
   *  so we don't extend LayoutProps; the hero shows year-totals
   *  which aren't time-range-bound. */
  m: ComputedMetrics
  calendar: ReturnType<typeof dailyActivity>
  series: ReturnType<typeof bucketedSeries>
}

// Color tokens used across stat cards' sparklines.
const COLOR = {
  purple: 'rgb(168, 85, 247)',
  blue:   'rgb(59, 130, 246)',
  cyan:   'rgb(6, 182, 212)',
  green:  'rgb(34, 197, 94)',
  amber:  'rgb(245, 158, 11)',
}

/* ── Overview ── Everything on one page. Fixes the v4 "downgrade"
   feeling of having to flip between presets to see basic info. */
function OverviewLayout({ m, pm, series, spark, calendar }: OverviewLayoutProps) {
  return (
    <>
      <HeroBanner
        accent="purple"
        primaryLabel="Personal revenue"
        primaryValue={m.personalRevenue > 0 ? `$${m.personalRevenue.toLocaleString()}` : '—'}
        primarySub={
          m.totalCollaboratorShare > 0
            ? `$${m.totalCollaboratorShare.toLocaleString()} to team · $${m.totalBooked.toLocaleString()} total booked`
            : m.totalBooked > 0
              ? `$${m.totalBooked.toLocaleString()} total booked · no team splits`
              : 'no priced engagements yet'
        }
        primaryDelta={pm ? deltaSafe(m.personalRevenue, pm.personalRevenue) : undefined}
        chips={[
          { label: 'In pipeline',  value: String(m.total) },
          { label: 'Active now',   value: String(m.activeNow) },
          { label: 'Win rate',     value: `${m.winRate}%` },
          { label: 'Avg deal',     value: m.avgDeal > 0 ? `$${Math.round(m.avgDeal).toLocaleString()}` : '—' },
        ]}
      />

      <FunnelHero
        leads={m.total}
        reachedOut={m.reachedOut}
        responded={m.responseReceived}
        won={m.successful}
        activeNow={m.activeNow}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCardWithSparkline label="In pipeline"   value={m.total}            previous={pm?.total}            sparkData={spark.added}      color={COLOR.purple} />
        <StatCardWithSparkline label="Reached out"   value={m.reachedOut}       previous={pm?.reachedOut}       sparkData={spark.reachedOut} color={COLOR.blue}   />
        <StatCardWithSparkline label="Responded"     value={m.responseReceived} previous={pm?.responseReceived} sparkData={spark.responded}  color={COLOR.cyan}   sub="Successful + Rejected" />
        <StatCardWithSparkline label="Won"           value={m.successful}       previous={pm?.successful}       sparkData={spark.won}        color={COLOR.green}  />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title="Velocity" subtitle="Added / reached out / won over time" icon={<ActivityIcon className="w-3.5 h-3.5" />}>
            <VelocityChart data={series} />
          </ChartCard>
        </div>
        <ChartCard title="Lifecycle" subtitle={`${m.successful} engagement${m.successful === 1 ? '' : 's'}`} icon={<Briefcase className="w-3.5 h-3.5" />}>
          <LifecycleDonut
            active={m.lifecycle.active}
            paused={m.lifecycle.paused}
            completed={m.lifecycle.completed}
            churned={m.lifecycle.churned}
          />
        </ChartCard>
      </div>

      <ChartCard title="Activity" subtitle="The year at a glance — every event, every day" icon={<ActivityIcon className="w-3.5 h-3.5" />}>
        <CalendarHeatmap cells={calendar} accent="purple" />
      </ChartCard>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Status breakdown" icon={<TrendingUp className="w-3.5 h-3.5" />}>
          <StatusStack
            successful={m.successful}
            open={m.open}
            noResponse={m.noResponse}
            rejected={m.rejected}
            notOutreached={m.notOutreached}
            total={m.total}
          />
        </ChartCard>
        <ChartCard title="By medium" subtitle="Reached vs won by channel" icon={<ActivityIcon className="w-3.5 h-3.5" />}>
          <MediumBarChart
            data={[
              { medium: 'Email',    reached: m.byMedium.Email.reached,    won: m.byMedium.Email.won    },
              { medium: 'LinkedIn', reached: m.byMedium.LinkedIn.reached, won: m.byMedium.LinkedIn.won },
              { medium: 'Other',    reached: m.byMedium.Other.reached,    won: m.byMedium.Other.won    },
            ]}
          />
        </ChartCard>
      </div>

      {m.completedCount > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <ChartCard title="Client satisfaction" subtitle={`Across ${m.ratedCount} rated completion${m.ratedCount === 1 ? '' : 's'}`} icon={<Award className="w-3.5 h-3.5" />}>
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
          <ChartCard title="Conversion by medium" icon={<TrendingUp className="w-3.5 h-3.5" />}>
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
      )}
    </>
  )
}

/* ── Sales pipeline ── */
function SalesPipelineLayout({ m, pm, series, spark }: LayoutWithSeriesProps) {
  return (
    <>
      <FunnelHero
        leads={m.total}
        reachedOut={m.reachedOut}
        responded={m.responseReceived}
        won={m.successful}
        activeNow={m.activeNow}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCardWithSparkline label="In pipeline"   value={m.total}            previous={pm?.total}            sparkData={spark.added}      color={COLOR.purple} />
        <StatCardWithSparkline label="Reached out"   value={m.reachedOut}       previous={pm?.reachedOut}       sparkData={spark.reachedOut} color={COLOR.blue} />
        <StatCardWithSparkline label="Responded"     value={m.responseReceived} previous={pm?.responseReceived} sparkData={spark.responded}  color={COLOR.cyan}   sub="Successful + Rejected" />
        <StatCard label="Response rate"    value={`${m.responseRate}%`} sub={`${m.responseReceived} of ${m.reachedOut}`} />
        <StatCard label="Win rate"         value={`${m.winRate}%`}     sub={`${m.successful} of ${m.responseReceived}`} />
        <StatCard label="Pipeline $"       value={m.pipelineValue > 0 ? `$${m.pipelineValue.toLocaleString()}` : '—'} sub="non-rejected" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title="Velocity" subtitle="Added / reached out / won over time" icon={<ActivityIcon className="w-3.5 h-3.5" />}>
            <VelocityChart data={series} />
          </ChartCard>
        </div>
        <ChartCard title="Status breakdown" icon={<TrendingUp className="w-3.5 h-3.5" />}>
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
        <ChartCard title="By medium" subtitle="Reached vs won by channel" icon={<ActivityIcon className="w-3.5 h-3.5" />}>
          <MediumBarChart
            data={[
              { medium: 'Email',    reached: m.byMedium.Email.reached,    won: m.byMedium.Email.won    },
              { medium: 'LinkedIn', reached: m.byMedium.LinkedIn.reached, won: m.byMedium.LinkedIn.won },
              { medium: 'Other',    reached: m.byMedium.Other.reached,    won: m.byMedium.Other.won    },
            ]}
          />
        </ChartCard>
        <ChartCard title="Conversion by medium" subtitle="Outreach → active client rate" icon={<TrendingUp className="w-3.5 h-3.5" />}>
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
    </>
  )
}

/* ── Active clients ── */
function ActiveClientsLayout({ m, pm }: LayoutProps) {
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
    <>
      <HeroBanner
        accent="green"
        primaryLabel="Active engagements"
        primaryValue={String(m.activeNow)}
        primarySub={`${m.lifecycle.paused} paused · ${m.lifecycle.completed} completed · ${m.lifecycle.churned} churned`}
        primaryDelta={pm ? deltaSafe(m.activeNow, pm.activeNow) : undefined}
        chips={[
          { label: 'Total clients',     value: String(m.successful) },
          { label: 'Total booked',      value: m.totalBooked > 0 ? `$${m.totalBooked.toLocaleString()}` : '—' },
          { label: 'Personal revenue',  value: m.personalRevenue > 0 ? `$${m.personalRevenue.toLocaleString()}` : '—' },
          { label: 'Avg deal',          value: m.avgDeal > 0 ? `$${Math.round(m.avgDeal).toLocaleString()}` : '—' },
        ]}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title="Lifecycle" subtitle="Distribution across engagement states" icon={<Briefcase className="w-3.5 h-3.5" />}>
          <LifecycleDonut
            active={m.lifecycle.active}
            paused={m.lifecycle.paused}
            completed={m.lifecycle.completed}
            churned={m.lifecycle.churned}
          />
        </ChartCard>

        {m.completedCount > 0 ? (
          <>
            <ChartCard title="Client satisfaction" subtitle={`Across ${m.ratedCount} rated completion${m.ratedCount === 1 ? '' : 's'}`} icon={<Award className="w-3.5 h-3.5" />}>
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
            <ChartCard title="Repeat likelihood" subtitle="From wrap-up data" icon={<ActivityIcon className="w-3.5 h-3.5" />}>
              {m.repeatCount > 0 ? <RepeatBreakdown repeat={m.repeat} total={m.repeatCount} /> : (
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

      <ChartCard title="Where wins came from" subtitle="What predicts a Successful outcome" icon={<TrendingUp className="w-3.5 h-3.5" />}>
        <div className="space-y-2">
          <KVRow label="With contract sent"      value={m.winsWithContract}  sub={`${pct(m.winsWithContract, m.successful)}% of wins`} />
          <KVRow label="With meeting scheduled"  value={m.winsWithMeeting}   sub={`${pct(m.winsWithMeeting, m.successful)}% of wins`} />
          <KVRow label="Favorited at some point" value={m.winsFavorited}     sub={`${pct(m.winsFavorited, m.successful)}% of wins`} />
          <KVRow label="Avg touchpoints"         value={m.avgTouchpointsToWin ?? '—'} />
        </div>
      </ChartCard>
    </>
  )
}

/* ── Cash flow ── */
function CashFlowLayout({ m, pm, series, spark }: LayoutWithSeriesProps) {
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
    <>
      <HeroBanner
        accent="amber"
        primaryLabel="Total booked"
        primaryValue={m.totalBooked > 0 ? `$${m.totalBooked.toLocaleString()}` : '—'}
        primarySub={
          m.totalCollaboratorShare > 0
            ? `$${m.personalRevenue.toLocaleString()} personal · $${m.totalCollaboratorShare.toLocaleString()} to team`
            : `${m.withBudgetCount} priced engagement${m.withBudgetCount === 1 ? '' : 's'}`
        }
        primaryDelta={pm ? deltaSafe(m.totalBooked, pm.totalBooked) : undefined}
        chips={[
          { label: 'Personal revenue', value: m.personalRevenue > 0 ? `$${m.personalRevenue.toLocaleString()}` : '—' },
          { label: 'Avg deal',         value: m.avgDeal > 0 ? `$${Math.round(m.avgDeal).toLocaleString()}` : '—' },
          { label: 'Realised',         value: m.totalCompletedValue > 0 ? `$${m.totalCompletedValue.toLocaleString()}` : '—' },
          { label: 'Outstanding',      value: outstanding > 0 ? `$${outstanding.toLocaleString()}` : '—' },
        ]}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCardWithSparkline label="Pipeline $"       value={m.pipelineValue > 0 ? `$${m.pipelineValue.toLocaleString()}` : '—'} sub="non-rejected"             sparkData={spark.added}  color={COLOR.purple} />
        <StatCardWithSparkline label="Won (volume)"    value={m.successful}        previous={pm?.successful}                       sparkData={spark.won}    color={COLOR.green} />
        <StatCard label="Completed"   value={m.completedCount}                                                              sub={`${m.totalCompletedValue > 0 ? `$${m.totalCompletedValue.toLocaleString()} realised` : 'none yet'}`} />
        <StatCard label="Outstanding" value={outstanding > 0 ? `$${outstanding.toLocaleString()}` : '—'}                     sub="booked − realised" />
      </div>

      <ChartCard title="Cumulative revenue" subtitle="Won deals × avg deal value, accumulated over time" icon={<ActivityIcon className="w-3.5 h-3.5" />}>
        {cumulative.length > 0 && cumulative.some(c => c.cumulative > 0) ? (
          <CumulativeRevenueChart data={cumulative} />
        ) : (
          <div className="py-6 text-center text-[12.5px] text-muted-foreground/85 italic">
            No won deals in this range yet.
          </div>
        )}
      </ChartCard>

      <ChartCard title="Where the $ came from" subtitle="Wins by medium" icon={<TrendingUp className="w-3.5 h-3.5" />}>
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
    </>
  )
}

/* ── Activity ── Calendar heatmap focused. */
function ActivityLayout({ m, calendar, series }: ActivityLayoutProps) {
  const totalCells = calendar.reduce((s, c) => s + c.count, 0)
  const peakDay = calendar.reduce((best, c) => c.count > (best?.count ?? 0) ? c : best, calendar[0])

  return (
    <>
      <HeroBanner
        accent="blue"
        primaryLabel="Total events (year)"
        primaryValue={totalCells.toString()}
        primarySub={
          peakDay && peakDay.count > 0
            ? `Peak day: ${peakDay.date} with ${peakDay.count} events`
            : 'No activity tracked yet for the past year'
        }
        chips={[
          { label: 'Added (7d)',      value: String(m.addedLast7) },
          { label: 'Reached (7d)',    value: String(m.reachedLast7) },
          { label: 'Won (30d)',       value: String(m.wonLast30) },
          { label: 'Total pipeline',  value: String(m.total) },
        ]}
      />

      <ChartCard
        title="Year in review"
        subtitle="Every event over the last 365 days — added, reached out, responded, won"
        icon={<ActivityIcon className="w-3.5 h-3.5" />}
      >
        <CalendarHeatmap cells={calendar} accent="green" />
      </ChartCard>

      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title="Velocity" subtitle="Selected range, bucketed" icon={<ActivityIcon className="w-3.5 h-3.5" />}>
          <VelocityChart data={series} height={180} />
        </ChartCard>
        <ChartCard title="Trend snapshot" subtitle="Last 24 buckets" icon={<TrendingUp className="w-3.5 h-3.5" />}>
          <SparkRow label="Added"      values={sliceN(series.map(s => s.added))}      color={COLOR.purple} />
          <SparkRow label="Reached"    values={sliceN(series.map(s => s.reachedOut))} color={COLOR.blue}   />
          <SparkRow label="Responded"  values={sliceN(series.map(s => s.responded))}  color={COLOR.cyan}   />
          <SparkRow label="Won"        values={sliceN(series.map(s => s.won))}        color={COLOR.green}  />
        </ChartCard>
        <ChartCard title="Status mix" icon={<TrendingUp className="w-3.5 h-3.5" />}>
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
    </>
  )
}

// ── Small helpers ────────────────────────────────────────────────────

function sliceN<T>(arr: T[], n = 24): T[] {
  return arr.slice(-n)
}

function SparkRow({ label, values, color }: { label: string; values: number[]; color: string }) {
  const total = values.reduce((s, v) => s + v, 0)
  return (
    <div className="flex items-center gap-3 py-1.5 border-t border-border/50 first:border-t-0 first:pt-0">
      <div className="text-[12px] font-medium text-foreground w-20 shrink-0">{label}</div>
      <div className="flex-1 min-w-0">
        <Sparkline values={values} color={color} height={20} />
      </div>
      <div className="shrink-0 text-[12px] tabular-nums text-muted-foreground w-10 text-right">{total}</div>
    </div>
  )
}

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

function pct(num: number, den: number): number {
  if (!den) return 0
  return Math.round((num / den) * 100)
}

function deltaSafe(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null
  if (prev === 0) return curr === 0 ? 0 : null
  return Math.round(((curr - prev) / prev) * 100)
}
