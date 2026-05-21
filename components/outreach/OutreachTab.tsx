'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { OutreachEntry, OutreachColConfig, UserProfile } from '@/lib/types'
import { TrashIcon } from '@/components/ui'
import { AnimatedRow } from '@/components/AnimatedRow'
import { ColumnContextMenu } from '@/components/creators/ColumnContextMenu'
import { renderOutreachCell } from '@/components/outreach/renderOutreachCell'

export function OutreachTab({ entries, colConfig, onUpdate, onRemove, onOpenCustomize, onReorderCols, onOpenManualAdd, onSearchContacts, searchingIds, onSearchAll, bulkRunning, profile, emptyVariant, onOpenEntry, recentlyAddedIds, onClearRecentlyAdded, interactedNewIds, onMarkNewInteracted }: {
  entries: OutreachEntry[]
  colConfig: OutreachColConfig[]
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onRemove: (id: string) => void
  onOpenCustomize: () => void
  onReorderCols: (newConfig: OutreachColConfig[]) => void
  onOpenManualAdd: () => void
  onSearchContacts: (id: string) => void
  searchingIds: Set<string>
  onSearchAll: () => void
  bulkRunning: boolean
  profile: UserProfile | null
  /** Variant of the empty-state. The 'favorites' value is preserved
   *  here for callers (and legacy URLs) but the Favorites sub-tab was
   *  removed in v3 — see OutreachSubTabs comment. New code shouldn't
   *  pass 'favorites'. */
  emptyVariant?: 'all' | 'favorites'
  onOpenEntry?: (id: string) => void
  /** IDs of entries to pin to the top regardless of sort. Lives in the
   *  parent so it survives this component remounting on tab switch. */
  recentlyAddedIds: Set<string>
  /** Called when the user clicks a column header — parent clears the
   *  pin so user-driven sort takes precedence. */
  onClearRecentlyAdded: () => void
  /** Subset of recentlyAddedIds whose purple highlight has already
   *  been dismissed by user click. The row stays pinned but loses the
   *  visual flair. */
  interactedNewIds: Set<string>
  /** Called once the first time the user clicks anywhere on a
   *  pinned-new row. Parent records the id so the highlight stops
   *  rendering on subsequent re-renders. */
  onMarkNewInteracted: (id: string) => void
}) {
  // "Favorites first" — when on, favorited rows pin to the top of the
  // current sort. Replaces the old Favorites sub-tab; the favorites-
  // are-special signal lives inside the same table now.
  // localStorage so the preference sticks across sessions.
  const [favoritesFirst, setFavoritesFirstState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem('outreach.favoritesFirst') !== 'false'
  })
  function setFavoritesFirst(next: boolean) {
    setFavoritesFirstState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('outreach.favoritesFirst', String(next))
    }
  }
  const visibleCols = colConfig.filter(c => c.visible)
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(colConfig.map(c => [c.id, c.width]))
  )
  useEffect(() => {
    setWidths(prev => {
      const next = { ...prev }
      colConfig.forEach(c => { if (!(c.id as string in next)) next[c.id as string] = c.width })
      return next
    })
  }, [colConfig])

  const resizing = useRef<{ id: string; startX: number; startW: number } | null>(null)
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [sort, setSort] = useState<{ col: keyof OutreachEntry | null; dir: 'asc' | 'desc' }>({ col: null, dir: 'desc' })

  // recentlyAddedIds + onClearRecentlyAdded come in as props from
  // HomePage now (see comment on the parent state). Lifting fixed the
  // bug where switching Results → Outreach unmounted this component
  // and reset the pin set, hiding newly-added rows.

  // Right-click context menu state for column-header "Hide column"
  // affordance. One menu at a time across the table — opening on a
  // different header replaces the previous menu, which is what users
  // expect from native context menus.
  const [headerMenu, setHeaderMenu] = useState<{
    colId: keyof OutreachEntry
    label: string
    x: number
    y: number
  } | null>(null)
  const [showFavTooltip, setShowFavTooltip] = useState(false)
  const favTooltipRef = useRef<HTMLDivElement>(null)
  const [showStatusTooltip, setShowStatusTooltip] = useState(false)
  const statusTooltipRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onClick(ev: MouseEvent) {
      if (favTooltipRef.current && !favTooltipRef.current.contains(ev.target as Node)) {
        setShowFavTooltip(false)
      }
      if (statusTooltipRef.current && !statusTooltipRef.current.contains(ev.target as Node)) {
        setShowStatusTooltip(false)
      }
    }
    if (showFavTooltip || showStatusTooltip) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showFavTooltip, showStatusTooltip])

  function handleColDrop(targetIdx: number) {
    const from = dragIdx.current
    // index 0 is the leftmost locked column (★ favorite)
    if (from === null || from === 0 || targetIdx === 0 || from === targetIdx) { setDragOverIdx(null); return }
    const newVisible = [...visibleCols]
    const [moved] = newVisible.splice(from, 1)
    newVisible.splice(targetIdx, 0, moved)
    onReorderCols([...newVisible, ...colConfig.filter(c => !c.visible)])
    dragIdx.current = null
    setDragOverIdx(null)
  }

  function startResize(e: React.MouseEvent, colId: string) {
    e.preventDefault()
    resizing.current = { id: colId, startX: e.clientX, startW: widths[colId] ?? 120 }
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const { id, startX, startW } = resizing.current
      setWidths(prev => ({ ...prev, [id]: Math.max(40, startW + ev.clientX - startX) }))
    }
    const onUp = () => { resizing.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const totalWidth = visibleCols.reduce((sum, c) => sum + (widths[c.id as string] ?? c.defaultWidth), 0) + 36

  // Sort entries by the active column. Empty values always go to the bottom.
  // After sorting, recently-added rows are hoisted to the top in the order
  // they were added (regardless of the active sort) — see prevEntryIdsRef
  // useEffect above. The hoist is cleared whenever the user clicks a
  // column header.
  const sortedEntries = (() => {
    let result: OutreachEntry[]
    if (!sort.col) {
      result = entries
    } else {
      const col = sort.col
      const dir = sort.dir === 'asc' ? 1 : -1
      const numericCols: (keyof OutreachEntry)[] = ['avgViews', 'fitScore', 'addedAt', 'touchpoints']
      result = [...entries].sort((a, b) => {
        const va = a[col]
        const vb = b[col]
        const aEmpty = va == null || va === '' || va === false
        const bEmpty = vb == null || vb === '' || vb === false
        if (aEmpty && bEmpty) return 0
        if (aEmpty) return 1
        if (bEmpty) return -1
        if (typeof va === 'boolean' || typeof vb === 'boolean') {
          return (Number(vb) - Number(va)) * dir
        }
        if (numericCols.includes(col) || (!isNaN(Number(va)) && !isNaN(Number(vb)) && va !== '' && vb !== '')) {
          const na = typeof va === 'number' ? va : parseFloat(String(va).replace(/[^0-9.\-]/g, '')) || 0
          const nb = typeof vb === 'number' ? vb : parseFloat(String(vb).replace(/[^0-9.\-]/g, '')) || 0
          return (na - nb) * dir
        }
        return String(va).localeCompare(String(vb)) * dir
      })
    }
    // Hoist any recently-added rows. Within the pinned group, sort by
    // addedAt desc so the most recent is at the very top.
    if (recentlyAddedIds.size > 0) {
      const pinned = result
        .filter(e => recentlyAddedIds.has(e.id))
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      const rest = result.filter(e => !recentlyAddedIds.has(e.id))
      result = [...pinned, ...rest]
    }
    // Favorites pin — applied AFTER recently-added so a recently-added
    // favorite still sits at the top within the favorites group rather
    // than getting demoted by the non-favorite recently-added pin.
    if (favoritesFirst) {
      const favs = result.filter(e => e.favorite)
      const rest = result.filter(e => !e.favorite)
      result = [...favs, ...rest]
    }
    return result
  })()

  function handleHeaderClick(colId: keyof OutreachEntry) {
    if (colId === 'favorite') return // Favorite header is the click-tooltip
    // Clearing the pin here is the "until refiltering happens" half of
    // the recently-added behavior. Once the user expresses a sort
    // intent, recently-added rows fall back into normal sort order.
    if (recentlyAddedIds.size > 0) onClearRecentlyAdded()
    setSort(prev => {
      if (prev.col !== colId) return { col: colId, dir: 'desc' } // first click
      if (prev.dir === 'desc') return { col: colId, dir: 'asc' } // second click → asc
      return { col: null, dir: 'desc' } // third click → unsorted
    })
  }

  if (entries.length === 0) {
    return (
      <div className="mt-4">
        <div className="flex justify-end gap-2 mb-3">
          <button onClick={onOpenManualAdd} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-3 py-1.5 transition-colors">
            <span className="text-base leading-none">+</span> Add manually
          </button>
          <button onClick={onOpenCustomize} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-3 py-1.5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Customize Columns
          </button>
        </div>
        <div className="mt-2 border border-dashed border-border rounded-xl py-16 px-6 text-center">
          {emptyVariant === 'favorites' ? (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-amber-700 dark:text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.176 0l-3.366 2.445c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.363-1.118L2.046 9.384c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.302-3.957z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No favorites yet</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Click the <span className="text-amber-700 dark:text-yellow-400">★</span> next to any outreach entry to mark it as a favorite. Starred entries show up here.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-purple-700 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">Your outreach list is empty</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Run a search in <span className="text-foreground/80">Results</span>, then click the <span className="text-purple-700 dark:text-purple-400">+</span> icon on any creator to add them here. Or use the menu &rarr; Import to upload an Excel of past outreach.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        {/* Favorites-first toggle (left side) — replaces the old
            Favorites sub-tab. Pinning is the new "filter to top"
            behavior the user asked for: one less tab to manage. */}
        <FavoritesFirstToggle
          active={favoritesFirst}
          onChange={setFavoritesFirst}
          favoritedCount={entries.filter(e => e.favorite).length}
        />
        <div className="flex items-center gap-2">
          <button onClick={onOpenManualAdd} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-3 py-1.5 transition-colors">
            <span className="text-base leading-none">+</span> Add manually
          </button>
          <button onClick={onOpenCustomize} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded px-3 py-1.5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Customize Columns
          </button>
        </div>
      </div>
      <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-border">
        <table className="table-fixed text-sm border-collapse" style={{ width: totalWidth }}>
          <thead className="bg-card/95 backdrop-blur-md text-foreground/80 border-b border-border">
            <tr>
              {visibleCols.map((col, idx) => {
                const colId = col.id as string
                const isLocked = idx === 0
                const isOver = dragOverIdx === idx && !isLocked
                const ariaSort: 'ascending' | 'descending' | 'none' =
                  sort.col === col.id
                    ? (sort.dir === 'asc' ? 'ascending' : 'descending')
                    : 'none'
                return (
                  <th
                    key={colId}
                    scope="col"
                    aria-sort={ariaSort}
                    // Keyboard reachable. Tab moves through headers;
                    // Enter/Space sorts; Shift+F10 / ContextMenu key
                    // opens the column menu (Move left/right/Hide/
                    // Customize) — keyboard alternative to drag-to-
                    // reorder, satisfies WCAG 2.5.7. Locked column
                    // ('favorite') is not focusable since its menu
                    // would be no-op for everything but Hide-disabled.
                    tabIndex={isLocked ? -1 : 0}
                    style={{ width: widths[colId] ?? col.defaultWidth }}
                    draggable={!isLocked}
                    onDragStart={() => { if (!isLocked) dragIdx.current = idx }}
                    onDragOver={e => { e.preventDefault(); if (!isLocked) setDragOverIdx(idx) }}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={e => { e.preventDefault(); handleColDrop(idx) }}
                    onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null) }}
                    onClick={(e) => {
                      // ignore clicks bubbling from the resize handle / favorite tooltip
                      const target = e.target as HTMLElement
                      if (target.closest('[data-no-sort]')) return
                      handleHeaderClick(col.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        const target = e.target as HTMLElement
                        if (target.closest('[data-no-sort]')) return
                        e.preventDefault()
                        handleHeaderClick(col.id)
                        return
                      }
                      if (!isLocked && (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) {
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
                      // Right-click / two-finger-click → "Hide column"
                      // popover. Suppress the browser's native menu.
                      e.preventDefault()
                      setHeaderMenu({
                        colId: col.id,
                        label: col.label,
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }}
                    className={`relative text-left px-3 py-3 select-none font-medium transition-colors ${!isLocked ? 'cursor-grab' : ''} ${sort.col === col.id ? 'text-foreground bg-muted/30' : ''} ${isOver ? 'border-l-2 border-blue-400 bg-muted' : ''}`}
                  >
                    {colId === 'favorite' ? (
                      <div ref={favTooltipRef} className="relative" data-no-sort>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowFavTooltip(v => !v) }}
                          className="text-amber-700 dark:text-yellow-400 hover:text-amber-700 dark:text-yellow-300 text-base leading-none"
                          aria-label="What is the favorites column?"
                          title="What is this?"
                        >
                          ★
                        </button>
                        {showFavTooltip && (
                          <div className="absolute left-0 top-7 z-30 w-60 rounded-lg border border-border bg-card shadow-xl p-3 text-xs text-foreground/80 normal-case font-normal">
                            Click the star next to any row to favorite it. With <span className="text-amber-700 dark:text-yellow-400 font-semibold">★ Favorites first</span> on (toolbar above), favorited rows pin to the top of any sort.
                          </div>
                        )}
                      </div>
                    ) : (
                      <span
                        className="truncate flex items-center gap-1"
                        title={col.tooltip ? `${col.tooltip} · click header to sort` : 'Click header to sort'}
                      >
                        {!isLocked && <span className="text-muted-foreground/70 text-xs">⠿</span>}
                        {col.label}
                        {col.id === 'status' && (
                          <span
                            ref={statusTooltipRef}
                            className="relative inline-flex ml-1"
                            data-no-sort
                            onMouseEnter={() => setShowStatusTooltip(true)}
                            onMouseLeave={() => setShowStatusTooltip(false)}
                          >
                            <button
                              type="button"
                              data-no-sort
                              draggable={false}
                              onDragStart={(ev) => ev.preventDefault()}
                              onMouseDown={(e) => { e.stopPropagation() }}
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowStatusTooltip(v => !v) }}
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-purple-500/40 text-purple-700 dark:text-purple-400 text-[10px] font-bold hover:bg-purple-500/15 transition-colors leading-none"
                              aria-label="What does Status do?"
                              title="Status info — hover or click to see"
                            >i</button>
                            {showStatusTooltip && (
                              <div className="absolute left-0 top-6 z-30 w-80 rounded-lg border border-border bg-card shadow-xl p-3 text-xs text-foreground/80 normal-case font-normal space-y-2">
                                <div>
                                  <strong className="text-foreground">Status drives the Follow-ups tab.</strong> Each status maps to a state in your follow-up pipeline:
                                </div>
                                <ul className="space-y-1 ml-1">
                                  <li>
                                    <span className="text-muted-foreground">Not Outreached</span> — not on the follow-up board.
                                  </li>
                                  <li>
                                    <span className="text-amber-700 dark:text-yellow-400 font-medium">No Response</span> — sent, awaiting reply. Auto-schedules a follow-up date (3d → 7d → 14d → 21d as touchpoints accumulate).
                                  </li>
                                  <li>
                                    <span className="text-blue-700 dark:text-blue-400 font-medium">Open</span> — they replied positively, conversation is live. Stays on the follow-up board with a fresh date.
                                  </li>
                                  <li>
                                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">Successful</span> — closed/won. Drops off the follow-up board. Pops confetti 🎉.
                                  </li>
                                  <li>
                                    <span className="text-red-700 dark:text-red-400 font-medium">Rejected</span> — declined. Drops off the follow-up board.
                                  </li>
                                </ul>
                                <div className="text-[11px] text-muted-foreground italic pt-1 border-t border-border">
                                  Clicking the green email link sets status to <span className="text-amber-700 dark:text-yellow-400 font-medium">No Response</span> automatically — no manual change needed.
                                </div>
                              </div>
                            )}
                          </span>
                        )}
                        {sort.col === col.id && (
                          <span className="text-purple-700 dark:text-purple-400 text-[10px] ml-0.5" aria-label={sort.dir}>
                            {sort.dir === 'desc' ? '↓' : '↑'}
                          </span>
                        )}
                        {colId === 'email' && (() => {
                          const pending = entries.filter(e => !e.email).length
                          if (pending === 0 && !bulkRunning) return null
                          return (
                            <button
                              data-no-sort
                              onClick={(ev) => { ev.stopPropagation(); onSearchAll() }}
                              disabled={bulkRunning}
                              draggable={false}
                              onDragStart={(ev) => ev.preventDefault()}
                              title={`Refresh emails for ${pending} row${pending === 1 ? '' : 's'} still missing one. ~10s each, 3 in parallel.`}
                              className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded text-purple-700 dark:text-purple-400 hover:text-foreground hover:bg-purple-500/20 transition-colors disabled:opacity-60 disabled:cursor-wait"
                              aria-label={`Refresh ${pending} missing emails`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${bulkRunning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )
                        })()}
                      </span>
                    )}
                    <div data-no-sort onMouseDown={e => startResize(e, colId)} className="absolute right-0 top-0 h-full w-2 cursor-col-resize group flex items-center justify-center">
                      <div className="w-px h-4 bg-gray-600 group-hover:bg-blue-400 transition-colors" />
                    </div>
                  </th>
                )
              })}
              <th style={{ width: 36 }} className="px-3 py-3" />
            </tr>
          </thead>
          {/*
            Per taste-skill Rule 4 "Anti-Card Overuse": at this density
            (>7), generic card containers BANNED. Each row used to be a
            zebra-striped card (bg-card/40 / bg-background). Replaced
            with divide-y rule lines + subtle hover wash. Reads tighter,
            more "operator dashboard" less "marketing card grid."
          */}
          <tbody className="divide-y divide-border">
            {sortedEntries.map((e, i) => {
              // Subtle highlight for newly-added rows. Stops rendering
              // on the first user click anywhere in the row (via the
              // onMouseDownCapture handler below) — the row stays
              // pinned at top until the next sort change, but the
              // visual flair fades so the table calms down once the
              // operator has acknowledged it.
              const isJustAdded = recentlyAddedIds.has(e.id) && !interactedNewIds.has(e.id)
              return (
              <AnimatedRow
                key={e.id}
                index={i}
                onMouseDownCapture={() => {
                  // Capture phase fires before any inner control's
                  // own click — guarantees the highlight fades on the
                  // first interaction even if the click lands on a
                  // dropdown or button cell. No-op if not currently
                  // pinned-new (cheap check inside the parent).
                  if (recentlyAddedIds.has(e.id) && !interactedNewIds.has(e.id)) {
                    onMarkNewInteracted(e.id)
                  }
                }}
                className={`transition-colors hover:bg-card/40 ${isJustAdded ? 'bg-purple-500/10 dark:bg-purple-500/15' : ''}`}
              >
                {visibleCols.map(col => (
                  <td key={col.id as string} className="px-3 py-2 align-top" style={{ width: widths[col.id as string] ?? col.defaultWidth }}>
                    {renderOutreachCell(col, e, onUpdate, profile, searchingIds.has(e.id), onSearchContacts)}
                  </td>
                ))}
                <td className="px-3 py-2 align-top whitespace-nowrap" style={{ width: 60 }}>
                  <div className="flex items-center gap-2">
                    {onOpenEntry && (
                      <button
                        onClick={() => onOpenEntry(e.id)}
                        className="text-muted-foreground/60 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                        title="Edit lead — open detail panel for full inline edits"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    <button onClick={() => onRemove(e.id)} className="text-muted-foreground/50 hover:text-red-700 dark:text-red-400 transition-colors" title="Remove from outreach"><TrashIcon /></button>
                  </div>
                </td>
              </AnimatedRow>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Context menu — right-click on any column header opens this. */}
      {headerMenu && (() => {
        // Compute move-left/right enablement against the visible
        // column ordering (the locked 'favorite' column stays at
        // index 0; user-visible columns start at index 1).
        const visibleIds = colConfig.filter(c => c.visible).map(c => c.id)
        const idx = visibleIds.indexOf(headerMenu.colId)
        const canMoveLeft = idx > 1 // can't move past the locked col 0
        const canMoveRight = idx >= 0 && idx < visibleIds.length - 1
        const swap = (delta: -1 | 1) => {
          const target = idx + delta
          if (target < 1 || target >= visibleIds.length) return
          const reordered = [...visibleIds]
          ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
          // Rebuild full colConfig: visible columns in new order, then hidden columns at the end.
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
            // 'favorite' is the locked leftmost column — can't hide it.
            canHide={headerMenu.colId !== 'favorite'}
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
            onCustomize={onOpenCustomize}
            onClose={() => setHeaderMenu(null)}
          />
        )
      })()}
    </div>
  )
}

/**
 * Pill-style toggle that controls whether favorited rows pin to the
 * top of the current sort. Default ON — preserves the v2 "favorites
 * are special" UX after we dropped the dedicated tab. Count subtly
 * shown so the user knows whether the toggle is doing anything.
 */
function FavoritesFirstToggle({
  active, onChange, favoritedCount,
}: {
  active: boolean
  onChange: (next: boolean) => void
  favoritedCount: number
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      aria-pressed={active}
      title={active
        ? 'Favorited rows are pinned to the top of any sort. Click to disable.'
        : 'Click to pin favorited rows to the top of any sort.'}
      className={[
        'inline-flex items-center gap-1.5 text-xs rounded-md px-3 py-1.5 border transition-colors',
        active
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-yellow-300 hover:bg-amber-500/15'
          : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80',
      ].join(' ')}
    >
      <span className={active ? 'text-amber-700 dark:text-yellow-400 text-sm leading-none' : 'text-sm leading-none'}>★</span>
      <span>Favorites first</span>
      {favoritedCount > 0 && (
        <span className={active ? 'tabular-nums text-amber-700/70 dark:text-yellow-400/70' : 'tabular-nums text-muted-foreground/65'}>
          ({favoritedCount})
        </span>
      )}
    </button>
  )
}
