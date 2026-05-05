'use client'

import type { Creator } from '@/lib/types'

export function DismissedTab({ dismissed, onUndismiss }: { dismissed: Creator[], onUndismiss: (id: string) => void }) {
  if (dismissed.length === 0) {
    return <p className="text-gray-500 text-sm mt-4">No dismissed creators yet — click the ✕ on any creator to skip them.</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-800 text-gray-300">
          <tr>
            <th className="text-left px-4 py-3">Channel</th>
            <th className="text-left px-4 py-3">Avg Views</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="px-4 py-3 w-24">Undo</th>
          </tr>
        </thead>
        <tbody>
          {dismissed.map((c, i) => (
            <tr key={c.channelId} className={`${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-950'} opacity-60`}>
              <td className="px-4 py-3"><a href={c.channelUrl} target="_blank" className="text-blue-400 hover:underline">{c.channelName}</a></td>
              <td className="px-4 py-3 text-gray-400">{c.avgViews.toLocaleString()}</td>
              <td className="px-4 py-3 text-xs text-gray-400">{c.email || '—'}</td>
              <td className="px-4 py-3">
                <button onClick={() => onUndismiss(c.channelId)} className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 rounded px-2 py-1 transition-colors">Restore</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
