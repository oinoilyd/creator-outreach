import type { CustomMetric, MetricFilter, OutreachEntry } from './types'
import { EMPTY_METRIC_FILTER } from './types'

export function metricTypeLabel(m: Pick<CustomMetric, 'type' | 'sumField'>): string {
  if (m.type === 'sum' && m.sumField) return `Σ ${m.sumField}`
  if (m.type === 'average' && m.sumField) return `avg ${m.sumField}`
  return m.type
}

export function matchesMetricFilter(e: OutreachEntry, f: MetricFilter): boolean {
  const reachedOut = e.status !== 'Not Outreached' && e.status !== ''
  if (f.status !== 'any' && e.status !== f.status) return false
  if (f.medium !== 'any' && e.medium !== f.medium) return false
  if (f.hasEmail === 'yes' && !e.email) return false
  if (f.hasEmail === 'no' && !!e.email) return false
  if (f.hasLinkedin === 'yes' && !e.linkedin) return false
  if (f.hasLinkedin === 'no' && !!e.linkedin) return false
  if (f.favorite === 'yes' && !e.favorite) return false
  if (f.favorite === 'no' && e.favorite) return false
  if (f.reachedOut === 'yes' && !reachedOut) return false
  if (f.reachedOut === 'no' && reachedOut) return false
  if (f.window === 'last7' && e.addedAt < Date.now() - 7 * 86_400_000) return false
  if (f.window === 'last30' && e.addedAt < Date.now() - 30 * 86_400_000) return false
  return true
}

export function computeMetric(m: CustomMetric, entries: OutreachEntry[]): string {
  const num = entries.filter(e => matchesMetricFilter(e, m.filter))
  if (m.type === 'count') {
    return num.length.toLocaleString()
  }
  if (m.type === 'percentage') {
    const denom = entries.filter(e => matchesMetricFilter(e, m.denomFilter || m.filter))
    if (denom.length === 0) return '—'
    return `${Math.round((num.length / denom.length) * 100)}%`
  }
  if (m.type === 'sum' || m.type === 'average') {
    const f = m.sumField
    const values = num
      .map(e => {
        if (f === 'dealValue') return parseFloat(String(e.dealValue || '').replace(/[^0-9.]/g, ''))
        if (f === 'avgViews') return e.avgViews
        if (f === 'fitScore') return e.fitScore
        if (f === 'touchpoints') return parseFloat(String(e.touchpoints || '').replace(/[^0-9.]/g, ''))
        return NaN
      })
      .filter(v => isFinite(v))
    if (values.length === 0) return '—'
    if (m.type === 'sum') {
      const total = values.reduce((s, v) => s + v, 0)
      if (m.sumField === 'dealValue') return total > 0 ? `$${total.toLocaleString()}` : '—'
      return total > 0 ? total.toLocaleString() : '—'
    }
    // average
    const avg = values.reduce((s, v) => s + v, 0) / values.length
    if (m.sumField === 'dealValue') return `$${Math.round(avg).toLocaleString()}`
    if (Number.isInteger(avg)) return avg.toLocaleString()
    return avg.toFixed(1)
  }
  return '—'
}

export const SUGGESTED_METRICS: Omit<CustomMetric, 'id'>[] = [
  {
    label: 'LinkedIn replies',
    type: 'count',
    filter: { ...EMPTY_METRIC_FILTER, medium: 'LinkedIn', status: 'Successful' },
  },
  {
    label: 'Email replies',
    type: 'count',
    filter: { ...EMPTY_METRIC_FILTER, medium: 'Email', status: 'Successful' },
  },
  {
    label: 'LinkedIn close rate',
    type: 'percentage',
    filter: { ...EMPTY_METRIC_FILTER, medium: 'LinkedIn', status: 'Successful' },
    denomFilter: { ...EMPTY_METRIC_FILTER, medium: 'LinkedIn', reachedOut: 'yes' },
  },
  {
    label: 'Email close rate',
    type: 'percentage',
    filter: { ...EMPTY_METRIC_FILTER, medium: 'Email', status: 'Successful' },
    denomFilter: { ...EMPTY_METRIC_FILTER, medium: 'Email', reachedOut: 'yes' },
  },
  {
    label: 'Total deal value',
    type: 'sum',
    sumField: 'dealValue',
    filter: { ...EMPTY_METRIC_FILTER },
  },
  {
    label: 'Pipeline $ favorites',
    type: 'sum',
    sumField: 'dealValue',
    filter: { ...EMPTY_METRIC_FILTER, favorite: 'yes' },
  },
  {
    label: 'Avg fit · successful',
    type: 'average',
    sumField: 'fitScore',
    filter: { ...EMPTY_METRIC_FILTER, status: 'Successful' },
  },
  {
    label: 'Favorites',
    type: 'count',
    filter: { ...EMPTY_METRIC_FILTER, favorite: 'yes' },
  },
  {
    label: 'No response',
    type: 'count',
    filter: { ...EMPTY_METRIC_FILTER, status: 'No Response' },
  },
  {
    label: 'Fresh leads (7d)',
    type: 'count',
    filter: { ...EMPTY_METRIC_FILTER, window: 'last7' },
  },
]
