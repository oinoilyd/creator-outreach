'use client'

import { motion } from 'motion/react'
import { Search, Mail, Plus } from 'lucide-react'

// Stylized "screenshot" of the Results / search view — usually the
// first screen a user sees, so it's the carousel's default.
export function ResultsPreview() {
  const rows = [
    { name: 'HomeGym Hub',     subs: '128K', views: '54K', when: '2 days ago', fit: 88, email: 'hello@homegymhub.com',  status: '+ Add' },
    { name: 'CalisthenicsClub', subs: '76K',  views: '32K', when: '5 days ago', fit: 82, email: 'pr@cclub.io',           status: '+ Add' },
    { name: 'StrengthLab Pro',  subs: '212K', views: '89K', when: '1 day ago',  fit: 79, email: '',                       status: '🔍' },
    { name: 'MovementCo',       subs: '54K',  views: '21K', when: '12 days ago', fit: 71, email: 'team@movement.co',     status: '+ Add' },
  ]

  return (
    <div className="rounded-2xl border border-white/10 bg-gray-900/85 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        <div className="ml-3 flex-1 max-w-sm rounded-md bg-black/30 border border-white/5 text-[11px] text-gray-500 px-2.5 py-1 truncate">
          creatoroutreach.net / search
        </div>
      </div>

      {/* Top tabs */}
      <div className="flex items-center gap-1 px-4 pt-2.5 border-b border-white/5">
        <span className="relative px-3 py-2 text-[11px] font-medium text-white">
          Results
          <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full" />
        </span>
        <span className="px-3 py-2 text-[11px] font-medium text-gray-500">Outreach <span className="ml-1 text-purple-300/60">(47)</span></span>
        <span className="px-3 py-2 text-[11px] font-medium text-gray-500">Dismissed</span>
      </div>

      {/* Platform pills */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5">
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">▶ YouTube</span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full text-gray-500">Instagram</span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full text-gray-500">TikTok</span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full text-gray-500">X</span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full text-gray-500">LinkedIn</span>
      </div>

      {/* Search bar with filter chips */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 rounded-lg bg-gray-800/60 border border-white/10 px-3 py-2">
          <Search className="w-3.5 h-3.5 text-purple-300 shrink-0" />
          <span className="text-[12px] text-gray-300 truncate font-mono">fitness creators</span>
        </div>
        <span className="text-[10px] text-gray-300 px-2 py-1 rounded-md bg-white/5 border border-white/10">10K–500K</span>
        <span className="text-[10px] text-gray-300 px-2 py-1 rounded-md bg-white/5 border border-white/10">Last 90d</span>
        <span className="text-[10px] text-gray-300 px-2 py-1 rounded-md bg-white/5 border border-white/10">US</span>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[1fr_64px_64px_88px_56px_1fr_64px] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">
        <span>Channel</span>
        <span className="text-right">Subs</span>
        <span className="text-right">Avg views</span>
        <span>Last posted</span>
        <span className="text-center">Fit</span>
        <span>Email</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {rows.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
            className="grid grid-cols-[1fr_64px_64px_88px_56px_1fr_64px] gap-3 px-4 py-2.5 items-center hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                {r.name.split(/\s+/).slice(0,2).map(s => s[0]).join('')}
              </div>
              <span className="text-[12px] text-white truncate">{r.name}</span>
            </div>
            <span className="text-[11px] font-mono text-gray-300 text-right">{r.subs}</span>
            <span className="text-[11px] font-mono text-gray-300 text-right">{r.views}</span>
            <span className="text-[10px] text-gray-400 truncate">{r.when}</span>
            <FitChip score={r.fit} />
            <div className="text-[11px] truncate">
              {r.email
                ? <a className="text-emerald-300 truncate inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {r.email}</a>
                : <span className="text-purple-300 inline-flex items-center gap-1 border border-purple-500/30 rounded px-1.5 py-0.5 text-[10px]">🔍 Deep search</span>
              }
            </div>
            <div className="flex items-center justify-end gap-1">
              <span className="text-[10px] font-medium text-purple-200 bg-purple-600/30 border border-purple-500/40 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5">
                <Plus className="w-3 h-3" />
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function FitChip({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : score >= 75 ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    : 'bg-gray-700/40 text-gray-400 border-gray-700'
  return (
    <span className={`mx-auto inline-flex items-center justify-center text-[10px] font-mono px-2 py-0.5 rounded-md border ${color}`}>
      {score}
    </span>
  )
}
