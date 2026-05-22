'use client'

import { useState, useMemo, useContext, useRef } from 'react'
import type {
  Creator, SortCol, SortKey, ColId, ColConfig, ScoreWeights, PlatformId, UserProfile,
} from '@/lib/types'
import { sortCreators } from '@/lib/scoring'
import { COL_SORT } from '@/lib/columns'
import { PLATFORM_CONFIGS, getPrimaryUrlForPlatform, getHandleForPlatform } from '@/lib/platform'
import { AnimatedRow } from '@/components/AnimatedRow'
import { DismissIcon, PlusCircleIcon, SortIndicator } from '@/components/ui'
import { renderCell } from './renderCell'
import { ColumnContextMenu } from './ColumnContextMenu'
import { GuidanceContext } from './FitScoreCell'

export function CreatorTable({ creators, outreachIds, dismissedIds, onAddToOutreach, onDismiss, onReorderCols, loading, sorts, onSort, colConfig, loadMoreBatch, scoreWeights, scoreNarrative, activePlatform, totalUnfiltered, profile, onDeepSearch, deepSearchingIds, onDeepSearchAll, bulkRunning, emailFirst = true, onUpdateInstagram, onOpenCustomize }: {
  creators: Creator[], outreachIds: Set<string>, dismissedIds: Set<string>
  onAddToOutreach: (c: Creator) => void
  onDismiss: (c: Creator) => void
  onReorderCols: (newConfig: ColConfig[]) => void
  loading?: boolean
  sorts: SortKey[], onSort: (col: SortCol) => void
  colConfig: ColConfig[]
  loadMoreBatch?: Creator[]
  scoreWeights: ScoreWeights
  scoreNarrative: string
  activePlatform: PlatformId
  totalUnfiltered: number
  profile: UserProfile | null
  onDeepSearch: (channelId: string) => void
  deepSearchingIds: Set<string>
  onDeepSearchAll: () => void
  bulkRunning: boolean
  emailFirst?: boolean
  /** Optional: when provided, the Instagram cell renders a "Find IG"
   *  button for creators where IG wasn't auto-resolved, plus a metrics
   *  badge that polls /api/instagram-status when an IG handle is known. */
  onUpdateInstagram?: (channelId: string, igUrl: string) => void
  /** Opens the parent's customize-columns modal. Surfaced via the
   *  right-click context menu on any column header. */
  onOpenCustomize?: () => void
}) {
  const { entries: guidanceEntries } = useContext(GuidanceContext)
  // Multi-key sort: pass the sorts array straight through to
  // sortCreators (which now accepts SortKey[] in its first overload).
  const sorted = useMemo(() => sortCreators(creators, sorts, 'desc', scoreWeights, guidanceEntries, emailFirst), [creators, sorts, scoreWeights, guidanceEntries, emailFirst])
  const visibleCols = colConfig.filter(c => c.visible)
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  // Right-click context menu state — same pattern as OutreachTab.
  const [headerMenu, setHeaderMenu] = useState<{
    colId: ColId
    label: string
    x: number
    y: number
  } | null>(null)
  // Fit Score column-header info popover. Position is calculated
  // from the icon's bounding rect on hover/click and rendered with
  // position:fixed so it ESCAPES the table's overflow-x-auto
  // clipping (the previous absolute-positioned version was getting
  // cut off and bouncing the table's scrollbars). Auto-clamps to the
  // viewport so it never falls off-screen.
  const [fitScoreTip, setFitScoreTip] = useState<{ x: number; y: number } | null>(null)
  function openFitScoreTip(target: HTMLElement) {
    const rect = target.getBoundingClientRect()
    const TIP_W = 320
    const TIP_H = 220
    const margin = 8
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    let x = rect.left
    let y = rect.bottom + 6
    if (x + TIP_W > viewportW - margin) x = viewportW - TIP_W - margin
    if (y + TIP_H > viewportH - margin) y = rect.top - TIP_H - 6 // flip above
    setFitScoreTip({ x: Math.max(margin, x), y: Math.max(margin, y) })
  }
  function closeFitScoreTip() {
    setFitScoreTip(null)
  }

  function handleColDrop(targetIdx: number) {
    const from = dragIdx.current
    if (from === null || from === targetIdx) { setDragOverIdx(null); return }
    const newVisible = [...visibleCols]
    const [moved] = newVisible.splice(from, 1)
    newVisible.splice(targetIdx, 0, moved)
    onReorderCols([...newVisible, ...colConfig.filter(c => !c.visible)])
    dragIdx.current = null
    setDragOverIdx(null)
  }

  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-card/95 backdrop-blur-md text-foreground/80 border-b border-border">
          <tr>
            <th className="px-2 py-3 text-center w-12" title="Dismiss — hide this creator from results">
              <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                <DismissIcon active={false} />
                <span className="text-[9px] font-semibold tracking-wide uppercase">Dismiss</span>
              </div>
            </th>
            <th className="px-2 py-3 text-center w-12" title="Add to Outreach list">
              <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                <PlusCircleIcon added={false} />
                <span className="text-[9px] font-semibold tracking-wide uppercase">Outreach</span>
              </div>
            </th>
            <th className="text-left px-4 py-3 whitespace-nowrap select-none font-medium">
              {activePlatform === 'youtube' ? 'Channel' : 'Handle'}
            </th>
            {visibleCols.map((col, idx) => {
              const sc = COL_SORT[col.id]
              const isOver = dragOverIdx === idx
              // Current sort direction for this column, if any — drives
              // aria-sort so screen readers announce "ascending /
              // descending / none" alongside the column label.
              const currentSort = sc ? sorts.find(s => s.col === sc) : undefined
              const ariaSort: 'ascending' | 'descending' | 'none' = currentSort
                ? (currentSort.dir === 'asc' ? 'ascending' : 'descending')
                : 'none'
              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={sc ? ariaSort : undefined}
                  // Keyboard-reachable. Tab moves focus through column
                  // headers; Enter/Space sorts (when sortable);
                  // Shift+F10 or the ContextMenu key opens the column
                  // menu (Move left / right / Hide / Customize) —
                  // keyboard alternative to drag-to-reorder, satisfies
                  // WCAG 2.5.7.
                  tabIndex={0}
                  draggable
                  onDragStart={() => { dragIdx.current = idx }}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(idx) }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={e => { e.preventDefault(); handleColDrop(idx) }}
                  onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null) }}
                  onClick={() => sc && onSort(sc)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && sc) {
                      e.preventDefault()
                      onSort(sc)
                      return
                    }
                    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
                      e.preventDefault()
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setHeaderMenu({
                        colId: col.id,
                        label: col.label,
                        x: rect.left + 12,
                        y: rect.bottom + 4,
                      })
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setHeaderMenu({
                      colId: col.id,
                      label: col.label,
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }}
                  className={`text-left px-4 py-3 select-none whitespace-nowrap transition-colors ${sc ? 'cursor-grab hover:text-foreground' : ''} ${isOver ? 'border-l-2 border-blue-400 bg-muted' : ''}`}
                >
                  <span className="mr-1 text-muted-foreground/70 text-xs">⠿</span>
                  {col.label}
                  {sc && <SortIndicator col={sc} sorts={sorts} />}
                  {col.id === 'fitScore' && (
                    <span className="relative inline-flex ml-1.5 align-middle">
                      <button
                        type="button"
                        draggable={false}
                        onDragStart={(ev) => ev.preventDefault()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseEnter={(e) => openFitScoreTip(e.currentTarget)}
                        onMouseLeave={() => closeFitScoreTip()}
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          if (fitScoreTip) closeFitScoreTip()
                          else openFitScoreTip(e.currentTarget)
                        }}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-purple-500/40 text-purple-700 dark:text-purple-400 text-[10px] font-bold hover:bg-purple-500/15 transition-colors leading-none"
                        aria-label="What is Fit Score?"
                      >i</button>
                    </span>
                  )}
                  {col.id === 'email' && (() => {
                    const pending = sorted.filter(c => !c.email && !c.enriching).length
                    if (pending === 0 && !bulkRunning) return null
                    return (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); onDeepSearchAll() }}
                        disabled={bulkRunning}
                        title={`Refresh emails for ${pending} row${pending === 1 ? '' : 's'} still missing one. ~10s each, 3 in parallel.`}
                        aria-label={`Refresh ${pending} missing emails`}
                        className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded text-purple-700 dark:text-purple-400 hover:text-foreground hover:bg-purple-500/20 transition-colors disabled:opacity-60 disabled:cursor-wait"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${bulkRunning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    )
                  })()}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && !loading && (
            <tr>
              <td colSpan={3 + visibleCols.length} className="px-6 py-10 text-center text-muted-foreground/70 text-sm">
                {totalUnfiltered > 0 && activePlatform !== 'youtube'
                  ? `None of the ${totalUnfiltered} results have ${PLATFORM_CONFIGS.find(p => p.id === activePlatform)?.label} linked — try a broader search`
                  : 'Search for a topic above to find creators'}
              </td>
            </tr>
          )}
          {sorted.map((c, i) => (
            <AnimatedRow key={c.channelId} index={i} className={`transition-colors ${i % 2 === 0 ? 'bg-card/40 hover:bg-card/80' : 'bg-background hover:bg-card/40'}`}>
              <td className="px-2 py-3 text-center">
                <button
                  onClick={() => onDismiss(c)}
                  title="Dismiss — hide this creator from results"
                  aria-label={dismissedIds.has(c.channelId) ? `Undismiss ${c.channelName}` : `Dismiss ${c.channelName}`}
                  aria-pressed={dismissedIds.has(c.channelId)}
                  className={`transition-colors ${dismissedIds.has(c.channelId) ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground hover:text-red-700 dark:text-red-400'}`}
                >
                  <DismissIcon active={dismissedIds.has(c.channelId)} />
                </button>
              </td>
              <td className="px-2 py-3 text-center">
                <button
                  onClick={() => onAddToOutreach(c)}
                  title={outreachIds.has(c.channelId) ? 'Remove from Outreach' : 'Add to Outreach'}
                  aria-label={outreachIds.has(c.channelId) ? `Remove ${c.channelName} from outreach` : `Add ${c.channelName} to outreach`}
                  aria-pressed={outreachIds.has(c.channelId)}
                  className={`transition-colors ${outreachIds.has(c.channelId) ? 'text-purple-700 dark:text-purple-400' : 'text-muted-foreground hover:text-purple-700 dark:text-purple-400'}`}
                >
                  <PlusCircleIcon added={outreachIds.has(c.channelId)} />
                </button>
              </td>
              <td className="px-4 py-3">
                <NameCell c={c} activePlatform={activePlatform} />
              </td>
              {visibleCols.map(col => renderCell(
                col.id, c, scoreWeights, scoreNarrative, profile,
                deepSearchingIds.has(c.channelId), onDeepSearch,
                // Suppress the "+ Find IG" affordance on YouTube
                // platform mode — manual IG hunting is noise when
                // the lens is YouTube creators. Other platforms
                // still get the button so an Instagram-first
                // workflow can fill missing handles.
                activePlatform === 'youtube' ? undefined : onUpdateInstagram,
              ))}
            </AnimatedRow>
          ))}
          {loadMoreBatch && loadMoreBatch.length > 0 && (
            <>
              <tr>
                <td colSpan={3 + visibleCols.length} className="px-4 py-2 bg-muted/60 border-t-2 border-b border-border">
                  <span className="text-xs text-muted-foreground font-medium tracking-wide">— {loadMoreBatch.length} additional results —</span>
                </td>
              </tr>
              {loadMoreBatch.map((c, i) => (
                <tr key={`lm-${c.channelId}`} className={`transition-colors ${i % 2 === 0 ? 'bg-card/40 hover:bg-card/80' : 'bg-background hover:bg-card/40'}`}>
                  <td className="px-2 py-3 text-center">
                    <button
                      onClick={() => onDismiss(c)}
                      title="Dismiss — hide this creator from results"
                      className={`transition-colors ${dismissedIds.has(c.channelId) ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground hover:text-red-700 dark:text-red-400'}`}
                    >
                      <DismissIcon active={dismissedIds.has(c.channelId)} />
                    </button>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button
                      onClick={() => onAddToOutreach(c)}
                      title={outreachIds.has(c.channelId) ? 'Remove from Outreach' : 'Add to Outreach'}
                      className={`transition-colors ${outreachIds.has(c.channelId) ? 'text-purple-700 dark:text-purple-400' : 'text-muted-foreground/70 hover:text-purple-700 dark:text-purple-400'}`}
                    >
                      <PlusCircleIcon added={outreachIds.has(c.channelId)} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <NameCell c={c} activePlatform={activePlatform} />
                  </td>
                  {visibleCols.map(col => renderCell(
                    col.id, c, scoreWeights, scoreNarrative, profile,
                    deepSearchingIds.has(c.channelId), onDeepSearch,
                    // Same YouTube-gate as the primary block above.
                    activePlatform === 'youtube' ? undefined : onUpdateInstagram,
                  ))}
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>

      {/* Right-click context menu — same shared component used by
          OutreachTab. Hides the column, moves it left/right, or
          opens the customize modal. The Move-left/right entries are
          the keyboard alternative to drag-to-reorder (WCAG 2.5.7). */}
      {headerMenu && (() => {
        const visibleIds = colConfig.filter(c => c.visible).map(c => c.id)
        const idx = visibleIds.indexOf(headerMenu.colId)
        const canMoveLeft = idx > 0
        const canMoveRight = idx >= 0 && idx < visibleIds.length - 1
        const swap = (delta: -1 | 1) => {
          const target = idx + delta
          if (target < 0 || target >= visibleIds.length) return
          const reordered = [...visibleIds]
          ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
          const visibleSet = new Set(reordered)
          const newConfig = [
            ...reordered.map(id => colConfig.find(c => c.id === id)!),
            ...colConfig.filter(c => !visibleSet.has(c.id)),
          ]
          onReorderCols(newConfig)
        }
        return (
          <ColumnContextMenu
            x={headerMenu.x}
            y={headerMenu.y}
            label={headerMenu.label}
            canHide={true}
            canMoveLeft={canMoveLeft}
            canMoveRight={canMoveRight}
            onMoveLeft={() => swap(-1)}
            onMoveRight={() => swap(1)}
            onHide={() => {
              const newConfig = colConfig.map(c =>
                c.id === headerMenu.colId ? { ...c, visible: false } : c,
              )
              onReorderCols(newConfig)
            }}
            onCustomize={onOpenCustomize ?? (() => {})}
            onClose={() => setHeaderMenu(null)}
          />
        )
      })()}
      {/* Fit Score info popover — fixed-position so it escapes the
          table's overflow-x-auto clipping. Hover-on / hover-off via
          the icon's onMouseEnter / onMouseLeave; click toggles
          sticky. Width capped at 320px so the body doesn't wrap into
          a tall scrollable column. */}
      {fitScoreTip && (
        <div
          role="tooltip"
          onMouseEnter={() => { /* keep open while hovering the popover */ }}
          onMouseLeave={() => closeFitScoreTip()}
          style={{ position: 'fixed', left: fitScoreTip.x, top: fitScoreTip.y, width: 320 }}
          className="z-[60] rounded-lg border border-border bg-card shadow-2xl shadow-black/30 p-3.5 text-xs text-foreground/80 normal-case font-normal space-y-2"
        >
          <div>
            <strong className="text-foreground">Fit Score (0–100)</strong> — how well a creator matches your ideal-lead criteria. Higher = better fit.
          </div>
          <div className="text-muted-foreground">Computed from:</div>
          <ul className="space-y-1 ml-1 text-muted-foreground">
            <li>• <span className="text-foreground/90">Audience</span> — subs, avg views, last-uploaded recency.</li>
            <li>• <span className="text-foreground/90">Reachability</span> — has email + has socials.</li>
            <li>• <span className="text-foreground/90">Niche match</span> — keyword overlap between channel name / titles and your search terms.</li>
            <li>• <span className="text-foreground/90">Your guidance</span> — custom rules from the ⚡ panel.</li>
          </ul>
          <div className="text-[11px] text-muted-foreground italic pt-1 border-t border-border">
            Tweak weights via <span className="text-purple-700 dark:text-purple-400">⚡ Lead Criteria</span> — scores recompute live.
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * First-column identity cell. Behavior switches on the active platform:
 *
 *   • YouTube      → big YT channel name, links to YT channel
 *   • Instagram    → big "@iginsta_handle", muted YT channel name underneath,
 *                    links to the IG profile. Falls back to the YT channel
 *                    name if no IG handle exists yet (shouldn't happen in
 *                    steady state since the platform filter drops handle-less
 *                    rows — only possible during the streaming + Phase A
 *                    enrichment window).
 *   • X / TikTok / LinkedIn → same pattern as IG with the appropriate handle.
 *
 * Keeping the YT channel name as a secondary signal preserves the cross-
 * reference for the user (they can still see who the creator is even when
 * the page reads as an Instagram product).
 */
function NameCell({ c, activePlatform }: { c: Creator; activePlatform: PlatformId }) {
  const url = getPrimaryUrlForPlatform(c, activePlatform)
  const platformLabel = PLATFORM_CONFIGS.find(p => p.id === activePlatform)?.label ?? 'YouTube'
  if (activePlatform === 'youtube') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-800 dark:text-blue-400 hover:underline font-medium"
        title={`Open ${c.channelName} on YouTube`}
      >
        {c.channelName}
      </a>
    )
  }
  // Non-YouTube modes — show the platform handle as the primary label.
  const handle = getHandleForPlatform(c, activePlatform)
  if (handle) {
    return (
      <div className="flex flex-col">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-800 dark:text-blue-400 hover:underline font-medium"
          title={`Open @${handle} on ${platformLabel}`}
        >
          @{handle}
        </a>
        <span
          className="text-[11px] text-muted-foreground/70 truncate"
          title={`YouTube channel: ${c.channelName}`}
        >
          {c.channelName}
        </span>
      </div>
    )
  }
  // Fallback — handle missing (race during enrichment). Show YT name +
  // link to YT so the click never dead-ends. In steady state the
  // platform filter drops these rows anyway.
  return (
    <a
      href={c.channelUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-800 dark:text-blue-400 hover:underline font-medium"
      title={`No ${platformLabel} handle resolved — opens YouTube`}
    >
      {c.channelName}
    </a>
  )
}
