import type { CustomMetric, MetricFilter, OutreachEntry } from './types'
import { EMPTY_METRIC_FILTER } from './types'

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
  if (m.type === 'sum') {
    const total = num.reduce((s, e) => {
      const f = m.sumField
      let v = 0
      if (f === 'dealValue') v = parseFloat(String(e.dealValue || '').replace(/[^0-9.]/g, '')) || 0
      else if (f === 'avgViews') v = e.avgViews || 0
      else if (f === 'fitScore') v = e.fitScore || 0
      else if (f === 'touchpoints') v = parseFloat(String(e.touchpoints || '').replace(/[^0-9.]/g, '')) || 0
      return s + (isFinite(v) ? v : 0)
    }, 0)
    if (m.sumField === 'dealValue') return total > 0 ? `$${total.toLocaleString()}` : '—'
    return total > 0 ? total.toLocaleString() : '—'
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
