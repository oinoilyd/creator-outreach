'use client'

/**
 * CalendarPreviewClient — sandbox for 5 calendar designs (round 2).
 *
 * Round 1 (deleted) had: month grid / agenda / count-heatmap / bento /
 * kanban. Dylan wanted these gone and 5 entirely new directions
 * focused on different features + shapes. This file has those.
 *
 * The five designs:
 *   A — Week strip + expanded day detail
 *   B — Gantt timeline (horizontal bars across days)
 *   C — Pipeline-$$ heatmap (density × deal value)
 *   D — Two-pane mini-cal + always-visible agenda
 *   E — Card stack triage (one card at a time, next/skip)
 *
 * Mock data shared across all 5. Pick a winner, ping me, I'll wire
 * the chosen design into the production Follow-ups tab.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'

// ── Mock dataset ───────────────────────────────────────────────────────────

type MockEntry = {
  id: string
  channelName: string
  status: 'Open' | 'No Response' | 'Successful' | 'Rejected'
  followUpIso: string
  dateReachedOutIso: string | null
  medium: 'Email' | 'LinkedIn' | 'Instagram' | ''
  dealValue: string
  touchpoints: number
  notes?: string
}

function iso(off: number): string {
  const d = new Date()
  d.setDate(d.getDate() + off)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MOCK: MockEntry[] = [
  { id: '1',  channelName: 'Tina Huang',        status: 'Open',        followUpIso: iso(-5), dateReachedOutIso: iso(-10), medium: 'Email',     dealValue: '5000',  touchpoints: 2, notes: 'Replied positive — asked for deck' },
  { id: '2',  channelName: 'Ali Abdaal',        status: 'No Response', followUpIso: iso(-3), dateReachedOutIso: iso(-8),  medium: 'Email',     dealValue: '8000',  touchpoints: 1 },
  { id: '3',  channelName: 'Shelby Church',     status: 'Open',        followUpIso: iso(-1), dateReachedOutIso: iso(-7),  medium: 'LinkedIn',  dealValue: '3500',  touchpoints: 2, notes: 'Meeting Tuesday' },
  { id: '4',  channelName: 'Matt D\'Avella',    status: 'Open',        followUpIso: iso(0),  dateReachedOutIso: iso(-14), medium: 'Email',     dealValue: '12000', touchpoints: 3, notes: 'Negotiating rate' },
  { id: '5',  channelName: 'Marques Brownlee',  status: 'No Response', followUpIso: iso(0),  dateReachedOutIso: iso(-6),  medium: 'Email',     dealValue: '20000', touchpoints: 1 },
  { id: '6',  channelName: 'Casey Neistat',     status: 'Open',        followUpIso: iso(1),  dateReachedOutIso: iso(-9),  medium: 'Instagram', dealValue: '15000', touchpoints: 2 },
  { id: '7',  channelName: 'Emma Chamberlain',  status: 'Open',        followUpIso: iso(2),  dateReachedOutIso: iso(-5),  medium: 'Email',     dealValue: '7500',  touchpoints: 1 },
  { id: '8',  channelName: 'Pat Flynn',         status: 'No Response', followUpIso: iso(3),  dateReachedOutIso: iso(-4),  medium: 'Email',     dealValue: '4000',  touchpoints: 1, notes: 'Cold email — no traction' },
  { id: '9',  channelName: 'Thomas Frank',      status: 'Open',        followUpIso: iso(4),  dateReachedOutIso: iso(-3),  medium: 'LinkedIn',  dealValue: '6500',  touchpoints: 1 },
  { id: '10', channelName: 'Andrew Huberman',   status: 'Open',        followUpIso: iso(6),  dateReachedOutIso: iso(-2),  medium: 'Email',     dealValue: '30000', touchpoints: 1, notes: 'Long shot, big upside' },
  { id: '11', channelName: 'Lex Fridman',       status: 'Open',        followUpIso: iso(8),  dateReachedOutIso: iso(-2),  medium: 'Email',     dealValue: '25000', touchpoints: 1 },
  { id: '12', channelName: 'Naval Ravikant',    status: 'No Response', followUpIso: iso(10), dateReachedOutIso: iso(-1),  medium: 'Email',     dealValue: '40000', touchpoints: 1 },
  { id: '13', channelName: 'Tim Ferriss',       status: 'Open',        followUpIso: iso(14), dateReachedOutIso: iso(0),   medium: 'Email',     dealValue: '50000', touchpoints: 0 },
  { id: '14', channelName: 'Justin Welsh',      status: 'Open',        followUpIso: iso(21), dateReachedOutIso: null,     medium: '',          dealValue: '0',     touchpoints: 0 },
  { id: '15', channelName: 'Stephanie Pearson', status: 'No Response', followUpIso: iso(-35),dateReachedOutIso: iso(-35), medium: 'Email',     dealValue: '2500',  touchpoints: 2, notes: 'Ghosted — 35d no reply' },
]

// ── Shared helpers ─────────────────────────────────────────────────────────

function parseIso(s: string): Date | null {
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
function daysFromNow(s: string): number {
  const d = parseIso(s); if (!d) return 0
  const t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - t.getTime()) / 86_400_000)
}
function daysAgo(s: string | null): number | null {
  if (!s) return null
  const d = parseIso(s); if (!d) return null
  const t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0)
  return Math.round((t.getTime() - d.getTime()) / 86_400_000)
}
function priColor(e: MockEntry): { dot: string; tint: string; text: string } {
  const ghosted = e.status === 'No Response' && daysAgo(e.dateReachedOutIso) !== null && daysAgo(e.dateReachedOutIso)! >= 30
  if (ghosted) return { dot: 'bg-purple-500', tint: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-700 dark:text-purple-300' }
  const diff = daysFromNow(e.followUpIso)
  if (diff <= 0)  return { dot: 'bg-red-500',    tint: 'bg-red-500/10 border-red-500/40',    text: 'text-red-700 dark:text-red-300' }
  if (diff <= 7)  return { dot: 'bg-amber-500',  tint: 'bg-amber-500/10 border-amber-500/40', text: 'text-amber-700 dark:text-yellow-300' }
  return            { dot: 'bg-blue-500',   tint: 'bg-blue-500/10 border-blue-500/30',   text: 'text-blue-700 dark:text-blue-300' }
}
function moneyShort(s: string): string {
  const n = parseFloat(s); if (!n) return ''
  if (n >= 10000) return `$${(n / 1000).toFixed(0)}k`
  return `$${n.toLocaleString()}`
}
function fmtFollow(e: MockEntry): string {
  const ghosted = e.status === 'No Response' && daysAgo(e.dateReachedOutIso) !== null && daysAgo(e.dateReachedOutIso)! >= 30
  if (ghosted) return 'Ghosted'
  const d = daysFromNow(e.followUpIso)
  if (d < 0) return `Overdue ${Math.abs(d)}d`
  if (d === 0) return 'Today'
  return `+${d}d`
}

// ── A — Week strip + day detail ───────────────────────────────────────────

function DesignA() {
  const [weekOffset, setWeekOffset] = useState(0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay() + weekOffset * 7)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday); d.setDate(sunday.getDate() + i)
    return d
  })
  const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [selIso, setSelIso] = useState<string>(toIso(today))

  const selEntries = MOCK.filter(e => e.followUpIso === selIso)

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(o => o - 1)} className="w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-purple-500/40 transition-colors">‹</button>
          <span className="text-sm font-semibold tabular-nums w-44 text-center">
            {sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — {weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <button onClick={() => setWeekOffset(o => o + 1)} className="w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-purple-500/40 transition-colors">›</button>
          {weekOffset !== 0 && (
            <button onClick={() => { setWeekOffset(0); setSelIso(toIso(today)) }} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
              Back to today
            </button>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {MOCK.filter(e => {
            const d = parseIso(e.followUpIso); if (!d) return false
            return d.getTime() >= sunday.getTime() && d.getTime() < sunday.getTime() + 7 * 86_400_000
          }).length} follow-ups this week
        </span>
      </div>

      {/* Day strip */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(d => {
          const dIso = toIso(d)
          const dayEntries = MOCK.filter(e => e.followUpIso === dIso)
          const isToday = dIso === toIso(today)
          const isSel = dIso === selIso
          return (
            <button
              key={dIso}
              onClick={() => setSelIso(dIso)}
              className={`relative aspect-[3/4] rounded-xl border-2 p-3 text-left transition-all flex flex-col ${
                isSel ? 'border-purple-500 bg-purple-500/10 shadow-lg' :
                isToday ? 'border-purple-500/40 bg-purple-500/5' :
                'border-border bg-card/40 hover:border-border/80'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {d.toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
              <div className={`text-2xl font-bold tabular-nums mt-0.5 ${isToday ? 'text-purple-500' : 'text-foreground'}`}>
                {d.getDate()}
              </div>
              {dayEntries.length > 0 && (
                <div className="mt-auto flex flex-col gap-0.5">
                  {dayEntries.slice(0, 3).map(e => (
                    <div key={e.id} className="flex items-center gap-1 text-[10px] truncate">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priColor(e).dot}`} />
                      <span className="truncate text-foreground/80">{e.channelName.split(' ')[0]}</span>
                    </div>
                  ))}
                  {dayEntries.length > 3 && (
                    <div className="text-[9px] text-muted-foreground">+ {dayEntries.length - 3} more</div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day expanded */}
      <section className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
        <h3 className="text-sm font-semibold mb-3">
          {parseIso(selIso)?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          <span className="ml-2 text-muted-foreground font-normal">· {selEntries.length} follow-up{selEntries.length === 1 ? '' : 's'}</span>
        </h3>
        {selEntries.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">Nothing scheduled — quiet day.</div>
        ) : (
          <ul className="space-y-2">
            {selEntries.map(e => {
              const p = priColor(e)
              return (
                <li key={e.id} className={`rounded-lg border ${p.tint} p-3 flex items-center gap-3 flex-wrap`}>
                  <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                  <span className="text-sm font-medium flex-1 truncate">{e.channelName}</span>
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${p.text}`}>{fmtFollow(e)}</span>
                  {parseFloat(e.dealValue) > 0 && <span className="text-sm font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">{moneyShort(e.dealValue)}</span>}
                  {e.medium && <span className="text-[10px] text-muted-foreground">via {e.medium}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── B — Gantt timeline (horizontal bars across days) ──────────────────────

function DesignB() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const DAYS = 21 // 3-week visible window
  const startOff = -3
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + startOff + i)
    return d
  })

  // Sort entries by follow-up date for top-to-bottom timeline.
  const sorted = MOCK
    .filter(e => {
      const dn = daysFromNow(e.followUpIso)
      return dn >= startOff && dn < startOff + DAYS
    })
    .sort((a, b) => daysFromNow(a.followUpIso) - daysFromNow(b.followUpIso))

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">3-week Gantt — each row is a lead, bar position = follow-up date. Sent-date marker on the left for context. Drag bars to reschedule (mockup).</div>
      {/* Day headers */}
      <div className="grid gap-px text-center" style={{ gridTemplateColumns: `220px repeat(${DAYS}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d, i) => {
          const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth()
          return (
            <div key={i} className={`text-[10px] py-1 ${isToday ? 'font-bold text-purple-500' : 'text-muted-foreground'}`}>
              <div>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</div>
              <div className="tabular-nums">{d.getDate()}</div>
            </div>
          )
        })}
      </div>
      {/* Rows */}
      <div className="space-y-1">
        {sorted.map(e => {
          const fuOff = daysFromNow(e.followUpIso) - startOff
          const sentOff = e.dateReachedOutIso
            ? daysFromNow(e.dateReachedOutIso) - startOff
            : null
          // Bar span — from sentOff (if in window) to fuOff
          const barStart = sentOff !== null && sentOff >= 0 ? sentOff : fuOff
          const barEnd = fuOff
          const p = priColor(e)
          return (
            <div
              key={e.id}
              className="grid gap-px items-center"
              style={{ gridTemplateColumns: `220px repeat(${DAYS}, minmax(0, 1fr))` }}
            >
              <div className="pr-3 flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.dot}`} />
                <span className="text-xs font-medium truncate">{e.channelName}</span>
                {parseFloat(e.dealValue) > 0 && <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 ml-auto shrink-0">{moneyShort(e.dealValue)}</span>}
              </div>
              {/* Day cells with bar overlay */}
              {days.map((_, i) => {
                const inBar = i >= barStart && i <= barEnd
                const isFu = i === barEnd
                const isSent = i === sentOff
                return (
                  <div key={i} className="relative h-6 border-r border-border/30 last:border-r-0">
                    {inBar && (
                      <div
                        className={`absolute inset-y-1 ${i === barStart ? 'left-0.5 rounded-l' : 'left-0'} ${i === barEnd ? 'right-0.5 rounded-r' : 'right-0'} ${p.dot} opacity-30`}
                      />
                    )}
                    {isSent && (
                      <div className="absolute inset-y-1 left-1 right-1 rounded-sm border border-dashed border-muted-foreground/50 flex items-center justify-center">
                        <span className="text-[8px] text-muted-foreground">Sent</span>
                      </div>
                    )}
                    {isFu && (
                      <div className={`absolute inset-y-0.5 left-0.5 right-0.5 rounded ${p.dot} flex items-center justify-center`}>
                        <span className="text-[9px] font-bold text-white">FU</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── C — Pipeline-$$ heatmap (density × deal value) ────────────────────────

function DesignC() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const start = new Date(monthStart); start.setDate(monthStart.getDate() - monthStart.getDay())
  const lastOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const end = new Date(lastOfMonth); end.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()))
  const grid: Date[] = []
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) grid.push(new Date(d))
  const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // Per-day pipeline value (sum of dealValue for entries with that follow-up date)
  const byDay = new Map<string, { count: number; value: number; entries: MockEntry[] }>()
  for (const e of MOCK) {
    const k = e.followUpIso
    const v = byDay.get(k) ?? { count: 0, value: 0, entries: [] }
    v.count++
    v.value += parseFloat(e.dealValue) || 0
    v.entries.push(e)
    byDay.set(k, v)
  }
  const maxValue = Math.max(1, ...Array.from(byDay.values()).map(v => v.value))

  // Top-5 $$ days for sidebar
  const topDays = Array.from(byDay.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 5)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <div>
        <div className="text-[11px] text-muted-foreground mb-3">Color intensity = total deal $ scheduled to follow up on that day. Hot days = focus your time there.</div>
        <h3 className="text-base font-semibold mb-2">{monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map(d => {
            const dIso = toIso(d)
            const v = byDay.get(dIso)
            const inMonth = d.getMonth() === monthStart.getMonth()
            const isToday = toIso(today) === dIso
            const intensity = v ? Math.min(1, v.value / maxValue) : 0
            // Green → red gradient by intensity
            const bgStyle = !v ? {} : {
              backgroundColor: `oklch(${100 - intensity * 35}% ${0.15 + intensity * 0.18} ${30 + (1 - intensity) * 120})`,
            }
            return (
              <div
                key={dIso}
                title={v ? `${d.toDateString()} — ${v.count} lead${v.count === 1 ? '' : 's'}, ${moneyShort(String(v.value))} pipeline` : ''}
                className={`relative aspect-square rounded-md border p-1 flex flex-col justify-between ${
                  isToday ? 'border-purple-500' : 'border-border/40'
                } ${!inMonth ? 'opacity-30' : ''} transition-transform hover:scale-105`}
                style={bgStyle}
              >
                <span className={`text-[10px] tabular-nums ${v ? 'text-white font-bold' : 'text-muted-foreground'}`}>{d.getDate()}</span>
                {v && (
                  <span className="text-[9px] font-bold text-white tabular-nums leading-none">{moneyShort(String(v.value))}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <aside className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Top $$ days</h3>
        <ul className="space-y-1.5">
          {topDays.map(([dIso, v]) => (
            <li key={dIso} className="rounded-lg border border-border bg-card/40 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{parseIso(dIso)?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">{moneyShort(String(v.value))}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {v.entries.map(e => e.channelName.split(' ')[0]).join(' · ')}
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

// ── D — Two-pane split (mini-cal + always-visible agenda) ─────────────────

function DesignD() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [selIso, setSelIso] = useState(toIso(today))

  const start = new Date(monthStart); start.setDate(monthStart.getDate() - monthStart.getDay())
  const lastOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const end = new Date(lastOfMonth); end.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()))
  const grid: Date[] = []
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) grid.push(new Date(d))

  const byDay = new Map<string, MockEntry[]>()
  for (const e of MOCK) {
    const list = byDay.get(e.followUpIso) ?? []
    list.push(e)
    byDay.set(e.followUpIso, list)
  }

  const selDay = parseIso(selIso)
  const selEntries = byDay.get(selIso) ?? []

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5">
      {/* LEFT: Mini calendar */}
      <aside>
        <h3 className="text-base font-semibold mb-2">{monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-[9px] text-center text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {grid.map(d => {
            const dIso = toIso(d)
            const dayEntries = byDay.get(dIso) ?? []
            const inMonth = d.getMonth() === monthStart.getMonth()
            const isToday = toIso(today) === dIso
            const isSel = selIso === dIso
            return (
              <button
                key={dIso}
                onClick={() => setSelIso(dIso)}
                className={`relative aspect-square text-[10px] flex items-center justify-center rounded-md transition-colors ${
                  isSel ? 'bg-purple-500 text-white font-bold' :
                  isToday ? 'border border-purple-500 text-purple-500 font-semibold' :
                  inMonth ? 'hover:bg-muted/60 text-foreground' :
                  'text-muted-foreground/40'
                }`}
              >
                <span>{d.getDate()}</span>
                {dayEntries.length > 0 && !isSel && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-500" />
                )}
              </button>
            )
          })}
        </div>
        {/* Quick navigators */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => setSelIso(toIso(today))} className="text-[11px] py-1.5 rounded border border-border hover:border-purple-500/40 transition-colors">Today</button>
          <button onClick={() => { const t = new Date(today); t.setDate(today.getDate() + 1); setSelIso(toIso(t)) }} className="text-[11px] py-1.5 rounded border border-border hover:border-purple-500/40 transition-colors">Tomorrow</button>
        </div>
      </aside>

      {/* RIGHT: Always-visible agenda for selected day */}
      <section>
        <header className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-lg font-semibold">
            {selDay?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <span className="text-[11px] text-muted-foreground">{selEntries.length} follow-up{selEntries.length === 1 ? '' : 's'}</span>
        </header>
        {selEntries.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl py-12 px-6 text-center text-sm text-muted-foreground italic">
            Nothing scheduled for this day.
          </div>
        ) : (
          <ul className="space-y-2">
            {selEntries.map(e => {
              const p = priColor(e)
              const lastTouch = e.dateReachedOutIso ? `${daysAgo(e.dateReachedOutIso)}d ago` : null
              return (
                <li key={e.id} className={`rounded-xl border ${p.tint} p-4`}>
                  <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold">{e.channelName}</span>
                        <span className={`text-[10px] uppercase tracking-wider font-bold ${p.text}`}>{fmtFollow(e)}</span>
                      </div>
                      {lastTouch && <div className="text-[11px] text-muted-foreground mt-0.5">{e.touchpoints >= 1 ? `Last followed up ${lastTouch}` : `Reached ${lastTouch}`}{e.medium && ` · via ${e.medium}`}</div>}
                      {e.notes && <div className="text-[11px] text-foreground/70 mt-1">{e.notes}</div>}
                    </div>
                    {parseFloat(e.dealValue) > 0 && (
                      <span className="text-base font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">{moneyShort(e.dealValue)}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── E — Card stack triage (one card at a time, next/skip) ────────────────

function DesignE() {
  // Sort by priority — overdue first, then by follow-up date asc.
  const sorted = useMemo(() => {
    return [...MOCK].sort((a, b) => daysFromNow(a.followUpIso) - daysFromNow(b.followUpIso))
  }, [])
  const [idx, setIdx] = useState(0)
  const cur = sorted[idx]
  const total = sorted.length

  if (!cur) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-lg font-semibold">All caught up</h3>
        <p className="text-sm text-muted-foreground mt-1">No more follow-ups in the queue.</p>
      </div>
    )
  }

  const p = priColor(cur)
  const next = sorted[idx + 1]
  const after = sorted[idx + 2]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{idx + 1} of {total}</span>
        <span>{total - idx - 1} remaining</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-purple-500 transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>

      {/* Stack of cards — top is the active triage target */}
      <div className="relative h-[320px]">
        {/* After-next (3rd) */}
        {after && (
          <div className={`absolute inset-x-4 top-8 h-full rounded-2xl border-2 ${priColor(after).tint} opacity-30 scale-95 -z-10`} />
        )}
        {/* Next */}
        {next && (
          <div className={`absolute inset-x-2 top-4 h-full rounded-2xl border-2 ${priColor(next).tint} opacity-60 scale-[0.97]`}>
            <div className="p-4 pointer-events-none">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Up next</div>
              <div className="text-base font-medium truncate">{next.channelName}</div>
              <div className="text-[11px] text-muted-foreground">{fmtFollow(next)}{next.medium && ` · ${next.medium}`}</div>
            </div>
          </div>
        )}
        {/* Active */}
        <div className={`absolute inset-x-0 top-0 rounded-2xl border-2 ${p.tint} bg-card shadow-xl p-6`}>
          <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Triage</div>
              <h2 className="text-2xl font-semibold tracking-[-0.01em] mb-1">{cur.channelName}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] uppercase tracking-wider font-bold ${p.text}`}>{fmtFollow(cur)}</span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] text-muted-foreground">{cur.status}</span>
                {cur.medium && <><span className="text-[10px] text-muted-foreground">·</span><span className="text-[10px] text-muted-foreground">{cur.medium}</span></>}
              </div>
            </div>
            {parseFloat(cur.dealValue) > 0 && (
              <span className="text-xl font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">{moneyShort(cur.dealValue)}</span>
            )}
          </div>
          {cur.dateReachedOutIso && (
            <div className="text-[11px] text-muted-foreground mb-3">
              {cur.touchpoints >= 1 ? `Last followed up ${daysAgo(cur.dateReachedOutIso)}d ago` : `Reached ${daysAgo(cur.dateReachedOutIso)}d ago`}
            </div>
          )}
          {cur.notes && (
            <div className="text-sm text-foreground/80 mb-4 italic">&ldquo;{cur.notes}&rdquo;</div>
          )}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-border/40">
            <button className="text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">📧 Send follow-up</button>
            <button className="text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:border-foreground/60 transition-colors">Snooze 3d</button>
            <button className="text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:border-foreground/60 transition-colors">Mark ghosted</button>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
          disabled={idx >= total - 1}
          className="text-sm px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors disabled:opacity-40"
        >
          Skip to next →
        </button>
      </div>
    </div>
  )
}

// ── Toggle + page ─────────────────────────────────────────────────────────

const DESIGNS = [
  { key: 'A', label: 'A — Week strip',         sub: 'Click a day from the week strip to expand its leads below' },
  { key: 'B', label: 'B — Gantt timeline',     sub: 'Each lead is a horizontal bar from sent-date to follow-up date' },
  { key: 'C', label: 'C — Pipeline-$$ heatmap', sub: 'Color intensity by total $ value scheduled per day — find hot $ days' },
  { key: 'D', label: 'D — Mini-cal + agenda',  sub: 'Two-pane: small calendar left, always-visible agenda right' },
  { key: 'E', label: 'E — Card-stack triage',  sub: 'One lead at a time, swipe through — focused execution mode' },
] as const

export default function CalendarPreviewClient() {
  const [active, setActive] = useState<typeof DESIGNS[number]['key']>('A')

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div>
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">← Back to app</Link>
            <h1 className="text-2xl font-bold">Calendar design previews — round 2</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              5 fresh directions, each with different features &amp; shapes. The previous round (month grid / agenda / count-heatmap / bento / kanban) is gone. Pick the one that feels right, ping me, I&apos;ll wire it into the production Follow-ups tab.
            </p>
          </div>
        </div>

        {/* Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-6 pb-4 border-b border-border">
          {DESIGNS.map(d => {
            const isActive = active === d.key
            return (
              <button
                key={d.key}
                onClick={() => setActive(d.key)}
                className={`text-left rounded-lg px-3 py-2.5 border transition-colors ${
                  isActive
                    ? 'bg-purple-500/15 border-purple-500/50 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                }`}
              >
                <div className="text-sm font-semibold">{d.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{d.sub}</div>
              </button>
            )
          })}
        </div>

        {/* Active design */}
        <div className="rounded-2xl border border-border bg-background/60 p-4 md:p-6 min-h-[400px]">
          {active === 'A' && <DesignA />}
          {active === 'B' && <DesignB />}
          {active === 'C' && <DesignC />}
          {active === 'D' && <DesignD />}
          {active === 'E' && <DesignE />}
        </div>

        <p className="text-[11px] text-muted-foreground mt-6">
          15-entry mock dataset — overdue, due today, due this week, future, and a 35-day ghosted row.
        </p>
      </div>
    </main>
  )
}
