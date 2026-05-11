'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { OutreachEntry } from '@/lib/types'
import { AStat } from '@/components/shared/AStat'
import { StackedBar } from '@/components/shared/StackedBar'
import { CustomMetricCard } from '@/components/outreach/CustomMetricCard'

export function OutreachAnalytics({ entries, customMetrics, onOpenCustomize, onExportExcel, onExportCsv }: {
  entries: OutreachEntry[]
  customMetrics: import('@/lib/types').CustomMetric[]
  onOpenCustomize: () => void
  /** Export the underlying outreach list — same handlers the Outreach
   *  table uses, just surfaced from the Analytics tab too so a user
   *  reading the metrics can export without switching tabs. */
  onExportExcel: () => void
  onExportCsv: () => void
}) {
  // Settings gear popover state (Customize Analytics + Export entries).
  // Click-outside / Escape closes — same UX pattern as the Results /
  // Outreach tab's settings gear.
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showSettings) return
    function onClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowSettings(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [showSettings])
  if (entries.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center">
        <p className="text-muted-foreground text-sm">No outreach yet — add some entries first to see analytics.</p>
      </div>
    )
  }

  const total = entries.length
  // "Reached out" = anything but "Not Outreached" / blank status.
  // "Response received" = creator replied either way (Successful or Rejected).
  // No Response = reached out but never heard back; still counts as reached out.
  const isReachedOut = (e: OutreachEntry) => e.status !== 'Not Outreached' && e.status !== ''
  const reachedOut = entries.filter(isReachedOut).length
  const responseReceived = entries.filter(e => e.status === 'Successful' || e.status === 'Rejected').length
  const successful = entries.filter(e => e.status === 'Successful').length
  const rejected = entries.filter(e => e.status === 'Rejected').length
  const open = entries.filter(e => e.status === 'Open').length
  const noResponse = entries.filter(e => e.status === 'No Response').length
  const notOutreached = entries.filter(e => e.status === 'Not Outreached' || e.status === '').length

  const pipelineValue = entries
    .filter(e => e.status !== 'Rejected')
    .reduce((sum, e) => {
      const num = parseFloat(String(e.dealValue || '').replace(/[^0-9.]/g, ''))
      return sum + (isFinite(num) ? num : 0)
    }, 0)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const stale = entries.filter(e => {
    if (!e.followUpDate || e.status !== 'Open') return false
    const t = new Date(e.followUpDate).getTime()
    return isFinite(t) && t < todayMs
  }).length

  // Response rate: of those you reached out to, who responded either way.
  const responseRate = reachedOut > 0 ? Math.round((responseReceived / reachedOut) * 100) : 0
  // Win rate: of those who responded, what fraction was Successful.
  const winRate = responseReceived > 0 ? Math.round((successful / responseReceived) * 100) : 0

  const SEVEN_D_AGO = Date.now() - 7 * 24 * 60 * 60 * 1000
  const addedLast7 = entries.filter(e => e.addedAt > SEVEN_D_AGO).length
  const reachedLast7 = entries.filter(e => {
    if (!e.dateReachedOut) return false
    const t = new Date(e.dateReachedOut).getTime()
    return isFinite(t) && t > SEVEN_D_AGO
  }).length

  const [mediumScope, setMediumScope] = useState<'all' | 'successful' | 'rejected'>('all')
  const mediumPool = entries.filter(e => {
    if (!isReachedOut(e)) return false
    if (mediumScope === 'successful') return e.status === 'Successful'
    if (mediumScope === 'rejected') return e.status === 'Rejected'
    return true
  })
  const mediumCounts = { Email: 0, LinkedIn: 0, Other: 0 }
  mediumPool.forEach(e => {
    if (e.medium === 'Email') mediumCounts.Email++
    else if (e.medium === 'LinkedIn') mediumCounts.LinkedIn++
    else if (e.medium === 'Other' || e.medium === '') mediumCounts.Other++
  })
  const totalMedium = mediumCounts.Email + mediumCounts.LinkedIn + mediumCounts.Other

  return (
    <div className="space-y-6">
      <div className="flex justify-end -mt-2">
        {/* Single Settings gear consolidating Customize + Export.
            Same pattern as the Results / Outreach tab settings gear:
            click → small popover; click outside or hit Escape → closes.
            Click-outside is bulletproof here (no slide-out modal that
            could trap focus) so this is the smoother UX Dylan wanted. */}
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            onClick={() => setShowSettings(v => !v)}
            title="Analytics settings — customize metrics or export"
            aria-label="Analytics settings"
            aria-expanded={showSettings}
            className={`flex items-center justify-center w-8 h-8 rounded-md border transition-colors ${
              showSettings
                ? 'border-border bg-muted/60 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-border/80'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {showSettings && (
            <div className="absolute right-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-2xl shadow-black/30 z-30 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  onOpenCustomize()
                  setShowSettings(false)
                }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-b border-border/60"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h13M3 12h13M3 18h7" />
                </svg>
                Customize metrics
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportExcel()
                  setShowSettings(false)
                }}
                disabled={entries.length === 0}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-base leading-none">📊</span>
                Export Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportCsv()
                  setShowSettings(false)
                }}
                disabled={entries.length === 0}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-t border-border/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-base leading-none">📄</span>
                Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <AStat label="In pipeline" value={total} />
        <AStat label="Reached out" value={reachedOut} sub={total > 0 ? `${Math.round(reachedOut / total * 100)}% of pipeline` : undefined} />
        <AStat label="Response received" value={responseReceived} sub="Successful + Rejected" />
        <AStat label="Response rate" value={`${responseRate}%`} sub={`${responseReceived} of ${reachedOut} reached out`} />
        <AStat label="Win rate" value={`${winRate}%`} sub={`${successful} of ${responseReceived} responses`} />
        <AStat label="Pipeline $" value={pipelineValue > 0 ? `$${pipelineValue.toLocaleString()}` : '—'} sub="non-rejected" />
        <AStat label="Stale follow-ups" value={stale} highlight={stale > 0} />
      </div>

      {/* Status breakdown */}
      <div className="bg-card/40 border border-border rounded-xl p-5">
        <div className="text-sm font-semibold text-foreground mb-3">Status breakdown</div>
        <StackedBar
          segments={[
            { label: 'Successful', value: successful, color: 'bg-green-500' },
            { label: 'Open', value: open, color: 'bg-blue-500' },
            { label: 'No Response', value: noResponse, color: 'bg-gray-500' },
            { label: 'Rejected', value: rejected, color: 'bg-red-500' },
            { label: 'Not Outreached', value: notOutreached, color: 'bg-muted' },
          ]}
          total={total}
        />
      </div>

      {/* Velocity + medium */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card/40 border border-border rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-3">Velocity (last 7 days)</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-2xl font-bold text-foreground tabular-nums">{addedLast7}</div>
              <div className="text-[11px] text-muted-foreground">added</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tabular-nums">{reachedLast7}</div>
              <div className="text-[11px] text-muted-foreground">reached out</div>
            </div>
          </div>
        </div>

        <div className="bg-card/40 border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="text-sm font-semibold text-foreground">Outreach by medium</div>
            <div className="flex bg-muted/60 rounded-md p-0.5">
              {([
                { id: 'all', label: 'All' },
                { id: 'successful', label: 'Successful' },
                { id: 'rejected', label: 'Rejected' },
              ] as { id: 'all' | 'successful' | 'rejected'; label: string }[]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setMediumScope(opt.id)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    mediumScope === opt.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {totalMedium > 0 ? (
            <StackedBar
              segments={[
                { label: 'Email', value: mediumCounts.Email, color: 'bg-purple-500' },
                { label: 'LinkedIn', value: mediumCounts.LinkedIn, color: 'bg-blue-500' },
                { label: 'Other', value: mediumCounts.Other, color: 'bg-gray-500' },
              ]}
              total={totalMedium}
            />
          ) : (
            <div className="text-xs text-muted-foreground">
              {mediumScope === 'all' ? 'Nothing reached out yet.' : `No ${mediumScope} outreach yet.`}
            </div>
          )}
        </div>
      </div>

      {/* Custom metrics */}
      {customMetrics.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-foreground mb-3">My metrics</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {customMetrics.map(m => (
              <CustomMetricCard key={m.id} metric={m} entries={entries} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
