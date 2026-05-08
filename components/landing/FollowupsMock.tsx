'use client'

/**
 * FollowupsMock — stylized "Due today" inbox mockup used in:
 *   1. The 04 / Follow-ups product narrative (replaces followups.png
 *      which Dylan flagged as looking weird/off)
 *   2. The "Why this exists" Chapter 03 visual
 *
 * Built as React+Tailwind (not an inline SVG) so the type renders
 * crisp at any size and the cadence chips can subtly animate.
 *
 * The mock shows four Due-Today follow-ups with avatar discs,
 * creator name + niche, days-since-contact, cadence chip, and a
 * reset action. Status pills color-code urgency.
 */

type Row = {
  initials: string
  name: string
  niche: string
  daysAgo: number
  cadence: string
  /** Color name for the cadence chip + dot. */
  tone: 'red' | 'amber' | 'navy' | 'green'
}

const ROWS: Row[] = [
  { initials: 'MV', name: 'Marisa Vance', niche: 'Fishing newsletter · 9K subs', daysAgo: 12, cadence: '7d', tone: 'red' },
  { initials: 'JR', name: 'Jonas Reyes', niche: 'Long-form podcast', daysAgo: 7, cadence: '7d', tone: 'amber' },
  { initials: 'PS', name: 'Priya Soni', niche: 'Solo agency · 4 clients', daysAgo: 4, cadence: '3d', tone: 'navy' },
  { initials: 'AK', name: 'Aaron Kohli', niche: 'Tech YouTuber · 47K', daysAgo: 14, cadence: '14d', tone: 'green' },
]

const TONE_STYLES: Record<Row['tone'], { chip: string; dot: string; reset: string; avatarBg: string }> = {
  red: {
    chip: 'bg-red-500/15 text-red-700 border-red-500/40 dark:text-red-300 dark:bg-red-500/20',
    dot: 'bg-red-500',
    reset: 'text-red-700 dark:text-red-300',
    avatarBg: '#E85D2F',
  },
  amber: {
    chip: 'bg-amber-500/15 text-amber-800 border-amber-500/40 dark:text-amber-300 dark:bg-amber-500/20',
    dot: 'bg-amber-500',
    reset: 'text-amber-800 dark:text-amber-300',
    avatarBg: '#F2A261',
  },
  navy: {
    chip: 'bg-[#0F1733]/10 text-[#0F1733] border-[#0F1733]/30 dark:text-white/85 dark:bg-white/10 dark:border-white/25',
    dot: 'bg-[#0F1733] dark:bg-white/70',
    reset: 'text-[#0F1733]/80 dark:text-white/80',
    avatarBg: '#1B6FB5',
  },
  green: {
    chip: 'bg-green-500/15 text-green-700 border-green-500/40 dark:text-green-300 dark:bg-green-500/20',
    dot: 'bg-green-500',
    reset: 'text-green-700 dark:text-green-300',
    avatarBg: '#16A34A',
  },
}

export function FollowupsMock({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="relative rounded-2xl border border-[#0F1733]/15 dark:border-white/15 overflow-hidden bg-white dark:bg-[#0E121C]"
      style={{
        boxShadow:
          '0 30px 60px -25px rgba(15,23,51,0.30), 0 14px 30px -10px rgba(232,93,47,0.16)',
      }}
    >
      {/* Top bar — terracotta scan line + tab strip */}
      <div className="relative h-9 border-b border-[#0F1733]/10 dark:border-white/10 flex items-center px-4 bg-gradient-to-b from-[#FCFAF6] to-white dark:from-[#13192B] dark:to-[#0E121C]">
        <div
          aria-hidden
          className="absolute top-0 inset-x-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(232,93,47,0.85) 30%, rgba(242,162,97,0.85) 70%, transparent)' }}
        />
        {/* Window dots */}
        <div className="flex items-center gap-1.5 mr-4">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]/70" />
        </div>
        {/* Tab indicator */}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#E85D2F] dark:text-[#F2A261]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15.5 14" />
          </svg>
          Follow-ups
          <span className="ml-1 px-1.5 py-px rounded-full bg-[#E85D2F]/15 text-[10px] tabular-nums">{ROWS.length}</span>
        </div>
        <div className="ml-auto text-[10px] uppercase tracking-[0.2em] text-[#0F1733]/40 dark:text-white/40 font-mono">
          Due today
        </div>
      </div>

      {/* Header row — column titles */}
      <div className="grid grid-cols-[2fr_1fr_auto] md:grid-cols-[2.4fr_1fr_auto] items-center gap-3 px-4 py-2.5 border-b border-[#0F1733]/8 dark:border-white/8 text-[10px] uppercase tracking-[0.18em] font-bold text-[#0F1733]/45 dark:text-white/45 font-mono">
        <span>Creator</span>
        <span className="text-right md:text-left">Last reach · cadence</span>
        <span className="opacity-0 select-none" aria-hidden>Reset</span>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-[#0F1733]/8 dark:divide-white/8">
        {ROWS.map((r, i) => {
          const t = TONE_STYLES[r.tone]
          const cadenceDays = parseInt(r.cadence, 10) || 7
          const overdue = r.daysAgo >= cadenceDays
          return (
            <li
              key={r.initials}
              className="grid grid-cols-[2fr_1fr_auto] md:grid-cols-[2.4fr_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-[#E85D2F]/[0.04]"
              style={{
                animation: `fum-row-in 600ms ${100 + i * 100}ms ease-out backwards`,
              }}
            >
              {/* Creator cell */}
              <div className="flex items-center gap-3 min-w-0">
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-[11px] font-bold shrink-0"
                  style={{ backgroundColor: t.avatarBg }}
                >
                  {r.initials}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold tracking-tight text-[#0F1733] dark:text-white truncate">
                    {r.name}
                  </div>
                  {!compact && (
                    <div className="text-[11px] text-[#0F1733]/55 dark:text-white/55 truncate">{r.niche}</div>
                  )}
                </div>
              </div>

              {/* Cadence cell */}
              <div className="flex items-center gap-2 text-[12px]">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold tabular-nums ${t.chip}`}>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${t.dot}`}
                    style={{
                      animation: overdue ? 'fum-pulse 1.4s ease-in-out infinite' : undefined,
                    }}
                  />
                  {r.daysAgo}d ago · {r.cadence}
                </span>
              </div>

              {/* Reset action */}
              <button
                type="button"
                aria-label={`Mark ${r.name} as followed up`}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#0F1733]/12 dark:border-white/15 text-[#0F1733]/55 dark:text-white/55 hover:border-[#E85D2F]/50 hover:text-[#E85D2F] transition-colors"
                tabIndex={-1}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="5 12 10 17 19 7" />
                </svg>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Footer — small caption */}
      <div className="px-4 py-2.5 border-t border-[#0F1733]/8 dark:border-white/8 text-[10px] uppercase tracking-[0.18em] font-mono text-[#0F1733]/45 dark:text-white/45 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#E85D2F] animate-pulse" />
        Click to reset cadence
      </div>

      <style>{`
        @keyframes fum-row-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fum-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(1.4); }
        }
      `}</style>
    </div>
  )
}
