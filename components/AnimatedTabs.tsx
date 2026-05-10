'use client'

import { motion } from 'motion/react'
import { ReactNode, KeyboardEvent, useRef } from 'react'

/**
 * A WCAG-compliant tab strip with a sliding underline (or pill)
 * driven by motion's layoutId. Used in two places in the app:
 *   - Main tabs: Results / Outreach / Dismissed (variant="underline")
 *   - Outreach sub-tabs: All / Favorites / Follow-ups / Analytics
 *     (variant="pill")
 *
 * What changed (2026-05-09): added real ARIA tab semantics + arrow-
 * key navigation. The previous version emitted bare <button>s with no
 * role="tablist" / role="tab" / aria-selected. Screen readers
 * announced "Outreach (12), button" with no indication of selected
 * state or that this was a tab group, and keyboard users could only
 * use Tab (not Arrow keys, which is the established convention for
 * tab strips).
 *
 * Consumers should wrap their conditional panel content in
 *   <div role="tabpanel" id={tabPanelId(layoutGroup, currentTabId)}
 *        aria-labelledby={tabId(layoutGroup, currentTabId)}>
 *     ...content...
 *   </div>
 *
 * The exported helpers below produce stable IDs that match the
 * aria-controls / id pair the buttons emit.
 */

export function tabId(layoutGroup: string, id: string) {
  return `tab-${layoutGroup}-${id}`
}
export function tabPanelId(layoutGroup: string, id: string) {
  return `tabpanel-${layoutGroup}-${id}`
}

export function AnimatedTabs<T extends string>({
  tabs,
  active,
  onChange,
  variant = 'underline',
  layoutGroup,
  ariaLabel,
}: {
  tabs: { id: T; label: ReactNode }[]
  active: T
  onChange: (id: T) => void
  variant?: 'underline' | 'pill'
  layoutGroup: string
  /** Visible text describing what this tab strip controls. Sets the
   *  tablist's accessible name. Defaults to a generic label derived
   *  from layoutGroup so screen readers always announce something
   *  meaningful. */
  ariaLabel?: string
}) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([])
  const accessibleLabel = ariaLabel ?? humanizeLayoutGroup(layoutGroup)

  /**
   * Roving tabindex: only the active tab is in the tab order
   * (tabIndex=0). Inactive tabs are tabIndex=-1, reachable only via
   * the arrow keys. Standard tablist pattern from the WAI-ARIA
   * Authoring Practices.
   */
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    let nextIdx: number | null = null
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIdx = idx > 0 ? idx - 1 : tabs.length - 1
        break
      case 'ArrowRight':
      case 'ArrowDown':
        nextIdx = idx < tabs.length - 1 ? idx + 1 : 0
        break
      case 'Home':
        nextIdx = 0
        break
      case 'End':
        nextIdx = tabs.length - 1
        break
      default:
        return
    }
    e.preventDefault()
    onChange(tabs[nextIdx].id)
    // Focus moves with the active state — required so the user can
    // continue arrow-keying without re-tabbing back into the strip.
    requestAnimationFrame(() => buttonsRef.current[nextIdx!]?.focus())
  }

  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        aria-label={accessibleLabel}
        aria-orientation="horizontal"
        className="flex flex-wrap gap-1"
      >
        {tabs.map((t, idx) => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              ref={el => { buttonsRef.current[idx] = el }}
              role="tab"
              type="button"
              id={tabId(layoutGroup, t.id)}
              aria-selected={isActive}
              aria-controls={tabPanelId(layoutGroup, t.id)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={e => onKeyDown(e, idx)}
              className={`relative px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:ring-offset-1 ${
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isActive && (
                <motion.span
                  aria-hidden
                  layoutId={`${layoutGroup}-pill-bg`}
                  className="absolute inset-0 rounded-full bg-muted border border-border"
                  transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // underline (default)
  return (
    <div
      role="tablist"
      aria-label={accessibleLabel}
      aria-orientation="horizontal"
      className="flex gap-1 relative"
    >
      {tabs.map((t, idx) => {
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            ref={el => { buttonsRef.current[idx] = el }}
            role="tab"
            type="button"
            id={tabId(layoutGroup, t.id)}
            aria-selected={isActive}
            aria-controls={tabPanelId(layoutGroup, t.id)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={e => onKeyDown(e, idx)}
            className={`relative px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:rounded-md ${
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            {t.label}
            {isActive && (
              <motion.span
                aria-hidden
                layoutId={`${layoutGroup}-underline`}
                className="absolute left-3 right-3 -bottom-px h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Make a kebab/snake layoutGroup readable as a screen-reader label.
 *  "main-tabs" → "Main tabs". Cheap fallback when ariaLabel is unset. */
function humanizeLayoutGroup(g: string): string {
  const cleaned = g.replace(/[-_]+/g, ' ').trim()
  if (!cleaned) return 'Tabs'
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
