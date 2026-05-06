'use client'

import type { OutreachEntry } from '@/lib/types'

export function LeadDetailModal({ entry, onUpdate, onClose }: {
  entry: OutreachEntry
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onClose: () => void
}) {
  const initials = (entry.channelName || '?')
    .trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?'

  const tps = parseInt(entry.touchpoints || '0', 10) || 0
  const dealValue = parseFloat(String(entry.dealValue || '').replace(/[^0-9.]/g, '')) || 0

  const statusColor = {
    'Successful': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    'Rejected': 'bg-red-500/15 text-red-300 border-red-500/40',
    'Open': 'bg-blue-500/15 text-blue-300 border-blue-500/40',
    'No Response': 'bg-gray-500/15 text-gray-300 border-gray-500/40',
    'Not Outreached': 'bg-gray-700/40 text-gray-400 border-gray-700',
    '': 'bg-gray-700/40 text-gray-400 border-gray-700',
  }[entry.status] || 'bg-gray-700/40 text-gray-400 border-gray-700'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white text-sm font-semibold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{entry.channelName || '(unnamed)'}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${statusColor}`}>
                {entry.status || 'Not Outreached'}
              </span>
              {entry.favorite && <span className="text-[10px] text-yellow-400">★ Favorite</span>}
              {entry.channelUrl && (
                <a href={entry.channelUrl} target="_blank" className="text-[11px] text-blue-400 hover:underline">
                  YouTube ↗
                </a>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none shrink-0">✕</button>
        </div>

        {/* Channel-level stats */}
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-gray-800">
          <Stat label="Subscribers" value={entry.subscribers || '—'} />
          <Stat label="Avg views" value={entry.avgViews ? entry.avgViews.toLocaleString() : '—'} />
          <Stat label="Fit score" value={entry.fitScore ? Math.round(entry.fitScore).toString() : '—'} />
          <Stat label="Deal value" value={dealValue > 0 ? `$${dealValue.toLocaleString()}` : '—'} highlight={dealValue > 0} />
        </div>

        {/* Outreach status section */}
        <div className="p-5 border-b border-gray-800 space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">Outreach status</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={entry.status || 'Not Outreached'}
                onChange={e => onUpdate(entry.id, 'status', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                <option value="Not Outreached">Not Outreached</option>
                <option value="Open">Open</option>
                <option value="No Response">No Response</option>
                <option value="Successful">Successful</option>
                <option value="Rejected">Rejected</option>
              </select>
            </Field>
            <Field label="Medium">
              <select
                value={entry.medium}
                onChange={e => onUpdate(entry.id, 'medium', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">—</option>
                <option value="Email">Email</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Date reached out">
              <input type="date" value={entry.dateReachedOut || ''} onChange={e => onUpdate(entry.id, 'dateReachedOut', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500" />
            </Field>
            <Field label="Follow-up date">
              <input type="date" value={entry.followUpDate || ''} onChange={e => onUpdate(entry.id, 'followUpDate', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500" />
            </Field>
            <Field label="Response date">
              <input type="date" value={entry.responseDate || ''} onChange={e => onUpdate(entry.id, 'responseDate', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500" />
            </Field>
            <Field label="# Touchpoints">
              <input type="number" min={0} value={entry.touchpoints || '0'} onChange={e => onUpdate(entry.id, 'touchpoints', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500" />
            </Field>
          </div>
          {entry.headerUsed && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Subject line / opener used</div>
              <div className="text-xs text-gray-300 bg-gray-800/40 border border-gray-800 rounded px-3 py-2">{entry.headerUsed}</div>
            </div>
          )}
        </div>

        {/* Contact + socials */}
        <div className="p-5 border-b border-gray-800 space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">Contact</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <ContactRow label="Email" value={entry.email} type="email" />
            <ContactRow label="LinkedIn" value={entry.linkedin} type="link" />
            <ContactRow label="Phone" value={entry.phone} />
            <ContactRow label="Product / pitch" value={entry.product} />
          </div>
          {tps > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span>Touch history</span>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(tps, 10) }).map((_, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-purple-500/70" />
                ))}
              </div>
              <span className="text-gray-400">{tps} touch{tps === 1 ? '' : 'es'}</span>
            </div>
          )}
        </div>

        {/* Notes (always editable) */}
        <div className="p-5 border-b border-gray-800">
          <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Notes</div>
          <textarea
            value={entry.notes || ''}
            onChange={e => onUpdate(entry.id, 'notes', e.target.value)}
            placeholder="What's the angle? What did they say?"
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        {/* Description (read-only-ish) */}
        {entry.description && (
          <div className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Channel description</div>
            <div className="text-xs text-gray-400 leading-relaxed max-h-32 overflow-y-auto bg-gray-800/30 border border-gray-800 rounded px-3 py-2 whitespace-pre-wrap">
              {entry.description}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${highlight ? 'text-emerald-300' : 'text-white'}`}>{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

function ContactRow({ label, value, type }: { label: string; value: string; type?: 'email' | 'link' }) {
  if (!value) return (
    <div className="flex items-center gap-2 text-gray-600">
      <span className="text-[10px] uppercase tracking-wider w-24">{label}</span>
      <span>—</span>
    </div>
  )
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-gray-500 w-24 shrink-0">{label}</span>
      {type === 'email' ? (
        <a href={`mailto:${value}`} className="text-emerald-400 hover:underline truncate">{value}</a>
      ) : type === 'link' ? (
        <a href={value} target="_blank" className="text-blue-400 hover:underline truncate">{value}</a>
      ) : (
        <span className="text-gray-300 truncate">{value}</span>
      )}
    </div>
  )
}
