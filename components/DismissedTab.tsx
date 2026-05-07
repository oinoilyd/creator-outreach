'use client'

import type { Creator, UserProfile } from '@/lib/types'
import { composeUrl } from '@/lib/format'

export function DismissedTab({
  dismissed,
  onUndismiss,
  onDeepSearch,
  deepSearchingIds,
  onSearchAll,
  bulkRunning,
  profile,
}: {
  dismissed: Creator[]
  onUndismiss: (id: string) => void
  onDeepSearch?: (channelId: string) => void
  deepSearchingIds?: Set<string>
  onSearchAll?: () => void
  bulkRunning?: boolean
  profile?: UserProfile | null
}) {
  if (dismissed.length === 0) {
    return <p className="text-muted-foreground text-sm mt-4">No dismissed creators yet — click the ✕ on any creator to skip them.</p>
  }
  const pendingEmail = dismissed.filter(c => !c.email).length
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-foreground/80">
          <tr>
            <th className="text-left px-4 py-3">Channel</th>
            <th className="text-left px-4 py-3">Avg Views</th>
            <th className="text-left px-4 py-3">
              <div className="inline-flex items-center gap-1.5">
                <span>Email</span>
                {onSearchAll && (pendingEmail > 0 || bulkRunning) && (
                  <button
                    onClick={onSearchAll}
                    disabled={bulkRunning}
                    title={`Aggressive deep-search emails for ${pendingEmail} dismissed creator${pendingEmail === 1 ? '' : 's'} still missing one. Runs in background.`}
                    aria-label={`Refresh ${pendingEmail} missing emails on dismissed creators`}
                    className="inline-flex items-center justify-center w-5 h-5 rounded text-purple-700 dark:text-purple-400 hover:text-foreground hover:bg-purple-500/20 transition-colors disabled:opacity-60 disabled:cursor-wait"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${bulkRunning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
            </th>
            <th className="px-4 py-3 w-24">Undo</th>
          </tr>
        </thead>
        <tbody>
          {dismissed.map((c, i) => {
            const searching = !!deepSearchingIds?.has(c.channelId)
            return (
              <tr key={c.channelId} className={`${i % 2 === 0 ? 'bg-card' : 'bg-background'} opacity-70 hover:opacity-100 transition-opacity`}>
                <td className="px-4 py-3"><a href={c.channelUrl} target="_blank" className="text-blue-800 dark:text-blue-400 hover:underline">{c.channelName}</a></td>
                <td className="px-4 py-3 text-muted-foreground">{c.avgViews.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs">
                  {c.email ? (
                    <a
                      href={composeUrl(profile?.mailClient ?? 'default', c.email, '', '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 dark:text-emerald-400 hover:underline break-all"
                    >{c.email}</a>
                  ) : onDeepSearch ? (
                    <button
                      onClick={() => onDeepSearch(c.channelId)}
                      disabled={searching}
                      title="Aggressive deep search — runs in the background; you can keep using the app"
                      className="text-[10px] text-purple-700 dark:text-purple-400 hover:text-foreground border border-purple-500/30 hover:border-purple-500/60 rounded px-2 py-0.5 transition-colors disabled:opacity-60 disabled:cursor-wait"
                    >
                      {searching ? 'Searching…' : '🔍 Find email'}
                    </button>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => onUndismiss(c.channelId)} className="text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-2 py-1 transition-colors">Restore</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
