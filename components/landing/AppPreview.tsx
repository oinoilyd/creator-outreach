'use client'

import { motion } from 'motion/react'
import { Star, Mail } from 'lucide-react'

// Stylized "screenshot" of the outreach grid. Renders client-side as
// real DOM so it scales crisp on retina + works in dark mode without
// shipping a PNG.
export function AppPreview() {
  const rows = [
    { name: 'FitForge', stage: 'Open · 1 touch · 3d ago', fit: 87, value: 1200, dot: 'bg-blue-500',  email: true,  ig: false, ln: true },
    { name: 'Lens & Light', stage: 'Open · 2 touches · 8d ago', fit: 81, value: 800, dot: 'bg-yellow-500', email: true, ig: true, ln: false },
    { name: 'Solo Dev Diaries', stage: 'No Response · 14d ago', fit: 74, value: 0, dot: 'bg-gray-500', email: false, ig: false, ln: true },
    { name: 'Quick Recipes Co.', stage: 'Successful · 1d ago', fit: 92, value: 2400, dot: 'bg-emerald-500', email: true, ig: true, ln: false },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.6, ease: 'easeOut' }}
      className="relative mx-auto w-full max-w-4xl"
    >
      {/* Glow */}
      <div className="absolute inset-x-0 -inset-y-4 bg-gradient-to-r from-purple-600/30 via-blue-600/20 to-pink-600/20 blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl border border-white/10 bg-gray-900/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
          <span className="w-3 h-3 rounded-full bg-red-400/70" />
          <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
          <span className="w-3 h-3 rounded-full bg-emerald-400/70" />
          <div className="ml-3 flex-1 max-w-sm rounded-md bg-black/30 border border-white/5 text-[11px] text-gray-500 px-2.5 py-1 truncate">
            creatoroutreach.net / outreach
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-white/5">
          <Tab label="Results" />
          <Tab label="Outreach" count={47} active />
          <Tab label="Dismissed" />
          <div className="ml-auto flex items-center gap-2 pb-2">
            <span className="text-[10px] uppercase tracking-wider text-purple-300 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30">
              ⏰ 3 follow-ups due
            </span>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-white/5">
          {[
            { label: 'All', active: true },
            { label: '★ Favorites' },
            { label: '⏰ Follow-ups' },
            { label: '📊 Analytics' },
          ].map((t) => (
            <span
              key={t.label}
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                t.active ? 'bg-gray-700/60 text-white border border-white/10' : 'text-gray-500'
              }`}
            >
              {t.label}
            </span>
          ))}
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[20px_1fr_140px_72px_80px_80px] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">
          <span>★</span>
          <span>Channel</span>
          <span>Stage</span>
          <span>Fit</span>
          <span className="text-right">Deal</span>
          <span>Contact</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/5">
          {rows.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 + i * 0.08, duration: 0.4 }}
              className="grid grid-cols-[20px_1fr_140px_72px_80px_80px] gap-3 px-4 py-3 items-center hover:bg-white/5 transition-colors"
            >
              <Star className={`w-3.5 h-3.5 ${i === 3 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'}`} />
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
                    {r.name.split(' ').map(s => s[0]).slice(0,2).join('')}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${r.dot}`} />
                </div>
                <span className="text-sm text-white truncate">{r.name}</span>
              </div>
              <span className="text-[11px] text-gray-400 truncate">{r.stage}</span>
              <FitChip score={r.fit} />
              <span className="text-[11px] font-mono text-emerald-300 text-right">
                {r.value > 0 ? `$${r.value}` : <span className="text-gray-700">—</span>}
              </span>
              <div className="flex items-center gap-1">
                {r.email && <Mail className="w-3 h-3 text-emerald-400/80" />}
                {r.ig && <span className="text-[10px] text-pink-300">IG</span>}
                {r.ln && <span className="text-[10px] font-bold text-blue-300">in</span>}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function Tab({ label, count, active }: { label: string; count?: number; active?: boolean }) {
  return (
    <span
      className={`relative px-3 py-2 text-[11px] font-medium transition-colors ${
        active ? 'text-white' : 'text-gray-500'
      }`}
    >
      {label}
      {count != null && <span className="ml-1 text-purple-300">({count})</span>}
      {active && <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full" />}
    </span>
  )
}

function FitChip({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : score >= 75 ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    : 'bg-gray-700/40 text-gray-400 border-gray-700'
  return (
    <span className={`inline-flex items-center justify-center text-[10px] font-mono px-2 py-0.5 rounded-md border ${color}`}>
      {score}
    </span>
  )
}
