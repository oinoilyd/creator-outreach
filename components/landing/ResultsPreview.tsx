'use client'

import { motion } from 'motion/react'
import { Search, Mail, Plus } from 'lucide-react'

// Faithful screenshot-style preview of the actual Results / search
// view. Light-theme primary (matching production), with the real
// column shape: Dismiss/Outreach actions, Channel, Fit Score, Avg
// Views, Subscribers, Last Video, Email, LinkedIn.
export function ResultsPreview() {
  const rows = [
    { name: 'HomeGym Hub',     subs: '128K', views: '54K',  when: '2 days ago',  fit: 88, email: 'hello@homegymhub.com',  hasLi: true },
    { name: 'CalisthenicsClub', subs: '76K',  views: '32K',  when: '5 days ago',  fit: 82, email: 'pr@cclub.io',           hasLi: false },
    { name: 'StrengthLab Pro',  subs: '212K', views: '89K',  when: '1 day ago',   fit: 79, email: '',                       hasLi: false },
    { name: 'MovementCo',       subs: '54K',  views: '21K',  when: '12 days ago', fit: 71, email: 'team@movement.co',     hasLi: true },
  ]

  return (
    <div className="rounded-2xl border border-gray-900/10 dark:border-white/10 bg-white/95 dark:bg-gray-900/85 backdrop-blur-xl shadow-2xl shadow-gray-900/10 overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-900/5 dark:border-white/5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="ml-3 flex-1 max-w-sm rounded-md bg-gray-100 dark:bg-black/30 border border-gray-900/5 dark:border-white/5 text-[11px] text-gray-500 px-2.5 py-1 truncate">
          creatoroutreach.net
        </div>
      </div>

      {/* Top tabs */}
      <div className="flex items-center gap-1 px-4 pt-2.5 border-b border-gray-900/5 dark:border-white/5">
        <span className="relative px-3 py-2 text-[11px] font-medium text-gray-900 dark:text-white">
          Results <span className="ml-1 text-gray-500">(127)</span>
          <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
        </span>
        <span className="px-3 py-2 text-[11px] font-medium text-gray-500">Outreach <span className="ml-1 text-purple-500/60">(47)</span></span>
        <span className="px-3 py-2 text-[11px] font-medium text-gray-500">Dismissed <span className="ml-1 text-gray-400/60">(33)</span></span>
      </div>

      {/* Platform pills */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-900/5 dark:border-white/5">
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300">▶ YouTube</span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full text-gray-500">Instagram</span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full text-gray-500">TikTok</span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full text-gray-500">X</span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full text-gray-500">LinkedIn</span>
      </div>

      {/* Search bar with filter chips — matches the gradient input + filter pills */}
      <div className="px-4 py-3 border-b border-gray-900/5 dark:border-white/5 flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 border border-purple-200 dark:border-purple-500/30 px-3 py-2">
          <Search className="w-3.5 h-3.5 text-purple-600 dark:text-purple-300 shrink-0" />
          <span className="text-[12px] text-gray-700 dark:text-gray-300 truncate">fitness coaches</span>
        </div>
        <span className="text-[10px] text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">10K – 500K</span>
        <span className="text-[10px] text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">Last 90d</span>
        <span className="text-[10px] text-purple-700 dark:text-purple-300 px-2 py-1 rounded-md bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30">🌐 English</span>
      </div>

      {/* Header row — column action icons + Channel + sortable cols */}
      <div className="grid grid-cols-[36px_36px_1fr_56px_64px_64px_88px_140px_56px] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-900/5 dark:border-white/5 bg-gray-50 dark:bg-transparent">
        <span className="text-center">✕</span>
        <span className="text-center">＋</span>
        <span>Channel</span>
        <span className="text-center">Fit</span>
        <span className="text-right">Subs</span>
        <span className="text-right">Avg views</span>
        <span>Last video</span>
        <span>Email ↕</span>
        <span>LinkedIn</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {rows.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
            className="grid grid-cols-[36px_36px_1fr_56px_64px_64px_88px_140px_56px] gap-2 px-4 py-2.5 items-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <span className="text-gray-400 hover:text-red-500 text-base text-center">✕</span>
            <span className="text-purple-600 dark:text-purple-300 text-base text-center"><Plus className="w-4 h-4 mx-auto" /></span>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                {r.name.split(/\s+/).slice(0,2).map(s => s[0]).join('')}
              </div>
              <span className="text-[12px] text-blue-700 dark:text-blue-400 truncate hover:underline">{r.name}</span>
            </div>
            <FitChip score={r.fit} />
            <span className="text-[11px] font-mono text-gray-700 dark:text-gray-300 text-right">{r.subs}</span>
            <span className="text-[11px] font-mono text-gray-700 dark:text-gray-300 text-right">{r.views}</span>
            <span className="text-[10px] text-gray-500 truncate">{r.when}</span>
            <div className="text-[11px] truncate">
              {r.email
                ? <a className="text-emerald-700 dark:text-emerald-400 truncate inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {r.email}</a>
                : <span className="text-purple-700 dark:text-purple-300 inline-flex items-center gap-1 border border-purple-300 dark:border-purple-500/30 rounded px-1.5 py-0.5 text-[10px]">🔍 Deep search</span>
              }
            </div>
            <span className="text-[11px]">
              {r.hasLi
                ? <a className="text-blue-700 dark:text-blue-400 hover:underline">link</a>
                : <span className="text-gray-400">—</span>}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function FitChip({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
    : score >= 75 ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
    : 'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
  return (
    <span className={`mx-auto inline-flex items-center justify-center text-[10px] font-mono px-2 py-0.5 rounded-md border ${color}`}>
      {score}
    </span>
  )
}
