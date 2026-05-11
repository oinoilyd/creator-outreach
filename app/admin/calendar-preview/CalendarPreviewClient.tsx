'use client'

/**
 * CalendarPreviewClient — toggle between 4 candidate calendar designs.
 * Mock data, no DB round-trip; this is a sandbox for Dylan to pick a
 * direction before we ship one into the production Follow-ups tab.
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'

// ── Mock data ──────────────────────────────────────────────────────────────

type MockEntry = {
  id: string
  channelName: string
  status: 'Open' | 'No Response' | 'Successful' | 'Rejected'
  followUpIso: string // yyyy-mm-dd
  dateReachedOutIso: string | null
  medium: 'Email' | 'LinkedIn' | 'Instagram' | ''
  dealValue: string
  touchpoints: number
  notes?: string
}

function iso(daysFromToday: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MOCK: MockEntry[] = [
  { id: '1',  channelName: 'Tina Huang',         status: 'Open',        followUpIso: iso(-5), dateReachedOutIso: iso(-10), medium: 'Email',    dealValue: '5000', touchpoints: 2, notes: 'Replied positive, asked for deck' },
  { id: '2',  channelName: 'Ali Abdaal',         status: 'No Response', followUpIso: iso(-3), dateReachedOutIso: iso(-8),  medium: 'Email',    dealValue: '8000', touchpoints: 1 },
  { id: '3',  channelName: 'Shelby Church',      status: 'Open',        followUpIso: iso(-1), dateReachedOutIso: iso(-7),  medium: 'LinkedIn', dealValue: '3500', touchpoints: 2, notes: 'Meeting Tuesday' },
  { id: '4',  channelName: 'Matt D\'Avella',     status: 'Open',        followUpIso: iso(0),  dateReachedOutIso: iso(-14), medium: 'Email',    dealValue: '12000', touchpoints: 3, notes: 'Negotiating rate' },
  { id: '5',  channelName: 'Marques Brownlee',   status: 'No Response', followUpIso: iso(0),  dateReachedOutIso: iso(-6),  medium: 'Email',    dealValue: '20000', touchpoints: 1 },
  { id: '6',  channelName: 'Casey Neistat',      status: 'Open',        followUpIso: iso(1),  dateReachedOutIso: iso(-9),  medium: 'Instagram', dealValue: '15000', touchpoints: 2 },
  { id: '7',  channelName: 'Emma Chamberlain',   status: 'Open',        followUpIso: iso(2),  dateReachedOutIso: iso(-5),  medium: 'Email',    dealValue: '7500', touchpoints: 1 },
  { id: '8',  channelName: 'Pat Flynn',          status: 'No Response', followUpIso: iso(3),  dateReachedOutIso: iso(-4),  medium: 'Email',    dealValue: '4000', touchpoints: 1, notes: 'Cold email, no traction yet' },
  { id: '9',  channelName: 'Thomas Frank',       status: 'Open',        followUpIso: iso(4),  dateReachedOutIso: iso(-3),  medium: 'LinkedIn', dealValue: '6500', touchpoints: 1 },
  { id: '10', channelName: 'Andrew Huberman',    status: 'Open',        followUpIso: iso(6),  dateReachedOutIso: iso(-2),  medium: 'Email',    dealValue: '30000', touchpoints: 1, notes: 'Long shot but big upside' },
  { id: '11', channelName: 'Lex Fridman',        status: 'Open',        followUpIso: iso(8),  dateReachedOutIso: iso(-2),  medium: 'Email',    dealValue: '25000', touchpoints: 1 },
  { id: '12', channelName: 'Naval Ravikant',     status: 'No Response', followUpIso: iso(10), dateReachedOutIso: iso(-1),  medium: 'Email',    dealValue: '40000', touchpoints: 1 },
  { id: '13', channelName: 'Tim Ferriss',        status: 'Open',        followUpIso: iso(14), dateReachedOutIso: iso(0),   medium: 'Email',    dealValue: '50000', touchpoints: 0 },
  { id: '14', channelName: 'Justin Welsh',       status: 'Open',        followUpIso: iso(21), dateReachedOutIso: null,     medium: '',         dealValue: '0',    touchpoints: 0 },
  { id: '15', channelName: 'Stephanie Pearson',  status: 'No Response', followUpIso: iso(-35), dateReachedOutIso: iso(-35),medium: 'Email',    dealValue: '2500', touchpoints: 2, notes: 'Ghosted — 35 days no reply' },
]

// ── Shared helpers used by multiple designs ───────────────────────────────

function parseIso(s: string): Date | null {
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function daysFromNow(isoStr: string): number {
  const d = parseIso(isoStr)
  if (!d) return 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

function daysAgo(isoStr: string | null): number | null {
  if (!isoStr) return null
  const d = parseIso(isoStr)
  if (!d) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86_400_000)
}

function statePill(e: MockEntry): { label: string; tone: string } {
  const reached = daysAgo(e.dateReachedOutIso)
  const ghosted = e.status === 'No Response' && (reached === null || reached >= 30)
  if (ghosted) return { label: 'Ghosted', tone: 'border-purple-500/40 text-purple-700 dark:text-purple-300 bg-purple-500/10' }
  const diff = daysFromNow(e.followUpIso)
  if (diff < 0) return { label: `Overdue by ${Math.abs(diff)}d`, tone: 'border-red-500/40 text-red-700 dark:text-red-300 bg-red-500/10' }
  if (diff === 0) return { label: 'Due today', tone: 'border-red-500/40 text-red-700 dark:text-red-300 bg-red-500/10' }
  if (diff <= 7) return { label: `Follow up in ${diff}d`, tone: 'border-amber-500/40 text-amber-700 dark:text-yellow-300 bg-amber-500/10' }
  return { label: `Follow up in ${diff}d`, tone: 'border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-500/10' }
}

function statusBadge(status: MockEntry['status']) {
  const tone =
    status === 'Open' ? 'border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-500/10'
    : status === 'No Response' ? 'border-purple-500/40 text-purple-700 dark:text-purple-400 bg-purple-500/10'
    : status === 'Successful' ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
    : 'border-red-500/40 text-red-700 dark:text-red-400 bg-red-500/10'
  return (
    <span className={`text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border ${tone}`}>
      {status}
    </span>
  )
}

// ── Design A: Current (baseline month grid) ──────────────────────────────

function DesignA() {
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monthFirst = new Date(today.getFullYear(), today.getMonth(), 1)

  const byDate = useMemo(() => {
    const m = new Map<string, MockEntry[]>()
    for (const e of MOCK) {
      const list = m.get(e.followUpIso) ?? []
      list.push(e)
      m.set(e.followUpIso, list)
    }
    return m
  }, [])

  const gridDays = useMemo(() => {
    const start = new Date(monthFirst)
    start.setDate(monthFirst.getDate() - monthFirst.getDay())
    const lastOfMonth = new Date(monthFirst.getFullYear(), monthFirst.getMonth() + 1, 0)
    const end = new Date(lastOfMonth)
    end.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()))
    const out: Date[] = []
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
      out.push(new Date(d))
    }
    return out
  }, [monthFirst])

  const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayIso = toIso(today)
  const monthLabel = monthFirst.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  function dotClass(e: MockEntry): string {
    const diff = daysFromNow(e.followUpIso)
    if (e.status === 'No Response' && daysAgo(e.dateReachedOutIso) !== null && daysAgo(e.dateReachedOutIso)! >= 30) return 'bg-purple-500'
    if (diff <= 0) return 'bg-red-500'
    if (diff <= 7) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{monthLabel}</h2>
        <div className="text-[11px] text-muted-foreground">{MOCK.filter(e => parseIso(e.followUpIso)?.getMonth() === monthFirst.getMonth()).length} follow-ups this month</div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground text-center py-1.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {gridDays.map(d => {
          const dIso = toIso(d)
          const dayEntries = byDate.get(dIso) ?? []
          const inMonth = d.getMonth() === monthFirst.getMonth()
          const isToday = dIso === todayIso
          const isSelected = dIso === selectedIso
          return (
            <button
              key={dIso}
              onClick={() => setSelectedIso(prev => prev === dIso ? null : dIso)}
              className={`relative min-h-[72px] rounded-md border text-left p-1.5 transition-colors flex flex-col ${
                isSelected ? 'border-purple-500 bg-purple-500/10' :
                isToday ? 'border-purple-500/50 bg-purple-500/5' :
                inMonth ? 'border-border bg-card/40 hover:bg-card/80' :
                'border-border/40 bg-transparent text-muted-foreground/50'
              }`}
            >
              <span className={`text-[11px] font-mono ${isToday ? 'text-purple-500 font-bold' : ''}`}>{d.getDate()}</span>
              {dayEntries.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {dayEntries.slice(0, 3).map(e => (
                    <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${dotClass(e)}`} aria-hidden />
                  ))}
                  {dayEntries.length > 3 && <span className="text-[9px] font-bold text-muted-foreground">+{dayEntries.length - 3}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
      {selectedIso && (
        <SelectedDaySheet entries={byDate.get(selectedIso) ?? []} dateIso={selectedIso} onClose={() => setSelectedIso(null)} />
      )}
    </div>
  )
}

// Shared day sheet used by Design A (current behavior)
function SelectedDaySheet({ entries, dateIso, onClose }: { entries: MockEntry[]; dateIso: string; onClose: () => void }) {
  const dateLabel = parseIso(dateIso)?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) ?? dateIso
  return (
    <section className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{dateLabel} · {entries.length} follow-up{entries.length === 1 ? '' : 's'}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
      </header>
      {entries.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">No follow-ups scheduled.</div>
      ) : (
        <ul className="space-y-2">
          {entries.map(e => {
            const pill = statePill(e)
            return (
              <li key={e.id} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{e.channelName}</span>
                  {statusBadge(e.status)}
                  <span className={`text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border ${pill.tone}`}>{pill.label}</span>
                </div>
                {e.dateReachedOutIso && <div className="text-[11px] text-muted-foreground mt-1">Sent {daysAgo(e.dateReachedOutIso)}d ago · via {e.medium}</div>}
                {e.notes && <div className="text-[11px] text-muted-foreground mt-1">{e.notes}</div>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ── Design B: Agenda timeline (vertical day-by-day) ──────────────────────

function DesignB() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days: Array<{ iso: string; label: string; entries: MockEntry[]; isToday: boolean; isOverdue: boolean }> = []
  // Overdue group first
  const overdue = MOCK.filter(e => {
    const d = parseIso(e.followUpIso); if (!d) return false
    d.setHours(0, 0, 0, 0)
    return d.getTime() < today.getTime()
  }).sort((a, b) => a.followUpIso.localeCompare(b.followUpIso))
  if (overdue.length > 0) {
    days.push({ iso: 'overdue', label: `Overdue (${overdue.length})`, entries: overdue, isToday: false, isOverdue: true })
  }
  // Next 30 days
  for (let i = 0; i < 30; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i)
    const dIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const entries = MOCK.filter(e => e.followUpIso === dIso)
    if (entries.length === 0 && i > 14) continue // skip empty days past 2 weeks
    days.push({
      iso: dIso,
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      entries,
      isToday: i === 0,
      isOverdue: false,
    })
  }
  return (
    <div className="space-y-3">
      {days.map(day => (
        <section key={day.iso} className={`rounded-xl border ${day.isToday ? 'border-purple-500/50 bg-purple-500/5' : day.isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-card/40'} p-3`}>
          <header className="flex items-center justify-between mb-2">
            <h3 className={`text-sm font-semibold ${day.isToday ? 'text-purple-700 dark:text-purple-300' : day.isOverdue ? 'text-red-700 dark:text-red-300' : 'text-foreground'}`}>
              {day.label}
            </h3>
            {day.entries.length > 0 && <span className="text-[10px] text-muted-foreground tabular-nums">{day.entries.length}</span>}
          </header>
          {day.entries.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic">Nothing scheduled.</div>
          ) : (
            <ul className="space-y-1.5">
              {day.entries.map(e => {
                const pill = statePill(e)
                return (
                  <li key={e.id} className="flex items-center gap-2 flex-wrap py-1.5 px-2 rounded hover:bg-card transition-colors">
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{e.channelName}</span>
                    {statusBadge(e.status)}
                    <span className={`text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border ${pill.tone}`}>{pill.label}</span>
                    {parseFloat(e.dealValue) > 0 && <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">${parseFloat(e.dealValue).toLocaleString()}</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

// ── Design C: Heatmap (3-month density grid) ─────────────────────────────

function DesignC() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const months = [-1, 0, 1].map(off => new Date(today.getFullYear(), today.getMonth() + off, 1))

  function buildMonthGrid(monthStart: Date) {
    const start = new Date(monthStart)
    start.setDate(monthStart.getDate() - monthStart.getDay())
    const lastOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    const end = new Date(lastOfMonth)
    end.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()))
    const out: Array<{ d: Date; inMonth: boolean; count: number; pri: 'red' | 'yellow' | 'blue' | 'purple' | 'none' }> = []
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
      const dIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const entries = MOCK.filter(e => e.followUpIso === dIso)
      // Highest-priority entry wins the cell color
      let pri: 'red' | 'yellow' | 'blue' | 'purple' | 'none' = 'none'
      for (const e of entries) {
        const diff = daysFromNow(e.followUpIso)
        const ghosted = e.status === 'No Response' && daysAgo(e.dateReachedOutIso) !== null && daysAgo(e.dateReachedOutIso)! >= 30
        const tier = ghosted ? 'purple' : diff <= 0 ? 'red' : diff <= 7 ? 'yellow' : 'blue'
        const order = { red: 4, yellow: 3, blue: 2, purple: 1, none: 0 }
        if (order[tier] > order[pri]) pri = tier
      }
      out.push({
        d: new Date(d),
        inMonth: d.getMonth() === monthStart.getMonth(),
        count: entries.length,
        pri,
      })
    }
    return out
  }

  function cellTone(p: 'red' | 'yellow' | 'blue' | 'purple' | 'none', count: number, inMonth: boolean): string {
    if (!inMonth) return 'bg-transparent border-transparent'
    if (count === 0) return 'bg-card/40 border-border/40'
    const intensity = Math.min(count, 4)
    const tones: Record<typeof p, string[]> = {
      red:    ['', 'bg-red-500/20',   'bg-red-500/40',   'bg-red-500/60',   'bg-red-500/90'],
      yellow: ['', 'bg-amber-500/20', 'bg-amber-500/40', 'bg-amber-500/60', 'bg-amber-500/90'],
      blue:   ['', 'bg-blue-500/20',  'bg-blue-500/40',  'bg-blue-500/60',  'bg-blue-500/90'],
      purple: ['', 'bg-purple-500/20','bg-purple-500/40','bg-purple-500/60','bg-purple-500/90'],
      none:   ['', '', '', '', ''],
    }
    return `${tones[p][intensity]} border-border/40`
  }

  return (
    <div className="space-y-4">
      <div className="text-[11px] text-muted-foreground">3-month density view — darker = more follow-ups stacked on that day. Color = highest priority bucket on that day.</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {months.map((m, idx) => {
          const grid = buildMonthGrid(m)
          return (
            <div key={idx} className="rounded-xl border border-border bg-card/20 p-3">
              <h3 className="text-xs font-semibold mb-2">{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="text-[9px] text-muted-foreground text-center">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {grid.map((cell, i) => (
                  <div
                    key={i}
                    title={cell.count > 0 ? `${cell.d.toDateString()} — ${cell.count} follow-up${cell.count === 1 ? '' : 's'}` : ''}
                    className={`aspect-square rounded-sm border ${cellTone(cell.pri, cell.count, cell.inMonth)} transition-transform hover:scale-110`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap pt-2 border-t border-border/40">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500/60" /> Overdue/today</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500/60" /> Due this week</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500/60" /> Future</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-purple-500/60" /> Ghosted</span>
      </div>
    </div>
  )
}

// ── Design D: Bento today-first editorial ───────────────────────────────

function DesignD() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const todayEntries = MOCK.filter(e => e.followUpIso === todayIso)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const tomIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  const tomorrowEntries = MOCK.filter(e => e.followUpIso === tomIso)
  const weekEntries = MOCK.filter(e => {
    const diff = daysFromNow(e.followUpIso)
    return diff >= 2 && diff <= 7
  }).sort((a, b) => daysFromNow(a.followUpIso) - daysFromNow(b.followUpIso))
  const laterEntries = MOCK.filter(e => daysFromNow(e.followUpIso) > 7).sort((a, b) => daysFromNow(a.followUpIso) - daysFromNow(b.followUpIso))
  const overdue = MOCK.filter(e => daysFromNow(e.followUpIso) < 0).sort((a, b) => daysFromNow(a.followUpIso) - daysFromNow(b.followUpIso))

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
      {/* TODAY — hero */}
      <section className="md:col-span-8 rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-500/10 to-blue-500/5 p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap">
          <h2 className="text-xl font-semibold tracking-[-0.01em]">Today
            <span className="ml-2 text-muted-foreground font-normal text-base">· {todayEntries.length} due</span>
          </h2>
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-purple-700 dark:text-purple-300">Focus</span>
        </div>
        {todayEntries.length === 0 ? (
          <div className="text-sm text-muted-foreground italic py-6 text-center">All caught up. ✓</div>
        ) : (
          <ul className="space-y-2">
            {todayEntries.map(e => {
              const pill = statePill(e)
              return (
                <li key={e.id} className="rounded-lg bg-card/60 p-3 flex items-center gap-3 flex-wrap">
                  <span className="text-base font-semibold flex-1 min-w-0 truncate">{e.channelName}</span>
                  {statusBadge(e.status)}
                  <span className={`text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border ${pill.tone}`}>{pill.label}</span>
                  {parseFloat(e.dealValue) > 0 && <span className="text-sm font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">${parseFloat(e.dealValue).toLocaleString()}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* OVERDUE — small alert card */}
      <section className="md:col-span-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
        <h3 className="text-xs uppercase tracking-[0.18em] font-bold text-red-700 dark:text-red-400 mb-3">Overdue</h3>
        {overdue.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">None — nice.</div>
        ) : (
          <ul className="space-y-1">
            {overdue.slice(0, 5).map(e => (
              <li key={e.id} className="text-xs flex justify-between gap-2">
                <span className="truncate text-foreground">{e.channelName}</span>
                <span className="text-red-700 dark:text-red-400 font-mono tabular-nums shrink-0">{Math.abs(daysFromNow(e.followUpIso))}d</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* TOMORROW + REST OF WEEK */}
      <section className="md:col-span-6 rounded-2xl border border-border bg-card/40 p-4">
        <h3 className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground mb-3">Tomorrow</h3>
        {tomorrowEntries.length === 0 ? (
          <div className="text-xs text-muted-foreground italic mb-3">Nothing scheduled.</div>
        ) : (
          <ul className="space-y-1.5 mb-4">
            {tomorrowEntries.map(e => (
              <li key={e.id} className="text-sm flex items-center gap-2">
                <span className="flex-1 truncate">{e.channelName}</span>
                {statusBadge(e.status)}
              </li>
            ))}
          </ul>
        )}
        <h3 className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground mb-2 mt-4">This week</h3>
        {weekEntries.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">Empty.</div>
        ) : (
          <ul className="space-y-1">
            {weekEntries.map(e => (
              <li key={e.id} className="text-xs flex justify-between gap-2">
                <span className="truncate flex-1">{e.channelName}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">+{daysFromNow(e.followUpIso)}d</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* LATER */}
      <section className="md:col-span-6 rounded-2xl border border-border/60 bg-card/20 p-4">
        <h3 className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground mb-3">Later</h3>
        {laterEntries.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">No leads scheduled past this week.</div>
        ) : (
          <ul className="space-y-1">
            {laterEntries.slice(0, 8).map(e => (
              <li key={e.id} className="text-xs flex justify-between gap-2 py-0.5">
                <span className="truncate flex-1 text-foreground/80">{e.channelName}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">+{daysFromNow(e.followUpIso)}d</span>
              </li>
            ))}
            {laterEntries.length > 8 && (
              <li className="text-[10px] text-muted-foreground italic pt-1">+ {laterEntries.length - 8} more</li>
            )}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Design E: Kanban buckets ────────────────────────────────────────────

function DesignE() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const buckets: Array<{ key: string; title: string; subtitle: string; accent: string; bg: string; entries: MockEntry[] }> = [
    {
      key: 'overdue',
      title: 'Overdue',
      subtitle: 'Past their date',
      accent: 'border-red-500/50',
      bg: 'bg-red-500/5',
      entries: MOCK.filter(e => daysFromNow(e.followUpIso) < 0).sort((a, b) => daysFromNow(a.followUpIso) - daysFromNow(b.followUpIso)),
    },
    {
      key: 'today',
      title: 'Today',
      subtitle: 'Due now',
      accent: 'border-purple-500/50',
      bg: 'bg-purple-500/5',
      entries: MOCK.filter(e => daysFromNow(e.followUpIso) === 0),
    },
    {
      key: 'week',
      title: 'This week',
      subtitle: 'Next 7 days',
      accent: 'border-amber-500/40',
      bg: 'bg-amber-500/5',
      entries: MOCK.filter(e => { const d = daysFromNow(e.followUpIso); return d >= 1 && d <= 7 }).sort((a, b) => daysFromNow(a.followUpIso) - daysFromNow(b.followUpIso)),
    },
    {
      key: 'later',
      title: 'Later',
      subtitle: '8+ days out',
      accent: 'border-blue-500/30',
      bg: 'bg-blue-500/5',
      entries: MOCK.filter(e => daysFromNow(e.followUpIso) > 7).sort((a, b) => daysFromNow(a.followUpIso) - daysFromNow(b.followUpIso)),
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {buckets.map(bucket => (
        <section key={bucket.key} className={`rounded-xl border-2 ${bucket.accent} ${bucket.bg} p-3 flex flex-col`}>
          <header className="mb-3 pb-2 border-b border-border/40">
            <h3 className="text-sm font-bold text-foreground flex items-center justify-between">
              {bucket.title}
              <span className="text-xs font-mono text-muted-foreground tabular-nums">{bucket.entries.length}</span>
            </h3>
            <div className="text-[10px] text-muted-foreground">{bucket.subtitle}</div>
          </header>
          {bucket.entries.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic py-3">Empty.</div>
          ) : (
            <ul className="space-y-2 flex-1">
              {bucket.entries.map(e => {
                const dn = daysFromNow(e.followUpIso)
                return (
                  <li key={e.id} className="rounded-lg bg-card border border-border p-2.5 cursor-grab hover:border-purple-500/40 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{e.channelName}</span>
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0 ml-2">
                        {dn < 0 ? `-${Math.abs(dn)}d` : dn === 0 ? 'now' : `+${dn}d`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {statusBadge(e.status)}
                      {parseFloat(e.dealValue) > 0 && (
                        <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                          ${(parseFloat(e.dealValue) / 1000).toFixed(0)}k
                        </span>
                      )}
                      {e.medium && <span className="text-[9px] text-muted-foreground">· {e.medium}</span>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────

const DESIGNS = [
  { key: 'A', label: 'A — Current month grid', subtitle: 'Baseline (what\'s live today)' },
  { key: 'B', label: 'B — Agenda timeline',    subtitle: 'Vertical day-by-day stack, info-dense' },
  { key: 'C', label: 'C — Heatmap (3 months)', subtitle: 'GitHub-style density across multiple months' },
  { key: 'D', label: 'D — Bento today-first',  subtitle: 'Hero "today" card + supporting tiles, editorial' },
  { key: 'E', label: 'E — Kanban buckets',     subtitle: 'Overdue / Today / Week / Later as columns' },
] as const

export default function CalendarPreviewClient() {
  const [active, setActive] = useState<typeof DESIGNS[number]['key']>('A')

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div>
            <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">← Admin home</Link>
            <h1 className="text-2xl font-bold">Calendar design previews</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
              Sandbox for 5 alternative follow-up calendar designs, populated with mock data. Click each tab to test. When you pick a winner, that design replaces <code className="font-mono text-foreground/80">components/FollowUpCalendar</code> in the production Follow-ups tab.
            </p>
          </div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-4 py-2 transition-colors">
            Back to app
          </Link>
        </div>

        {/* Toggle */}
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-border">
          {DESIGNS.map(d => {
            const isActive = active === d.key
            return (
              <button
                key={d.key}
                onClick={() => setActive(d.key)}
                className={`text-left rounded-lg px-3 py-2 border transition-colors ${
                  isActive
                    ? 'bg-purple-500/15 border-purple-500/50 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                }`}
              >
                <div className="text-sm font-semibold">{d.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{d.subtitle}</div>
              </button>
            )
          })}
        </div>

        {/* Active design */}
        <div className="rounded-2xl border border-border bg-background/60 p-4 md:p-6">
          {active === 'A' && <DesignA />}
          {active === 'B' && <DesignB />}
          {active === 'C' && <DesignC />}
          {active === 'D' && <DesignD />}
          {active === 'E' && <DesignE />}
        </div>

        <p className="text-[11px] text-muted-foreground mt-6">
          All designs use the same 15-entry mock dataset — mix of overdue, due today, due this week, future, and a ghosted (35-day-old) row. Once you pick a direction, ping me and I&apos;ll wire it into the real Follow-ups tab.
        </p>
      </div>
    </main>
  )
}
