'use client'

/**
 * analyticsWidgets — visual widgets for the Analytics tab. Recharts-
 * backed where it makes sense; hand-crafted SVG/CSS where Recharts
 * would be overkill (e.g. the pipeline funnel).
 *
 * Why this file exists:
 *   OutreachAnalytics was on track to blow past 800 lines once we
 *   added charts. Widget primitives live here so the main component
 *   stays focused on layout + preset switching + state.
 *
 * Conventions:
 *   • Each widget is a pure component — props in, JSX out. Parent
 *     does all the computation and passes shaped data.
 *   • Cards use a consistent ChartCard / StatCard skeleton so the
 *     dashboard feels cohesive across presets.
 *   • Tailwind classes only. No inline color literals — every color
 *     is either a theme token or a brand accent (purple/blue/green/
 *     amber/rose).
 */

import React from 'react'
import { motion } from 'motion/react'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import { NumberTicker } from '@/components/NumberTicker'
import type { BucketPoint, DayActivity } from './analyticsMetrics'
import { deltaPct } from './analyticsMetrics'

// ── Card skeletons ───────────────────────────────────────────────────

/** Shared card chrome for chart widgets. */
export function ChartCard({
  title, subtitle, icon, action, children, density = 'comfortable',
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  density?: 'comfortable' | 'compact'
}) {
  const pad = density === 'compact' ? 'p-3.5' : 'p-5'
  return (
    <div className={`bg-card/40 border border-border rounded-xl ${pad}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon && <div className="shrink-0 text-muted-foreground/80">{icon}</div>}
            <h3 className="text-[13px] font-semibold text-foreground tracking-tight">
              {title}
            </h3>
          </div>
          {subtitle && (
            <p className="text-[11.5px] text-muted-foreground/75 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Stat with optional period delta ──────────────────────────────────

/**
 * StatCard — single big number with label, optional sub line, and
 * optional period-over-period delta badge. Replaces the old AStat
 * for v4 — same vibe but with comparison built in.
 */
export function StatCard({
  label, value, sub, previous, format, highlight, density = 'comfortable',
}: {
  label: string
  value: number | string
  sub?: string
  /** Same metric in the previous period — drives the delta badge. */
  previous?: number
  format?: 'number' | 'currency' | 'percent'
  highlight?: boolean
  density?: 'comfortable' | 'compact'
}) {
  const numeric = typeof value === 'number'
  const dpct = numeric && previous != null ? deltaPct(value as number, previous) : null
  const pad = density === 'compact' ? 'p-3' : 'p-4'
  const labelSize = density === 'compact' ? 'text-[10px]' : 'text-[11px]'
  const valueSize = density === 'compact' ? 'text-xl' : 'text-2xl'

  return (
    <div
      className={[
        'bg-card/60 border rounded-xl shadow-sm shadow-black/5 transition-colors',
        pad,
        highlight ? 'border-red-500/40' : 'border-border hover:border-border/80',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className={`${labelSize} uppercase tracking-wider text-muted-foreground`}>
          {label}
        </div>
        {dpct != null && <DeltaBadge pct={dpct} />}
      </div>
      <div className={`${valueSize} font-bold tabular-nums ${highlight ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
        {numeric ? <NumberTicker value={value as number} /> : value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  )
}

/** Small pill showing % change vs the previous period. */
export function DeltaBadge({ pct }: { pct: number }) {
  const up = pct > 0
  const flat = pct === 0
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
  const cls = flat
    ? 'text-muted-foreground bg-muted/60'
    : up
      ? 'text-green-700 dark:text-green-300 bg-green-500/15'
      : 'text-red-700 dark:text-red-400 bg-red-500/15'
  const sign = up ? '+' : ''
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded ${cls}`}>
      <Icon className="w-2.5 h-2.5" aria-hidden />
      {sign}{pct}%
    </span>
  )
}

// ── Pipeline funnel hero ─────────────────────────────────────────────

/** Hand-crafted funnel — Recharts doesn't have a built-in. Bars are
 *  width-proportional to the leads baseline; conversion % chips sit
 *  between each step. */
export function FunnelHero({
  leads, reachedOut, responded, won, activeNow,
  density = 'comfortable',
}: {
  leads: number
  reachedOut: number
  responded: number
  won: number
  activeNow: number
  density?: 'comfortable' | 'compact'
}) {
  const max = Math.max(1, leads)
  const steps = [
    { id: 'leads',    label: 'Leads',         value: leads,      color: 'bg-purple-500/80' },
    { id: 'reached',  label: 'Reached out',   value: reachedOut, color: 'bg-blue-500/80' },
    { id: 'response', label: 'Responded',     value: responded,  color: 'bg-cyan-500/80' },
    { id: 'won',      label: 'Won',           value: won,        color: 'bg-green-500/80' },
    { id: 'active',   label: 'Active now',    value: activeNow,  color: 'bg-emerald-500/80' },
  ]
  const pad = density === 'compact' ? 'p-4' : 'p-6'
  return (
    <div className={`bg-gradient-to-br from-purple-500/[0.06] via-card/40 to-blue-500/[0.06] border border-border rounded-2xl ${pad}`}>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">Pipeline funnel</h2>
        <span className="text-[11.5px] text-muted-foreground/80">— lead to active client</span>
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

// ── Recharts wrappers — small shared config ──────────────────────────

/**
 * Tooltip skin that matches the rest of the UI. Recharts' default
 * looks plasticky; this one inherits theme colors.
 */
function TipBox({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-md border border-border bg-card/95 backdrop-blur-md px-2.5 py-1.5 shadow-lg text-[11.5px]">
      {label && <div className="font-semibold text-foreground mb-0.5">{label}</div>}
      <ul className="space-y-0.5">
        {payload.map((p: any) => (
          <li key={p.dataKey} className="flex items-center gap-1.5 tabular-nums">
            <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} aria-hidden />
            <span className="text-muted-foreground capitalize">{String(p.dataKey).replace(/([A-Z])/g, ' $1').trim()}:</span>
            <span className="text-foreground font-medium">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Recharts CSS variable-driven palette so themes work.
const CHART_COLORS = {
  added:      'rgb(168, 85, 247)',   // purple-500
  reachedOut: 'rgb(59, 130, 246)',   // blue-500
  responded:  'rgb(6, 182, 212)',    // cyan-500
  won:        'rgb(34, 197, 94)',    // green-500
  email:      'rgb(168, 85, 247)',
  linkedin:   'rgb(59, 130, 246)',
  other:      'rgb(107, 114, 128)',  // gray-500
  active:     'rgb(34, 197, 94)',
  paused:     'rgb(245, 158, 11)',
  completed:  'rgb(59, 130, 246)',
  churned:    'rgb(244, 63, 94)',    // rose-500
  axis:       'rgba(156, 163, 175, 0.5)',
  grid:       'rgba(156, 163, 175, 0.18)',
}

// ── Velocity / time-series ───────────────────────────────────────────

/** Multi-line/area chart of added / reached / won over time. */
export function VelocityChart({ data, height = 220 }: { data: BucketPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="addedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_COLORS.added} stopOpacity={0.5} />
            <stop offset="95%" stopColor={CHART_COLORS.added} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="reachedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_COLORS.reachedOut} stopOpacity={0.4} />
            <stop offset="95%" stopColor={CHART_COLORS.reachedOut} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_COLORS.won} stopOpacity={0.45} />
            <stop offset="95%" stopColor={CHART_COLORS.won} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.65 }}
          stroke={CHART_COLORS.axis}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.65 }}
          stroke={CHART_COLORS.axis}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={32}
        />
        <Tooltip content={<TipBox />} />
        <Area type="monotone" dataKey="added"      stroke={CHART_COLORS.added}      strokeWidth={2} fill="url(#addedGrad)"   />
        <Area type="monotone" dataKey="reachedOut" stroke={CHART_COLORS.reachedOut} strokeWidth={2} fill="url(#reachedGrad)" />
        <Area type="monotone" dataKey="won"        stroke={CHART_COLORS.won}        strokeWidth={2} fill="url(#wonGrad)"     />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Single-series line of cumulative won-$ over time. */
export function CumulativeRevenueChart({ data, height = 200 }: { data: { label: string; cumulative: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.65 }} stroke={CHART_COLORS.axis} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.65 }} stroke={CHART_COLORS.axis} axisLine={false} tickLine={false} width={48} tickFormatter={n => formatMoneyTick(n)} />
        <Tooltip content={<TipBox />} />
        <Line type="monotone" dataKey="cumulative" stroke={CHART_COLORS.won} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function formatMoneyTick(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `$${Math.round(n / 1_000)}k`
  return `$${n}`
}

// ── By-medium chart ──────────────────────────────────────────────────

export function MediumBarChart({
  data, height = 200,
}: {
  data: { medium: string; reached: number; won: number }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="medium" tick={{ fill: 'currentColor', fontSize: 11, opacity: 0.75 }} stroke={CHART_COLORS.axis} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.65 }} stroke={CHART_COLORS.axis} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip content={<TipBox />} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 11, color: 'currentColor', opacity: 0.85 }}
        />
        <Bar dataKey="reached" name="Reached" fill={CHART_COLORS.reachedOut} radius={[4, 4, 0, 0]} />
        <Bar dataKey="won"     name="Won"     fill={CHART_COLORS.won}        radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Lifecycle donut ──────────────────────────────────────────────────

export function LifecycleDonut({
  active, paused, completed, churned, height = 220,
}: {
  active: number
  paused: number
  completed: number
  churned: number
  height?: number
}) {
  const data = [
    { name: 'Active',    value: active,    color: CHART_COLORS.active },
    { name: 'Paused',    value: paused,    color: CHART_COLORS.paused },
    { name: 'Completed', value: completed, color: CHART_COLORS.completed },
    { name: 'Churned',   value: churned,   color: CHART_COLORS.churned },
  ].filter(d => d.value > 0)
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-[12.5px] text-muted-foreground/75 italic">
        No engagements yet.
      </div>
    )
  }
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={86}
            paddingAngle={2}
            stroke="none"
          >
            {data.map(d => (<Cell key={d.name} fill={d.color} />))}
          </Pie>
          <Tooltip content={<TipBox />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-foreground tabular-nums">{total}</div>
        <div className="text-[10.5px] text-muted-foreground uppercase tracking-wider">total</div>
      </div>
      {/* Inline legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-1 text-[11px]">
        {data.map(d => (
          <span key={d.name} className="inline-flex items-center gap-1 tabular-nums">
            <span className="w-2 h-2 rounded-sm" style={{ background: d.color }} aria-hidden />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="text-foreground font-medium">{d.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Status breakdown stacked bar (handcrafted for compactness) ───────

export function StatusStack({
  successful, open, noResponse, rejected, notOutreached, total,
}: {
  successful: number
  open: number
  noResponse: number
  rejected: number
  notOutreached: number
  total: number
}) {
  if (total === 0) {
    return <div className="text-[12px] text-muted-foreground italic">No outreach in range.</div>
  }
  const segments = [
    { label: 'Successful',    value: successful,    color: 'bg-green-500' },
    { label: 'Open',          value: open,          color: 'bg-blue-500'  },
    { label: 'No Response',   value: noResponse,    color: 'bg-gray-500'  },
    { label: 'Rejected',      value: rejected,      color: 'bg-red-500'   },
    { label: 'Not Outreached',value: notOutreached, color: 'bg-muted'     },
  ]
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

// ── Medium conversion rows (re-used across presets) ──────────────────

export function MediumConversionRow({
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

// ── Sparkline (small inline area chart) ──────────────────────────────

/**
 * Sparkline — tiny inline area chart sized for embedding in a stat
 * card. No axes, no labels — just shape. Recharts under the hood
 * because it's already in the bundle.
 */
export function Sparkline({
  values, color = 'rgb(168, 85, 247)', height = 28,
}: {
  values: number[]
  color?: string
  height?: number
}) {
  if (values.length === 0) return null
  const data = values.map((v, i) => ({ i, v }))
  const id = `sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/**
 * StatCardWithSparkline — beefier version of StatCard that includes
 * an inline trend sparkline. Use for the Overview layout where space
 * is plentiful and visual richness matters. Hero-tier visual.
 */
export function StatCardWithSparkline({
  label, value, sub, previous, sparkData, color = 'rgb(168, 85, 247)', highlight,
  density = 'comfortable',
}: {
  label: string
  value: number | string
  sub?: string
  previous?: number
  sparkData?: number[]
  color?: string
  highlight?: boolean
  density?: 'comfortable' | 'compact'
}) {
  const numeric = typeof value === 'number'
  const dpct = numeric && previous != null ? deltaPct(value as number, previous) : null
  const pad = density === 'compact' ? 'p-3.5' : 'p-5'
  const labelSize = density === 'compact' ? 'text-[10px]' : 'text-[11px]'
  const valueSize = density === 'compact' ? 'text-2xl' : 'text-3xl'

  return (
    <div
      className={[
        'group relative bg-card/60 border rounded-xl shadow-sm shadow-black/5 transition-all overflow-hidden',
        pad,
        highlight ? 'border-red-500/40' : 'border-border hover:border-border/80 hover:shadow-md',
      ].join(' ')}
    >
      {/* Top row: label + delta */}
      <div className="flex items-center justify-between gap-2 mb-1.5 relative z-10">
        <div className={`${labelSize} uppercase tracking-wider text-muted-foreground`}>
          {label}
        </div>
        {dpct != null && <DeltaBadge pct={dpct} />}
      </div>
      {/* Big value */}
      <div className={`${valueSize} font-bold tabular-nums tracking-tight relative z-10 ${highlight ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
        {numeric ? <NumberTicker value={value as number} /> : value}
      </div>
      {sub && (
        <div className="text-[11px] text-muted-foreground mt-1 relative z-10">{sub}</div>
      )}
      {/* Sparkline pinned to bottom — full-bleed for impact */}
      {sparkData && sparkData.length > 1 && (
        <div className="-mx-1 -mb-1 mt-2 opacity-80 group-hover:opacity-100 transition-opacity">
          <Sparkline values={sparkData} color={color} height={32} />
        </div>
      )}
    </div>
  )
}

// ── Animated hero banner ────────────────────────────────────────────

/**
 * HeroBanner — large cinematic banner with animated gradient backdrop,
 * giant primary number, supporting metric chips, and optional delta.
 * Used at the top of the Overview / Cash flow layouts for "wow."
 *
 * The gradient is animated (slow shift) via a CSS-driven keyframe
 * embedded inline — no extra stylesheet needed.
 */
export function HeroBanner({
  primaryLabel, primaryValue, primarySub, primaryDelta, chips, accent = 'purple',
}: {
  primaryLabel: string
  primaryValue: string
  primarySub?: string
  primaryDelta?: number | null
  chips?: { label: string; value: string; sub?: string }[]
  accent?: 'purple' | 'green' | 'blue' | 'amber'
}) {
  const accents = {
    purple: { from: 'from-purple-500/15', via: 'via-blue-500/8', glow: 'shadow-purple-500/20', dot: 'bg-purple-500' },
    green:  { from: 'from-green-500/15',  via: 'via-emerald-500/8', glow: 'shadow-green-500/20',  dot: 'bg-green-500' },
    blue:   { from: 'from-blue-500/15',   via: 'via-cyan-500/8',    glow: 'shadow-blue-500/20',   dot: 'bg-blue-500' },
    amber:  { from: 'from-amber-500/15',  via: 'via-orange-500/8',  glow: 'shadow-amber-500/20',  dot: 'bg-amber-500' },
  }[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`relative overflow-hidden bg-gradient-to-br ${accents.from} ${accents.via} to-card/40 border border-border rounded-2xl px-6 py-7 shadow-lg ${accents.glow}`}
    >
      {/* Animated decorative blur — slow shift adds life without
          drawing attention */}
      <motion.div
        className={`pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-40 ${accents.dot}`}
        aria-hidden
        animate={{ x: [0, 24, 0], y: [0, -16, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className={`pointer-events-none absolute -bottom-16 -left-16 w-56 h-56 rounded-full blur-3xl opacity-25 ${accents.dot}`}
        aria-hidden
        animate={{ x: [0, -20, 0], y: [0, 14, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
          {primaryLabel}
        </div>
        <div className="flex items-baseline gap-3 flex-wrap mb-2">
          <div className="text-5xl md:text-6xl font-bold text-foreground tracking-tight tabular-nums leading-none">
            {primaryValue}
          </div>
          {primaryDelta != null && <DeltaBadge pct={primaryDelta} />}
        </div>
        {primarySub && (
          <div className="text-[13px] text-muted-foreground">{primarySub}</div>
        )}
        {chips && chips.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
            {chips.map(c => (
              <div key={c.label} className="flex flex-col">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground/85">
                  {c.label}
                </div>
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-lg font-semibold text-foreground">{c.value}</span>
                  {c.sub && <span className="text-[11px] text-muted-foreground/80">{c.sub}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Calendar heatmap (GitHub-style activity grid) ───────────────────

/**
 * CalendarHeatmap — GitHub-style contribution grid, 53 columns × 7
 * rows (1 column = 1 week). Each cell's color intensity reflects
 * its activity count, bucketed into 5 tiers.
 *
 * The data is expected to be exactly `days` cells in chronological
 * order; we pad the leading edge with empty cells so the grid
 * starts on a Sunday column. Lightweight hand-built SVG — no charting
 * library overhead.
 */
export function CalendarHeatmap({
  cells, accent = 'green', height = 132,
}: {
  cells: DayActivity[]
  accent?: 'green' | 'purple' | 'blue'
  height?: number
}) {
  if (cells.length === 0) return null

  // Tier colors — semantic ramp from "no activity" to "very high."
  // Tier 0 uses a neutral translucent grey so it reads as "empty" in
  // both light and dark themes without depending on a theme variable.
  const EMPTY = 'rgba(156, 163, 175, 0.15)'
  const palette = {
    green:  [EMPTY, 'rgb(187, 247, 208)', 'rgb(74, 222, 128)', 'rgb(34, 197, 94)',  'rgb(21, 128, 61)'],
    purple: [EMPTY, 'rgb(216, 180, 254)', 'rgb(168, 85, 247)', 'rgb(126, 34, 206)', 'rgb(88, 28, 135)'],
    blue:   [EMPTY, 'rgb(191, 219, 254)', 'rgb(59, 130, 246)', 'rgb(29, 78, 216)',  'rgb(30, 58, 138)'],
  }[accent]

  // Calculate the max count so we can bucket relatively.
  const maxCount = Math.max(1, ...cells.map(c => c.count))
  function tier(count: number): number {
    if (count <= 0) return 0
    const ratio = count / maxCount
    if (ratio < 0.25) return 1
    if (ratio < 0.5)  return 2
    if (ratio < 0.75) return 3
    return 4
  }

  // Build week columns. The first column starts at the first Sunday
  // ≤ cells[0].date; pad with blanks for any leading non-Sunday days.
  const leading = cells[0].dayOfWeek  // 0 = Sunday
  const totalCells = leading + cells.length
  const weeks = Math.ceil(totalCells / 7)
  const cellSize = 11
  const gap = 2
  const totalWidth = weeks * (cellSize + gap)
  const totalHeight = 7 * (cellSize + gap)

  // Month labels (each first-of-month gets a label above its column).
  const monthLabels: { x: number; label: string }[] = []
  let lastMonth = -1
  cells.forEach((c, i) => {
    const d = new Date(c.date)
    if (d.getMonth() !== lastMonth) {
      const col = Math.floor((leading + i) / 7)
      monthLabels.push({ x: col * (cellSize + gap), label: d.toLocaleString('en-US', { month: 'short' }) })
      lastMonth = d.getMonth()
    }
  })

  // Aggregate totals for the badge in the corner.
  const total = cells.reduce((s, c) => s + c.count, 0)
  const activeDays = cells.filter(c => c.count > 0).length

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-muted-foreground tabular-nums">
          <span className="text-foreground font-semibold">{total}</span> events ·{' '}
          <span className="text-foreground font-semibold">{activeDays}</span> active days
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map(t => (
            <span key={t} className="inline-block w-2.5 h-2.5 rounded-sm border border-border" style={{ background: palette[t] }} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="overflow-x-auto" style={{ height }}>
        <svg
          width={totalWidth}
          height={totalHeight + 16}
          viewBox={`0 0 ${totalWidth} ${totalHeight + 16}`}
          className="block"
        >
          {/* Month labels */}
          {monthLabels.map(({ x, label }) => (
            <text
              key={`${x}-${label}`}
              x={x}
              y={10}
              fontSize={9}
              fill="currentColor"
              opacity={0.55}
            >
              {label}
            </text>
          ))}
          {/* Cells */}
          <g transform="translate(0, 14)">
            {cells.map((c, i) => {
              const idx = leading + i
              const col = Math.floor(idx / 7)
              const row = idx % 7
              const x = col * (cellSize + gap)
              const y = row * (cellSize + gap)
              const t = tier(c.count)
              return (
                <rect
                  key={c.date}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={2}
                  fill={palette[t]}
                  className="hover:stroke-foreground/40 transition-[stroke]"
                  strokeWidth={1}
                >
                  <title>{`${c.date}: ${c.count} event${c.count === 1 ? '' : 's'}${
                    c.count > 0 ? `\n• ${c.added} added\n• ${c.reachedOut} reached out\n• ${c.responded} responded\n• ${c.won} won` : ''
                  }`}</title>
                </rect>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
