'use client'

import { motion } from 'motion/react'

// Faithful screenshot-style preview of the actual Outreach → Analytics
// dashboard. Mirrors the live UI: 7 stat cards with the real labels +
// sub-text, 5-segment status breakdown (incl. Not Outreached), velocity
// + medium-toggle cards, and a custom-metrics row.
export function AnalyticsPreview() {
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

      {/* Top tabs (matches the real app) */}
      <div className="flex items-center gap-1 px-4 pt-2.5 border-b border-gray-900/5 dark:border-white/5">
        <span className="px-3 py-2 text-[11px] font-medium text-gray-500">Results</span>
        <span className="relative px-3 py-2 text-[11px] font-medium text-gray-900 dark:text-white">
          Outreach <span className="ml-1 text-purple-600 dark:text-purple-300">(47)</span>
          <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
        </span>
        <span className="px-3 py-2 text-[11px] font-medium text-gray-500">Dismissed</span>
      </div>

      {/* Sub-tabs (matches the real Outreach sub-tab strip) */}
      <div className="flex gap-1 px-4 py-2 border-b border-gray-900/5 dark:border-white/5">
        {[
          { label: 'All' },
          { label: '★ Favorites' },
          { label: '⏰ Follow-ups' },
          { label: '📊 Analytics', active: true },
        ].map((t) => (
          <span
            key={t.label}
            className={`text-[11px] px-2.5 py-1 rounded-full ${
              t.active
                ? 'bg-purple-100 dark:bg-gray-700/60 text-purple-700 dark:text-white border border-purple-200 dark:border-white/10'
                : 'text-gray-500'
            }`}
          >
            {t.label}
          </span>
        ))}
      </div>

      <div className="p-4 space-y-4 bg-gradient-to-br from-purple-50/40 via-white to-blue-50/40 dark:from-transparent dark:via-transparent dark:to-transparent">
        {/* Top stats — actual labels + sub-text from OutreachAnalytics */}
        <div className="grid grid-cols-7 gap-1.5">
          {[
            { label: 'In pipeline',     value: '47',    sub: '' },
            { label: 'Reached out',     value: '34',    sub: '72% of pipeline' },
            { label: 'Response received', value: '20',  sub: 'Successful + Rejected' },
            { label: 'Response rate',   value: '59%',   sub: '20 of 34 reached out' },
            { label: 'Win rate',        value: '60%',   sub: '12 of 20 responses' },
            { label: 'Pipeline $',      value: '$48k',  sub: 'non-rejected' },
            { label: 'Stale follow-ups', value: '3',    sub: '', highlight: true },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04, duration: 0.4 }}
              className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-md px-2 py-1.5 shadow-sm shadow-gray-900/5"
            >
              <div className="text-[8px] uppercase tracking-wider text-gray-500 truncate">{s.label}</div>
              <div className={`text-sm font-bold tabular-nums ${s.highlight ? 'text-amber-600 dark:text-yellow-300' : 'text-gray-900 dark:text-white'}`}>{s.value}</div>
              {s.sub && <div className="text-[8px] text-gray-500 truncate">{s.sub}</div>}
            </motion.div>
          ))}
        </div>

        {/* Status breakdown — 5 segments matching live (incl. Not Outreached) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-white/5 rounded-lg p-3 shadow-sm shadow-gray-900/5"
        >
          <div className="text-[11px] font-semibold text-gray-900 dark:text-white mb-2">Status breakdown</div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5 mb-2">
            <motion.div initial={{ width: 0 }} animate={{ width: '26%' }} transition={{ delay: 0.7, duration: 0.7 }} className="bg-emerald-500" />
            <motion.div initial={{ width: 0 }} animate={{ width: '30%' }} transition={{ delay: 0.7, duration: 0.7 }} className="bg-blue-500" />
            <motion.div initial={{ width: 0 }} animate={{ width: '21%' }} transition={{ delay: 0.7, duration: 0.7 }} className="bg-gray-400" />
            <motion.div initial={{ width: 0 }} animate={{ width: '12%' }} transition={{ delay: 0.7, duration: 0.7 }} className="bg-red-500" />
            <motion.div initial={{ width: 0 }} animate={{ width: '11%' }} transition={{ delay: 0.7, duration: 0.7 }} className="bg-gray-200 dark:bg-gray-600" />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
            {[
              { label: 'Successful',     n: 12, color: 'bg-emerald-500' },
              { label: 'Open',           n: 14, color: 'bg-blue-500' },
              { label: 'No Response',    n: 10, color: 'bg-gray-400' },
              { label: 'Rejected',       n:  6, color: 'bg-red-500' },
              { label: 'Not Outreached', n:  5, color: 'bg-gray-200 dark:bg-gray-600' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-sm ${s.color}`} />
                <span className="text-gray-600 dark:text-gray-400">{s.label}</span>
                <span className="text-gray-900 dark:text-gray-200 tabular-nums">{s.n}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Velocity + medium row */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.85, duration: 0.5 }}
            className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-white/5 rounded-lg p-3 shadow-sm shadow-gray-900/5"
          >
            <div className="text-[11px] font-semibold text-gray-900 dark:text-white mb-2">Velocity (last 7 days)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">8</div>
                <div className="text-[10px] text-gray-500">added</div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">5</div>
                <div className="text-[10px] text-gray-500">reached out</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.95, duration: 0.5 }}
            className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-white/5 rounded-lg p-3 shadow-sm shadow-gray-900/5"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-semibold text-gray-900 dark:text-white">Outreach by medium</div>
              {/* Match the actual app: All / Successful / Rejected toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-800/60 rounded p-0.5">
                <span className="px-1.5 text-[9px] text-purple-700 dark:text-white bg-white dark:bg-gray-700 rounded shadow-sm">All</span>
                <span className="px-1.5 text-[9px] text-gray-500">Successful</span>
                <span className="px-1.5 text-[9px] text-gray-500">Rejected</span>
              </div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5 mb-2">
              <div className="bg-purple-500" style={{ width: '45%' }} />
              <div className="bg-blue-500" style={{ width: '35%' }} />
              <div className="bg-gray-400" style={{ width: '20%' }} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-purple-500" /><span className="text-gray-600 dark:text-gray-400">Email</span><span className="text-gray-900 dark:text-gray-200">15</span></div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-blue-500" /><span className="text-gray-600 dark:text-gray-400">LinkedIn</span><span className="text-gray-900 dark:text-gray-200">12</span></div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-gray-400" /><span className="text-gray-600 dark:text-gray-400">Other</span><span className="text-gray-900 dark:text-gray-200">7</span></div>
            </div>
          </motion.div>
        </div>

        {/* Custom metrics row — matches the real "My metrics" section */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          <div className="text-[11px] font-semibold text-gray-900 dark:text-white mb-2">My metrics</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Avg fit · successful', value: '78', type: 'average' },
              { label: 'Reached this week',    value: '5',  type: 'count' },
              { label: 'Email reach rate',     value: '64%', type: 'percent' },
              { label: 'Pipeline · open',      value: '$22k', type: 'sum' },
            ].map(m => (
              <div key={m.label} className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-white/5 rounded-md px-2.5 py-2 shadow-sm shadow-gray-900/5">
                <div className="text-[8px] uppercase tracking-wider text-gray-500 mb-0.5 truncate">{m.label}</div>
                <div className="text-base font-bold text-gray-900 dark:text-white tabular-nums">{m.value}</div>
                <div className="text-[8px] text-gray-500 capitalize">{m.type}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
