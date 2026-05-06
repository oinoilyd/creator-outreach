'use client'

import type { Creator } from '@/lib/types'

export function DismissedTab({ dismissed, onUndismiss }: { dismissed: Creator[], onUndismiss: (id: string) => void }) {
  if (dismissed.length === 0) {
    return <p className="text-muted-foreground text-sm mt-4">No dismissed creators yet — click the ✕ on any creator to skip them.</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-foreground/80">
          <tr>
            <th className="text-left px-4 py-3">Channel</th>
            <th className="text-left px-4 py-3">Avg Views</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="px-4 py-3 w-24">Undo</th>
          </tr>
        </thead>
        <tbody>
          {dismissed.map((c, i) => (
            <tr key={c.channelId} className={`${i % 2 === 0 ? 'bg-card' : 'bg-background'} opacity-60`}>
              <td className="px-4 py-3"><a href={c.channelUrl} target="_blank" className="text-blue-400 hover:underline">{c.channelName}</a></td>
              <td className="px-4 py-3 text-muted-foreground">{c.avgViews.toLocaleString()}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{c.email || '—'}</td>
              <td className="px-4 py-3">
                <button onClick={() => onUndismiss(c.channelId)} className="text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-2 py-1 transition-colors">Restore</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
