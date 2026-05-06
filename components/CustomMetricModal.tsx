'use client'

import { useState, useMemo } from 'react'
import type { CustomMetric, MetricFilter, MetricStatusFilter, MetricMediumFilter, MetricTristate, MetricWindow, MetricSumField, OutreachEntry } from '@/lib/types'
import { EMPTY_METRIC_FILTER } from '@/lib/types'
import { computeMetric, metricTypeLabel } from '@/lib/metrics'

export function CustomMetricModal({
  initial,
  entries,
  onSave,
  onClose,
  onDelete,
}: {
  initial?: CustomMetric
  entries: OutreachEntry[]
  onSave: (metric: CustomMetric) => Promise<void> | void
  onClose: () => void
  onDelete?: () => Promise<void> | void
}) {
  const [label, setLabel] = useState(initial?.label || '')
  const [type, setType] = useState<CustomMetric['type']>(initial?.type || 'count')
  const [filter, setFilter] = useState<MetricFilter>(initial?.filter || EMPTY_METRIC_FILTER)
  const [denomFilter, setDenomFilter] = useState<MetricFilter>(initial?.denomFilter || EMPTY_METRIC_FILTER)
  const [sumField, setSumField] = useState<MetricSumField>(initial?.sumField || 'dealValue')
  const [busy, setBusy] = useState(false)

  const draftMetric: CustomMetric = useMemo(() => ({
    id: initial?.id || 'preview',
    label: label.trim() || 'Untitled metric',
    type,
    filter,
    ...(type === 'percentage' ? { denomFilter } : {}),
    ...((type === 'sum' || type === 'average') ? { sumField } : {}),
  }), [label, type, filter, denomFilter, sumField, initial?.id])

  const previewValue = useMemo(() => computeMetric(draftMetric, entries), [draftMetric, entries])

  async function submit() {
    if (!label.trim()) return
    setBusy(true)
    try {
      const m: CustomMetric = {
        id: initial?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: label.trim(),
        type,
        filter,
        ...(type === 'percentage' ? { denomFilter } : {}),
        ...((type === 'sum' || type === 'average') ? { sumField } : {}),
      }
      await onSave(m)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-white">{initial ? 'Edit metric' : 'New metric'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>
        <p className="text-gray-500 text-xs mb-4">Define what to count. The metric appears as a card on the Analytics tab.</p>

        {/* Live preview — updates as the form changes */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-3.5 mb-5">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-[10px] uppercase tracking-wider text-purple-400/80">Live preview</div>
            <div className="text-[10px] text-gray-500 capitalize">{metricTypeLabel({ type, sumField })}</div>
          </div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5 truncate">{draftMetric.label}</div>
          <div className="text-2xl font-bold text-white tabular-nums">{previewValue}</div>
          <div className="text-[10px] text-gray-500 mt-1">Updates live as you change the filter below.</div>
        </div>

        <div className="space-y-3.5">
          {/* Label */}
          <Field label="Label">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. LinkedIn responses"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
              autoFocus
            />
          </Field>

          {/* Type */}
          <Field label="Type">
            <div className="flex gap-1 flex-wrap">
              {([
                { id: 'count', label: 'Count', desc: 'How many entries match' },
                { id: 'percentage', label: 'Percentage', desc: 'Numerator ÷ Denominator' },
                { id: 'sum', label: 'Sum', desc: 'Add up a numeric field' },
                { id: 'average', label: 'Average', desc: 'Mean of a numeric field across matching entries' },
              ] as { id: CustomMetric['type']; label: string; desc: string }[]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setType(opt.id)}
                  title={opt.desc}
                  className={`flex-1 min-w-[80px] px-3 py-1.5 text-xs rounded-md transition-colors ${
                    type === opt.id ? 'bg-purple-600/40 border border-purple-500/60 text-white' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {(type === 'sum' || type === 'average') && (
            <Field label={type === 'average' ? 'Field to average' : 'Field to sum'}>
              <select
                value={sumField}
                onChange={e => setSumField(e.target.value as MetricSumField)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                <option value="dealValue">Deal Value ($)</option>
                <option value="avgViews">Avg Views</option>
                <option value="fitScore">Fit Score</option>
                <option value="touchpoints"># Touchpoints</option>
              </select>
            </Field>
          )}

          {/* Filter */}
          <div className="border-t border-gray-800 pt-4">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">
              {type === 'percentage' ? 'Numerator filter' : 'Filter'}
            </div>
            <FilterEditor value={filter} onChange={setFilter} />
          </div>

          {type === 'percentage' && (
            <div className="border-t border-gray-800 pt-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">Denominator filter</div>
              <FilterEditor value={denomFilter} onChange={setDenomFilter} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-800">
          {initial && onDelete ? (
            <button
              onClick={async () => {
                if (!confirm(`Delete "${initial.label}"?`)) return
                setBusy(true)
                try { await onDelete(); onClose() } finally { setBusy(false) }
              }}
              disabled={busy}
              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Delete
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50">Cancel</button>
            <button
              onClick={submit}
              disabled={busy || !label.trim()}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Saving…' : (initial ? 'Save' : 'Create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function FilterEditor({ value, onChange }: { value: MetricFilter; onChange: (v: MetricFilter) => void }) {
  function set<K extends keyof MetricFilter>(key: K, v: MetricFilter[K]) {
    onChange({ ...value, [key]: v })
  }
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <SmallSelect label="Status" value={value.status} onChange={(v) => set('status', v as MetricStatusFilter)}
        options={[
          ['any', 'Any'],
          ['Not Outreached', 'Not Outreached'],
          ['Open', 'Open'],
          ['No Response', 'No Response'],
          ['Successful', 'Successful'],
          ['Rejected', 'Rejected'],
        ]}
      />
      <SmallSelect label="Medium" value={value.medium} onChange={(v) => set('medium', v as MetricMediumFilter)}
        options={[
          ['any', 'Any'],
          ['Email', 'Email'],
          ['LinkedIn', 'LinkedIn'],
          ['Other', 'Other'],
        ]}
      />
      <SmallSelect label="Reached out?" value={value.reachedOut} onChange={(v) => set('reachedOut', v as MetricTristate)}
        options={[['any', 'Any'], ['yes', 'Yes'], ['no', 'No']]}
      />
      <SmallSelect label="Favorite?" value={value.favorite} onChange={(v) => set('favorite', v as MetricTristate)}
        options={[['any', 'Any'], ['yes', 'Yes'], ['no', 'No']]}
      />
      <SmallSelect label="Has email?" value={value.hasEmail} onChange={(v) => set('hasEmail', v as MetricTristate)}
        options={[['any', 'Any'], ['yes', 'Yes'], ['no', 'No']]}
      />
      <SmallSelect label="Has LinkedIn?" value={value.hasLinkedin} onChange={(v) => set('hasLinkedin', v as MetricTristate)}
        options={[['any', 'Any'], ['yes', 'Yes'], ['no', 'No']]}
      />
      <SmallSelect label="Time window" value={value.window} onChange={(v) => set('window', v as MetricWindow)}
        options={[['all', 'All time'], ['last7', 'Last 7 days'], ['last30', 'Last 30 days']]}
      />
    </div>
  )
}

function SmallSelect({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}
