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
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import { NumberTicker } from '@/components/NumberTicker'
import type { BucketPoint } from './analyticsMetrics'
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
