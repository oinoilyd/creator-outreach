'use client'

import { motion } from 'motion/react'
import { ReactNode } from 'react'

export function BentoGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 ${className}`}>
      {children}
    </div>
  )
}

export function BentoCard({
  title,
  description,
  icon,
  className = '',
  visual,
  delay = 0,
}: {
  title: string
  description: string
  icon: ReactNode
  className?: string
  visual?: ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      whileHover={{ y: -3, boxShadow: '0 20px 40px -16px rgba(120, 80, 200, 0.18)' }}
      className={`group relative overflow-hidden rounded-2xl bg-white/95 dark:bg-gray-900/50 border border-gray-200 dark:border-white/5 hover:border-purple-300 dark:hover:border-white/10 transition-colors flex flex-col shadow-sm shadow-gray-900/5 ${className}`}
    >
      {/* Soft hover glow — gradient that shows up on light bg too */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />

      {visual && <div className="relative px-5 pt-5 pb-3">{visual}</div>}

      <div className="relative px-5 pb-5 pt-3 flex-1">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-7 h-7 rounded-md bg-purple-100 dark:bg-white/5 border border-purple-200 dark:border-white/10 flex items-center justify-center text-purple-700 dark:text-purple-300">
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">{title}</h3>
        </div>
        <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}

// ────────── mini-visualizations — match the actual app surfaces ──────────

// Search results preview — mini version of the real Results table
export function SearchVisual() {
  const rows = [
    { name: 'HomeGym Hub',     fit: 88, email: true,  color: 'from-purple-500 to-pink-500' },
    { name: 'StrengthLab',     fit: 82, email: true,  color: 'from-blue-500 to-cyan-500' },
    { name: 'MovementCo',      fit: 71, email: false, color: 'from-emerald-500 to-teal-500' },
  ]
  return (
    <div className="aspect-[5/3] rounded-xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-950/40 dark:via-gray-900 dark:to-blue-950/40 relative overflow-hidden p-3 flex flex-col gap-2">
      {/* Search bar mock with purple gradient like the real app */}
      <div className="rounded-md bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-500/10 dark:to-blue-500/10 border border-purple-200 dark:border-purple-500/30 px-2.5 py-1.5 flex items-center gap-2 shadow-sm">
        <span className="text-purple-700 dark:text-purple-300 text-[10px]">🔍</span>
        <span className="text-[10px] text-gray-700 dark:text-gray-300 font-medium">fitness coach</span>
        <span className="ml-auto text-[9px] text-gray-500">10K – 500K</span>
      </div>
      {/* Mini result rows */}
      <div className="flex-1 space-y-1.5">
        {rows.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 shadow-sm"
          >
            <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${r.color} text-[8px] text-white flex items-center justify-center font-semibold shrink-0`}>
              {r.name.split(' ').map(s => s[0]).slice(0, 2).join('')}
            </div>
            <span className="text-[10px] text-gray-900 dark:text-gray-200 font-medium truncate flex-1">{r.name}</span>
            <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-300 px-1.5 py-px rounded bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30">
              {r.fit}
            </span>
            {r.email
              ? <span className="text-[9px] text-emerald-600 dark:text-emerald-400">✉</span>
              : <span className="text-[9px] text-gray-400">—</span>}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// Score weight bars — matches the actual scoring UI vibe
export function ScoringVisual() {
  const weights = [
    { label: 'Recency',      val: 30, color: 'from-purple-400 to-purple-600' },
    { label: 'Reach',        val: 65, color: 'from-blue-400 to-blue-600' },
    { label: 'Reachability', val: 80, color: 'from-pink-400 to-pink-600' },
    { label: 'Fit',          val: 85, color: 'from-emerald-400 to-emerald-600' },
  ]
  return (
    <div className="aspect-[5/3] rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-gray-950/60 p-3 flex flex-col justify-center gap-2 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">✨ Your criteria</span>
        <span className="ml-auto text-[9px] font-mono text-gray-500">82 / 100</span>
      </div>
      {weights.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + i * 0.06 }}
        >
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-gray-700 dark:text-gray-400">{s.label}</span>
            <span className="font-mono text-gray-900 dark:text-gray-300">{s.val}</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${s.val}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.7 }}
              className={`h-full bg-gradient-to-r ${s.color} rounded-full`}
            />
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// Status pill grid — matches actual outreach status colors
export function CrmVisual() {
  return (
    <div className="aspect-[5/3] rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-gray-950/60 p-3 grid grid-cols-2 gap-2 shadow-sm">
      {[
        { label: 'Open',        n: 47, color: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30' },
        { label: 'Successful',  n: 12, color: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' },
        { label: 'No Response', n: 23, color: 'bg-gray-100 dark:bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-500/30' },
        { label: 'Rejected',    n:  8, color: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30' },
      ].map(s => (
        <div key={s.label} className={`rounded-lg border ${s.color} p-2 flex flex-col shadow-sm`}>
          <span className="text-[9px] uppercase tracking-wider opacity-90 font-medium">{s.label}</span>
          <span className="text-lg font-bold tabular-nums">{s.n}</span>
        </div>
      ))}
    </div>
  )
}

// Cadence timeline — exactly the actual 3 / 7 / 14 / 21 cadence
export function CadenceVisual() {
  const steps = [
    { label: 'First send',   day: 'D 0',  color: 'bg-purple-500' },
    { label: 'Follow-up 1',  day: 'D 3',  color: 'bg-blue-500' },
    { label: 'Follow-up 2',  day: 'D 10', color: 'bg-blue-500' },
    { label: 'Follow-up 3',  day: 'D 24', color: 'bg-amber-500' },
  ]
  return (
    <div className="aspect-[5/3] rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-gray-950/60 p-4 flex flex-col justify-center shadow-sm">
      <div className="relative pl-2">
        {/* vertical line */}
        <div className="absolute left-3.5 top-2 bottom-2 w-px bg-gray-200 dark:bg-white/10" />
        {steps.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="relative flex items-center gap-3 mb-2.5 last:mb-0"
          >
            <span className={`relative z-10 w-3 h-3 rounded-full ${s.color} ring-4 ring-white dark:ring-gray-950 shadow-sm`} />
            <span className="text-[10px] text-gray-700 dark:text-gray-300 font-medium">{s.label}</span>
            <span className="text-[9px] font-mono text-gray-500 ml-auto">{s.day}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// Analytics card — actual labels from OutreachAnalytics
export function AnalyticsVisual() {
  return (
    <div className="aspect-[5/3] rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-gray-950/60 p-3 flex flex-col gap-2 shadow-sm">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Win rate',  value: '60%', accent: 'text-emerald-700 dark:text-emerald-300' },
          { label: 'Resp rate', value: '59%', accent: 'text-blue-700 dark:text-blue-300' },
          { label: 'Pipeline', value: '$48k', accent: 'text-purple-700 dark:text-purple-300' },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-lg p-2">
            <div className="text-[8px] uppercase tracking-wider text-gray-500">{s.label}</div>
            <div className={`text-base font-bold tabular-nums ${s.accent}`}>{s.value}</div>
          </div>
        ))}
      </div>
      {/* Stacked status bar matching the real status breakdown */}
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5">
        <motion.div initial={{ width: 0 }} whileInView={{ width: '26%' }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.7 }} className="bg-emerald-500" />
        <motion.div initial={{ width: 0 }} whileInView={{ width: '30%' }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.7 }} className="bg-blue-500" />
        <motion.div initial={{ width: 0 }} whileInView={{ width: '21%' }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.7 }} className="bg-gray-400" />
        <motion.div initial={{ width: 0 }} whileInView={{ width: '12%' }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.7 }} className="bg-red-500" />
        <motion.div initial={{ width: 0 }} whileInView={{ width: '11%' }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.7 }} className="bg-gray-200 dark:bg-gray-600" />
      </div>
      {/* Velocity bars */}
      <div className="flex-1 flex items-end gap-1">
        {[40, 65, 50, 80, 70, 90, 75].map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
            className="flex-1 rounded-t bg-gradient-to-t from-purple-500/50 to-purple-500"
          />
        ))}
      </div>
    </div>
  )
}
