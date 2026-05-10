'use client'

import type { Creator, UserProfile } from '@/lib/types'
import { composeUrl, formatSubscribers, recipientIssue } from '@/lib/format'
import { toast } from 'sonner'

/**
 * Dismissed tab — same visual treatment as the Results table so
 * tab transitions don't feel jarring. Compact 6-column table:
 * channel name + handle, subs, avg views, email (with deep-search
 * fallback), dismissed-since timestamp implicit, and Restore action.
 *
 * Empty state mirrors the Outreach empty state — large icon, heading,
 * descriptive text, framed border. Same height + padding as the
 * other tabs' empty states so switching tabs doesn't make the page
 * jump.
 */
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
  // Empty state — matches the Outreach empty state shape so the
  // switching experience between tabs is consistent.
  if (dismissed.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-7 h-7 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">No dismissed creators</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Click the <span className="text-foreground font-medium">✕</span> on any creator
          in <span className="text-purple-700 dark:text-purple-400">Results</span> to skip
          them — they&apos;ll show up here, undimsissable in one click.
        </p>
      </div>
    )
  }

  const pendingEmail = dismissed.filter(c => !c.email).length
  const withEmail = dismissed.length - pendingEmail

  return (
    <div className="space-y-4">
      {/* Header strip — count + bulk-search affordance, matches the
          density of the Results / Outreach top metadata. */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium tabular-nums">{dismissed.length}</span>
          {' '}dismissed creator{dismissed.length === 1 ? '' : 's'}
          {' '}·{' '}
          <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">{withEmail}</span>{' '}
          with email
          {pendingEmail > 0 && (
            <>
              {' · '}
              <span className="text-muted-foreground/70 tabular-nums">{pendingEmail}</span>{' '}
              still missing
            </>
          )}
        </div>
        {onSearchAll && pendingEmail > 0 && (
          <button
            onClick={onSearchAll}
            disabled={bulkRunning}
            title={`Aggressive deep-search emails for ${pendingEmail} dismissed creator${pendingEmail === 1 ? '' : 's'} still missing one. Runs in background.`}
            className="inline-flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-400 hover:text-foreground border border-purple-500/30 hover:border-purple-500/60 rounded-md px-3 py-1.5 transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-3.5 h-3.5 ${bulkRunning ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {bulkRunning ? 'Searching…' : `Find ${pendingEmail} email${pendingEmail === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {/* Table — same border + bg treatment as the Results table for
          visual continuity when switching tabs. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card/40">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-[11px] uppercase tracking-wider">Channel</th>
              <th className="text-left px-4 py-3 font-medium text-[11px] uppercase tracking-wider whitespace-nowrap">Subs</th>
              <th className="text-left px-4 py-3 font-medium text-[11px] uppercase tracking-wider whitespace-nowrap">Avg views</th>
              <th className="text-left px-4 py-3 font-medium text-[11px] uppercase tracking-wider">Email</th>
              <th className="text-right px-4 py-3 font-medium text-[11px] uppercase tracking-wider w-32">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {dismissed.map(c => {
              const searching = !!deepSearchingIds?.has(c.channelId)
              const initials = (c.channelName || '?')
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map(s => s[0]?.toUpperCase() ?? '')
                .join('') || '?'
              return (
                <tr
                  key={c.channelId}
                  className="opacity-70 hover:opacity-100 hover:bg-muted/30 transition-all"
                >
                  {/* Channel — avatar + linked name, matches the
                      visual hierarchy of the Outreach table. */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-muted to-muted-foreground/30 text-foreground/80 text-[10px] font-semibold flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <a
                          href={c.channelUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 dark:text-blue-400 hover:underline font-medium truncate block"
                        >
                          {c.channelName}
                        </a>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatSubscribers(c.subscribers || '') || '—'}
                  </td>

                  <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                    {c.avgViews ? c.avgViews.toLocaleString() : '—'}
                  </td>

                  <td className="px-4 py-3 text-xs">
                    {c.email ? (
                      <a
                        href={composeUrl(profile?.mailClient ?? 'default', c.email, '', '', profile?.userEmail)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={ev => {
                          // 2026-05-10 recipient guard — see app/page.tsx
                          // guardOutreachClick for the full rationale.
                          // Blocks open-compose when the address is
                          // empty / invalid / equals the user's own
                          // signup email (sending-to-self bug).
                          const issue = recipientIssue(c.email, profile?.userEmail)
                          if (issue !== null) {
                            ev.preventDefault()
                            if (issue === 'self') {
                              toast.error('Blocked: that email matches your own signup address')
                            } else if (issue === 'invalid') {
                              toast.error(`Invalid email: "${(c.email ?? '').slice(0, 60)}"`)
                            }
                          }
                        }}
                        className="text-emerald-700 dark:text-emerald-400 hover:underline break-all"
                      >
                        {c.email}
                      </a>
                    ) : onDeepSearch ? (
                      <button
                        onClick={() => onDeepSearch(c.channelId)}
                        disabled={searching}
                        title="Aggressive deep search — runs in background"
                        className="text-[10px] text-purple-700 dark:text-purple-400 hover:text-foreground border border-purple-500/30 hover:border-purple-500/60 rounded px-2 py-0.5 transition-colors disabled:opacity-60 disabled:cursor-wait"
                      >
                        {searching ? 'Searching…' : '🔍 Find email'}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onUndismiss(c.channelId)}
                      title="Bring this creator back into Results"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-purple-500/50 rounded-md px-3 py-1 transition-colors"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M3 7v6h6" />
                        <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
                      </svg>
                      Restore
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
