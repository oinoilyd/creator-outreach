'use client'

import { useEffect, useState } from 'react'
import {
  CATALOG_STEPS,
  TIER_META,
  stepsForTier,
  type TutorialTier,
  type CatalogStep,
} from '@/lib/tutorial-catalog'

/**
 * TutorialPreviewClient — admin scrub tool. Tier tabs, step list,
 * detail pane. No app interaction; pure read-only inspection of the
 * canonical catalog.
 *
 * Highlights:
 *   • Tier counts at top so you can see how each tier sizes up.
 *   • Missing-anchor warning per step — fetches the live DOM at
 *     mount and flags any step whose target selector misses. Helps
 *     catch "I shipped a step but forgot the data-tour-id" before
 *     a real user hits it.
 *   • Click a step → full body + onEnter signature + tier badges.
 */
export function TutorialPreviewClient() {
  const [tier, setTier] = useState<TutorialTier>('short')
  const [includeAdmin, setIncludeAdmin] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const steps = stepsForTier(tier, { isAdmin: includeAdmin })
  const selected = selectedId
    ? CATALOG_STEPS.find(s => s.id === selectedId) ?? null
    : null

  // Anchor presence check — for each catalog step with a non-null
  // target, see if the selector matches anything in the live DOM.
  // Runs once on mount; results are static for the session. Most
  // anchors live on the main app page (/), not /admin, so most will
  // show as missing here — that's expected. The preview is useful
  // for catching TYPOS in selectors (`[data-tour-id="serach-input"]`)
  // and steps shipped without a matching data-tour-id at all.
  const [missingAnchors, setMissingAnchors] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (typeof window === 'undefined') return
    const missing = new Set<string>()
    for (const step of CATALOG_STEPS) {
      if (!step.target) continue
      try {
        if (!document.querySelector(step.target)) {
          missing.add(step.id)
        }
      } catch {
        // Invalid selector — flag it.
        missing.add(step.id)
      }
    }
    setMissingAnchors(missing)
  }, [])

  return (
    <div className="space-y-4">
      {/* Tier selector + admin toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {(['short', 'pro', 'granular'] as const).map(t => {
            const meta = TIER_META[t]
            const count = stepsForTier(t, { isAdmin: includeAdmin }).length
            const isActive = tier === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setTier(t); setSelectedId(null) }}
                className={[
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {meta.label}
                <span className={isActive ? 'opacity-70' : 'opacity-60'}>·</span>
                <span className="tabular-nums">{count}</span>
              </button>
            )
          })}
        </div>
        <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={includeAdmin}
            onChange={e => setIncludeAdmin(e.target.checked)}
            className="rounded accent-purple-500"
          />
          Include admin-only steps
        </label>
        <div className="ml-auto text-[12px] text-muted-foreground">
          {missingAnchors.size > 0 && (
            <span className="text-amber-700 dark:text-amber-300">
              ⚠ {missingAnchors.size} step{missingAnchors.size === 1 ? '' : 's'} have missing DOM anchors
            </span>
          )}
        </div>
      </div>

      {/* Tier meta strip */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">
            {TIER_META[tier].label}
          </h2>
          <span className="text-[12px] text-muted-foreground">{TIER_META[tier].duration}</span>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground max-w-[80ch]">
          {TIER_META[tier].pitch}
        </p>
      </div>

      {/* Two-column: step list + detail pane */}
      <div className="grid md:grid-cols-[1fr_1.4fr] gap-4">
        {/* Step list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            {steps.length} step{steps.length === 1 ? '' : 's'}
          </div>
          <ol className="divide-y divide-border">
            {steps.map((step, i) => {
              const isMissing = missingAnchors.has(step.id)
              const isSelected = selectedId === step.id
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(step.id)}
                    className={[
                      'w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors',
                      isSelected ? 'bg-muted' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold tabular-nums shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-foreground leading-tight truncate">
                          {step.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                          {step.tiers.map(t => (
                            <span
                              key={t}
                              className="inline-block px-1.5 py-0.5 rounded text-[9.5px] uppercase tracking-wider font-bold bg-background border border-border text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                          {step.adminOnly && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9.5px] uppercase tracking-wider font-bold bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300">
                              admin
                            </span>
                          )}
                          {isMissing && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9.5px] uppercase tracking-wider font-bold bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-300">
                              ⚠ anchor missing
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Detail pane */}
        <div className="rounded-xl border border-border bg-card p-4 min-h-[300px]">
          {!selected ? (
            <div className="text-center text-[13px] text-muted-foreground py-12">
              Pick a step to inspect its body, target selector, and tier coverage.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                  Step ID
                </div>
                <div className="font-mono text-[13px] text-foreground">{selected.id}</div>
              </div>

              <div>
                <div className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                  Title
                </div>
                <div className="text-[16px] font-bold text-foreground">{selected.title}</div>
              </div>

              <div>
                <div className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                  Body
                </div>
                <div className="text-[14px] text-foreground/90 leading-relaxed">{selected.body}</div>
              </div>

              <div>
                <div className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                  Target selector
                </div>
                {selected.target ? (
                  <div className="font-mono text-[12px] text-foreground bg-muted/40 px-2 py-1 rounded inline-block">
                    {selected.target}
                  </div>
                ) : (
                  <span className="text-[12px] text-muted-foreground italic">
                    centered modal (no anchor)
                  </span>
                )}
                {selected.target && missingAnchors.has(selected.id) && (
                  <div className="mt-2 text-[12px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded px-2.5 py-1.5">
                    ⚠ This selector does not match anything in the current DOM. Either the element isn't mounted on this page (try navigating to the step's onEnter target first), or the data-tour-id attribute hasn't been added to the UI yet.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                    Tiers
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selected.tiers.map(t => (
                      <span
                        key={t}
                        className="inline-block px-1.5 py-0.5 rounded text-[10.5px] uppercase tracking-wider font-bold bg-muted text-foreground/80"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                    Properties
                  </div>
                  <div className="space-y-0.5 text-[11.5px] text-muted-foreground">
                    {selected.placement && <div>placement: {selected.placement}</div>}
                    {selected.nextLabel && <div>nextLabel: "{selected.nextLabel}"</div>}
                    {selected.previewSketch && <div>previewSketch: {selected.previewSketch}</div>}
                    {selected.adminOnly && <div className="text-purple-700 dark:text-purple-300">admin-only</div>}
                    {!selected.onEnter && !selected.placement && !selected.previewSketch && !selected.nextLabel && (
                      <div className="italic">none</div>
                    )}
                  </div>
                </div>
              </div>

              {selected.onEnter && (
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                    onEnter side-effect
                  </div>
                  <div className="text-[12px] text-muted-foreground italic">
                    Fires a navigate() call to ferry the user to the right tab/sub-tab
                    before the spotlight aligns.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
