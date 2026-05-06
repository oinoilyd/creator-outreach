'use client'

import { motion } from 'motion/react'

// Stylized "screenshot" of the Analytics dashboard for the landing-page
// preview carousel. Shows the top-stats strip + status breakdown bar +
// 2 detail cards (velocity / by medium).
export function AnalyticsPreview() {
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
          { label: '⏰ Follow-ups' },
          { label: '📊 Analytics', active: true },
        ].map((t) => (
          <span
            key={t.label}
            className={`text-[11px] px-2.5 py-1 rounded-full ${
              t.active ? 'bg-gray-700/60 text-white border border-white/10' : 'text-gray-500'
            }`}
          >
            {t.label}
          </span>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* Top stats — 7 compact cards */}
        <div className="grid grid-cols-7 gap-1.5">
          {[
            { label: 'In pipeline', value: '47', sub: 'total' },
            { label: 'Reached out', value: '34', sub: '72%' },
            { label: 'Resp received', value: '20', sub: 'S + R' },
            { label: 'Resp rate', value: '59%', sub: '20 of 34' },
            { label: 'Win rate', value: '60%', sub: '12 of 20' },
            { label: 'Pipeline $', value: '$48k', sub: 'non-rejected' },
            { label: 'Stale', value: '3', sub: 'overdue' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04, duration: 0.4 }}
              className="bg-white/5 border border-white/5 rounded-md px-2 py-1.5"
            >
              <div className="text-[8px] uppercase tracking-wider text-gray-500 truncate">{s.label}</div>
              <div className="text-sm font-bold text-white tabular-nums">{s.value}</div>
              <div className="text-[8px] text-gray-500 truncate">{s.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Status breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="bg-gray-900/60 border border-white/5 rounded-lg p-3"
        >
          <div className="text-[11px] font-semibold text-white mb-2">Status breakdown</div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-white/5 mb-2">
            <motion.div initial={{ width: 0 }} animate={{ width: '26%' }} transition={{ delay: 0.7, duration: 0.7 }} className="bg-emerald-500" title="Successful" />
            <motion.div initial={{ width: 0 }} animate={{ width: '30%' }} transition={{ delay: 0.7, duration: 0.7 }} className="bg-blue-500" title="Open" />
            <motion.div initial={{ width: 0 }} animate={{ width: '26%' }} transition={{ delay: 0.7, duration: 0.7 }} className="bg-gray-500" title="No Response" />
            <motion.div initial={{ width: 0 }} animate={{ width: '17%' }} transition={{ delay: 0.7, duration: 0.7 }} className="bg-red-500" title="Rejected" />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
            {[
              { label: 'Successful', n: 12, color: 'bg-emerald-500' },
              { label: 'Open', n: 14, color: 'bg-blue-500' },
              { label: 'No Response', n: 12, color: 'bg-gray-500' },
              { label: 'Rejected', n: 8, color: 'bg-red-500' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-sm ${s.color}`} />
                <span className="text-gray-400">{s.label}</span>
                <span className="text-gray-200 tabular-nums">{s.n}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Two detail cards */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.85, duration: 0.5 }}
            className="bg-gray-900/60 border border-white/5 rounded-lg p-3"
          >
            <div className="text-[11px] font-semibold text-white mb-2">Velocity (last 7 days)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xl font-bold text-white tabular-nums">8</div>
                <div className="text-[10px] text-gray-500">added</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white tabular-nums">5</div>
                <div className="text-[10px] text-gray-500">reached out</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.95, duration: 0.5 }}
            className="bg-gray-900/60 border border-white/5 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-semibold text-white">Outreach by medium</div>
              <div className="flex bg-gray-800/60 rounded p-0.5">
                <span className="px-1.5 text-[9px] text-white bg-gray-700 rounded">All</span>
                <span className="px-1.5 text-[9px] text-gray-500">✓</span>
                <span className="px-1.5 text-[9px] text-gray-500">✕</span>
              </div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-white/5 mb-2">
              <div className="bg-purple-500" style={{ width: '45%' }} />
              <div className="bg-blue-500" style={{ width: '35%' }} />
              <div className="bg-gray-500" style={{ width: '20%' }} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-purple-500" /><span className="text-gray-400">Email</span><span className="text-gray-200">15</span></div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-blue-500" /><span className="text-gray-400">LinkedIn</span><span className="text-gray-200">12</span></div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-gray-500" /><span className="text-gray-400">Other</span><span className="text-gray-200">7</span></div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
