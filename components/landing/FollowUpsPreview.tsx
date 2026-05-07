'use client'

import { motion } from 'motion/react'

// Faithful screenshot-style preview of the actual Follow-ups view —
// light-theme primary, with FUStat cards (not generic mini-stats),
// the same priority sections + colors, the cadence date pills, and
// the inline pipeline chip + Followed-up button matching the live UI.
export function FollowUpsPreview() {
  const high = [
    { name: 'FitForge',     stage: 'Second follow-up · 2 touches', late: '2d late',  dotColor: 'bg-red-500',    dealValue: 1200, initials: 'FF' },
    { name: 'Lens & Light', stage: 'First follow-up · 1 touch',    late: '4d late',  dotColor: 'bg-red-500',    dealValue: 800,  initials: 'LL' },
  ]
  const medium = { name: 'Solo Dev Diaries', stage: 'First follow-up · 1 touch', late: 'in 3d', dotColor: 'bg-yellow-500', dealValue: 500, initials: 'SD' }

  return (
    <div className="rounded-2xl border border-gray-900/10 dark:border-white/10 bg-white/95 dark:bg-gray-900/85 backdrop-blur-xl shadow-2xl shadow-gray-900/10 overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-900/5 dark:border-white/5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="ml-3 flex-1 max-w-sm rounded-md bg-gray-100 dark:bg-black/30 border border-gray-900/5 dark:border-white/5 text-[11px] text-gray-500 px-2.5 py-1 truncate">
          creatoroutreach.net / outreach
        </div>
      </div>

      {/* Top tabs */}
      <div className="flex items-center gap-1 px-4 pt-2.5 border-b border-gray-900/5 dark:border-white/5">
        <span className="px-3 py-2 text-[11px] font-medium text-gray-500">Results</span>
        <span className="relative px-3 py-2 text-[11px] font-medium text-gray-900 dark:text-white">
          Outreach <span className="ml-1 text-purple-600 dark:text-purple-300">(47)</span>
          <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
        </span>
        <span className="px-3 py-2 text-[11px] font-medium text-gray-500">Dismissed</span>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-gray-900/5 dark:border-white/5">
        {[
          { label: 'All' },
          { label: '★ Favorites' },
          { label: '⏰ Follow-ups', active: true, badge: 3 },
          { label: '📊 Analytics' },
        ].map((t) => (
          <span
            key={t.label}
            className={`text-[11px] px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
              t.active
                ? 'bg-purple-100 dark:bg-gray-700/60 text-purple-700 dark:text-white border border-purple-200 dark:border-white/10'
                : 'text-gray-500'
            }`}
          >
            {t.label}
            {t.badge && <span className="text-red-600 dark:text-red-400/90 text-[10px]">({t.badge})</span>}
          </span>
        ))}
      </div>

      <div className="p-4 bg-gradient-to-br from-purple-50/40 via-white to-blue-50/40 dark:from-transparent dark:via-transparent dark:to-transparent">
        {/* Headline */}
        <p className="text-[13px] text-gray-700 dark:text-gray-300 mb-3">
          <span className="text-red-700 dark:text-red-300 font-medium">3 high priority</span>
          <span className="text-gray-500"> · </span>
          <span className="text-amber-700 dark:text-yellow-300">2 medium</span>
          <span className="text-gray-500"> need your attention.</span>
        </p>

        {/* FUStat cards — clickable filter cards from the actual app */}
        <div className="grid grid-cols-4 gap-2.5 mb-5">
          <FUStat label="High priority" value="3" tone="red" sub="overdue / today" />
          <FUStat label="Medium" value="2" tone="yellow" sub="this week" />
          <FUStat label="Low / later" value="6" tone="blue" sub="next 7d+" />
          <FUStat label="Pipeline $" value="$14.2k" tone="emerald" sub="7 active leads" />
        </div>

        {/* High priority section */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🔥</span>
            <span className="text-[12px] font-semibold text-red-700 dark:text-red-300">High priority</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-px rounded-full border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300">
              {high.length}
            </span>
            <span className="text-[10px] text-gray-500 ml-1">· overdue or due today</span>
          </div>
          <div className="space-y-1.5">
            {high.map((r, i) => (
              <PreviewRow key={r.name} row={r} delay={0.3 + i * 0.08} bucket="high" />
            ))}
          </div>
        </div>

        {/* Medium priority section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">📅</span>
            <span className="text-[12px] font-semibold text-amber-700 dark:text-yellow-300">Medium priority</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-px rounded-full border border-amber-300 dark:border-yellow-500/40 text-amber-700 dark:text-yellow-300">
              2
            </span>
          </div>
          <PreviewRow row={medium} delay={0.5} bucket="medium" />
        </div>
      </div>
    </div>
  )
}

function FUStat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'red' | 'yellow' | 'blue' | 'emerald' }) {
  const valueColor = {
    red: 'text-red-700 dark:text-red-300',
    yellow: 'text-amber-700 dark:text-yellow-300',
    blue: 'text-blue-700 dark:text-blue-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
  }[tone]
  const borderColor = {
    red: 'border-red-200 dark:border-red-500/30',
    yellow: 'border-amber-200 dark:border-yellow-500/30',
    blue: 'border-blue-200 dark:border-blue-500/30',
    emerald: 'border-emerald-200 dark:border-emerald-500/30',
  }[tone]
  return (
    <div className={`bg-white dark:bg-white/5 border ${borderColor} rounded-lg p-2.5 shadow-sm shadow-gray-900/5`}>
      <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">{label}</div>
      <div className={`text-base font-bold tabular-nums ${valueColor}`}>{value}</div>
      <div className="text-[9px] text-gray-500 mt-0.5 truncate">{sub}</div>
    </div>
  )
}

function PreviewRow({ row, delay, bucket }: {
  row: { name: string; stage: string; late: string; dotColor: string; dealValue: number; initials: string }
  delay: number
  bucket: 'high' | 'medium'
}) {
  const datePillClass = bucket === 'high'
    ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40'
    : 'bg-amber-50 dark:bg-yellow-500/15 text-amber-800 dark:text-yellow-300 border-amber-200 dark:border-yellow-500/40'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-center gap-3 bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-white/5 rounded-lg px-3 py-2 shadow-sm shadow-gray-900/5"
    >
      <div className="relative shrink-0">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
          {row.initials}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${row.dotColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-gray-900 dark:text-white truncate">{row.name}</div>
        <div className="text-[10px] text-gray-500 truncate">{row.stage}</div>
      </div>
      {/* Pipeline $ chip — editable in the real app */}
      <span className="text-[10px] font-mono px-1.5 py-px rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 shrink-0" title="Pipeline value · click to edit">
        ${row.dealValue.toLocaleString()}
      </span>
      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border shrink-0 font-medium ${datePillClass}`}>
        {row.late}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] font-medium text-purple-700 dark:text-purple-200 bg-purple-100 dark:bg-purple-600/30 border border-purple-300 dark:border-purple-500/40 rounded px-2 py-0.5">
          Followed up
        </span>
        <span className="w-5 h-5 flex items-center justify-center text-gray-500 border border-gray-300 dark:border-white/10 rounded text-[9px]">
          ⌛
        </span>
      </div>
    </motion.div>
  )
}
