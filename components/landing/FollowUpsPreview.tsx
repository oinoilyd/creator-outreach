'use client'

import { motion } from 'motion/react'

// Stylized "screenshot" of the Follow-ups dashboard for the carousel.
export function FollowUpsPreview() {
  const high = [
    { name: 'FitForge', stage: 'Second follow-up', tps: 2, late: '2d late', dotColor: 'bg-red-500', dealValue: 1200, fit: 87 },
    { name: 'Lens & Light', stage: 'First follow-up', tps: 1, late: '4d late', dotColor: 'bg-red-500', dealValue: 800, fit: 81 },
  ]
  const medium = { name: 'Solo Dev Diaries', stage: 'First follow-up', tps: 1, late: 'in 3d', dotColor: 'bg-blue-500', dealValue: 500, fit: 76 }

  return (
    <div className="rounded-2xl border border-white/10 bg-gray-900/85 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        <div className="ml-3 flex-1 max-w-sm rounded-md bg-black/30 border border-white/5 text-[11px] text-gray-500 px-2.5 py-1 truncate">
          creatoroutreach.net / outreach
        </div>
      </div>

      {/* Top tabs */}
      <div className="flex items-center gap-1 px-4 pt-2.5 border-b border-white/5">
        <span className="px-3 py-2 text-[11px] font-medium text-gray-500">Results</span>
        <span className="relative px-3 py-2 text-[11px] font-medium text-white">
          Outreach <span className="ml-1 text-purple-300">(47)</span>
          <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full" />
        </span>
        <span className="px-3 py-2 text-[11px] font-medium text-gray-500">Dismissed</span>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-white/5">
        {[
          { label: 'All' },
          { label: '★ Favorites' },
          { label: '⏰ Follow-ups', active: true, badge: 3 },
          { label: '📊 Analytics' },
        ].map((t) => (
          <span
            key={t.label}
            className={`text-[11px] px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
              t.active ? 'bg-gray-700/60 text-white border border-white/10' : 'text-gray-500'
            }`}
          >
            {t.label}
            {t.badge && <span className="text-red-400/90 text-[10px]">({t.badge})</span>}
          </span>
        ))}
      </div>

      <div className="p-4">
        {/* Headline */}
        <p className="text-[13px] text-gray-300 mb-3">
          <span className="text-red-300 font-medium">3 high priority</span>
          <span className="text-gray-500"> · </span>
          <span className="text-yellow-300">2 medium</span>
          <span className="text-gray-500"> need your attention.</span>
        </p>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-2.5 mb-5">
          <MiniStat label="High priority" value="3" tone="red" sub="40% of queue" />
          <MiniStat label="Medium" value="2" tone="yellow" sub="due this week" />
          <MiniStat label="At-risk $" value="$2k" tone="red" sub="3 leads" />
          <MiniStat label="Pipeline $" value="$14.2k" tone="green" sub="7 active · 11 touches" />
        </div>

        {/* High priority section */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🔥</span>
            <span className="text-[12px] font-semibold text-red-300">High priority</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-px rounded-full border border-red-500/40 text-red-300">
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

        {/* Medium priority section preview */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">📅</span>
            <span className="text-[12px] font-semibold text-yellow-300">Medium priority</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-px rounded-full border border-yellow-500/40 text-yellow-300">
              2
            </span>
          </div>
          <PreviewRow row={medium} delay={0.5} bucket="medium" />
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'red' | 'yellow' | 'green' }) {
  const valueColor = tone === 'red' ? 'text-red-300' : tone === 'yellow' ? 'text-yellow-300' : 'text-emerald-300'
  const borderColor = tone === 'red' ? 'border-red-500/30' : tone === 'yellow' ? 'border-yellow-500/30' : 'border-emerald-500/30'
  return (
    <div className={`bg-white/5 border ${borderColor} rounded-lg p-2.5`}>
      <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">{label}</div>
      <div className={`text-base font-bold tabular-nums ${valueColor}`}>{value}</div>
      <div className="text-[9px] text-gray-500 mt-0.5 truncate">{sub}</div>
    </div>
  )
}

function PreviewRow({ row, delay, bucket }: {
  row: { name: string; stage: string; tps: number; late: string; dotColor: string; dealValue: number; fit: number }
  delay: number
  bucket: 'high' | 'medium'
}) {
  const initials = row.name.split(/\s+/).slice(0, 2).map(s => s[0]).join('')
  const datePillClass = bucket === 'high'
    ? 'bg-red-500/15 text-red-300 border-red-500/40'
    : 'bg-blue-500/10 text-blue-300 border-blue-500/30'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-center gap-3 bg-gray-900/40 border border-white/5 rounded-lg px-3 py-2"
    >
      <div className="relative shrink-0">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
          {initials}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${row.dotColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-white truncate">{row.name}</div>
        <div className="text-[10px] text-gray-500 truncate">
          <span className="text-gray-300">{row.stage}</span>
          <span> · {row.tps} touch{row.tps === 1 ? '' : 'es'}</span>
        </div>
      </div>
      <span className="text-[10px] font-mono px-1.5 py-px rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shrink-0">
        ${row.dealValue}
      </span>
      <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${datePillClass}`}>
        {row.late}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] font-medium text-purple-200 bg-purple-600/30 border border-purple-500/40 rounded px-2 py-0.5">
          Followed up
        </span>
        <span className="w-5 h-5 flex items-center justify-center text-gray-500 border border-white/10 rounded text-[9px]">
          ⌛
        </span>
      </div>
    </motion.div>
  )
}
