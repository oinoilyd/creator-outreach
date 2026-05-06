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
      whileHover={{ y: -3 }}
      className={`group relative overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-colors flex flex-col ${className}`}
    >
      {/* Soft hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />

      {visual && <div className="relative px-5 pt-5 pb-3">{visual}</div>}

      <div className="relative px-5 pb-5 pt-3 flex-1">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-7 h-7 rounded-md bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-purple-600 dark:text-purple-300">
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">{title}</h3>
        </div>
        <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}

// ────────── mini-visualizations used inside bento cards ──────────

// Search bar mock — for the big "Smart search" card
export function SearchVisual() {
  return (
    <div className="aspect-[5/3] bg-gradient-to-br from-purple-950/40 via-gray-900 to-blue-950/40 rounded-xl border border-white/5 relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(168,85,247,0.4) 0%, transparent 45%), radial-gradient(circle at 75% 75%, rgba(59,130,246,0.4) 0%, transparent 45%)',
      }} />
      <div className="relative w-[78%] rounded-lg bg-gray-900/80 border border-white/10 backdrop-blur-sm shadow-xl p-3">
        <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-1">
          <span className="text-purple-300">🔍</span>
          <span className="text-gray-300 font-mono">fitness creators</span>
          <span>·</span>
          <span className="font-mono">10k–100k</span>
          <span>·</span>
          <span className="font-mono">last 30d</span>
        </div>
        <div className="space-y-1.5">
          {['HomeGym Hub', 'CalisthenicsClub', 'StrengthLab Pro'].map((n, i) => (
            <div key={n} className="flex items-center gap-2 px-2 py-1 rounded bg-white/5 border border-white/5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-[8px] text-white flex items-center justify-center font-semibold">
                {n.split(' ').map(s => s[0]).slice(0,2).join('')}
              </div>
              <span className="text-[10px] text-gray-300 flex-1 truncate">{n}</span>
              <span className="text-[9px] font-mono text-emerald-300 px-1.5 py-px rounded bg-emerald-500/15 border border-emerald-500/30">
                {[88, 82, 79][i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Score weight sliders — for the "AI fit scoring" card
export function ScoringVisual() {
  return (
    <div className="aspect-[5/3] bg-gray-950/60 rounded-xl border border-white/5 p-4 flex flex-col justify-center gap-2.5">
      {[
        { label: 'Recency', val: 30, color: 'from-purple-400 to-purple-500' },
        { label: 'Reach', val: 65, color: 'from-blue-400 to-blue-500' },
        { label: 'Fit', val: 85, color: 'from-emerald-400 to-emerald-500' },
      ].map(s => (
        <div key={s.label}>
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
            <span>{s.label}</span>
            <span className="font-mono">{s.val}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r ${s.color} rounded-full`} style={{ width: `${s.val}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Status pill grid — for the "Built-in CRM" card
export function CrmVisual() {
  return (
    <div className="aspect-[5/3] bg-gray-950/60 rounded-xl border border-white/5 p-3 grid grid-cols-2 gap-2">
      {[
        { label: 'Open', n: 47, color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
        { label: 'Successful', n: 12, color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
        { label: 'No Response', n: 23, color: 'bg-gray-500/15 text-gray-300 border-gray-500/30' },
        { label: 'Rejected', n: 8, color: 'bg-red-500/15 text-red-300 border-red-500/30' },
      ].map(s => (
        <div key={s.label} className={`rounded-lg border ${s.color} p-2 flex flex-col`}>
          <span className="text-[9px] uppercase tracking-wider opacity-80">{s.label}</span>
          <span className="text-lg font-bold tabular-nums">{s.n}</span>
        </div>
      ))}
    </div>
  )
}

// Cadence timeline — for the "Smart follow-up cadence" card
export function CadenceVisual() {
  const steps = [
    { label: 'Touch 1', day: 'D 0', color: 'bg-purple-500' },
    { label: 'Follow up', day: 'D 3', color: 'bg-blue-500' },
    { label: 'Follow up', day: 'D 10', color: 'bg-blue-500' },
    { label: 'Final', day: 'D 24', color: 'bg-yellow-500' },
  ]
  return (
    <div className="aspect-[5/3] bg-gray-950/60 rounded-xl border border-white/5 p-4 flex flex-col justify-center">
      <div className="relative pl-2">
        {/* vertical line */}
        <div className="absolute left-3.5 top-2 bottom-2 w-px bg-white/10" />
        {steps.map((s, i) => (
          <div key={i} className="relative flex items-center gap-3 mb-2 last:mb-0">
            <span className={`relative z-10 w-3 h-3 rounded-full ${s.color} ring-4 ring-gray-950`} />
            <span className="text-[10px] text-gray-300">{s.label}</span>
            <span className="text-[9px] font-mono text-gray-500 ml-auto">{s.day}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Analytics card — for the "Favorites & analytics" card
export function AnalyticsVisual() {
  return (
    <div className="aspect-[5/3] bg-gray-950/60 rounded-xl border border-white/5 p-3 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 border border-white/5 rounded-lg p-2">
          <div className="text-[9px] uppercase tracking-wider text-gray-500">Win rate</div>
          <div className="text-base font-bold text-white tabular-nums">34%</div>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-lg p-2">
          <div className="text-[9px] uppercase tracking-wider text-gray-500">Pipeline $</div>
          <div className="text-base font-bold text-emerald-300 tabular-nums">$48k</div>
        </div>
      </div>
      <div className="flex-1 flex items-end gap-1">
        {[40, 65, 50, 80, 70, 90, 75].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-purple-500/40 to-blue-400/60"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  )
}
