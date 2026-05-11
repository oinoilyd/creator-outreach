'use client'

import React from 'react'
import type { OutreachEntry } from '@/lib/types'
import { computeMetric, metricTypeLabel } from '@/lib/metrics'

export function CustomMetricCard({ metric, entries }: {
  metric: import('@/lib/types').CustomMetric
  entries: OutreachEntry[]
}) {
  const value = computeMetric(metric, entries)
  return (
    <div className="bg-card/40 border border-border rounded-xl p-4 hover:border-border transition-colors">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 truncate" title={metric.label}>{metric.label}</div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1 capitalize">{metricTypeLabel(metric)}</div>
    </div>
  )
}
