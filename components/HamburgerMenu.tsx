'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTheme } from 'next-themes'
import { BACKDROP_THEMES, type BackdropTheme } from '@/lib/backdrop-themes'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export function HamburgerMenu({
  userEmail,
  userFullName,
  onOpenScoreSettings,
  onOpenProfile,
  onOpenTemplates,
  onImportOutreach,
  onImportDismissed,
  showRetryMigration,
  onRetryMigration,
  backdropTheme,
  onBackdropThemeChange,
  onTriggerSpotlight,
  spotlightActive,
  backdropDurationSec,
  onBackdropDurationChange,
  spotlightAlwaysOn,
  onSpotlightAlwaysOnChange,
  subscriptionHref,
  subscriptionLabel,
}: {
  userEmail: string | null
  userFullName: string | null
  onOpenScoreSettings: () => void
  onOpenProfile: () => void
  /** Opens the per-platform Templates editor — see components/TemplatesModal.tsx.
   *  Lets users tailor email + DM templates per platform, and toggle the
   *  CAN-SPAM footer on/off (with acknowledgment when disabling). */
  onOpenTemplates?: () => void
  onImportOutreach?: () => void
  onImportDismissed?: () => void
  showRetryMigration?: boolean
  onRetryMigration?: () => void
  /** Per Dylan 2026-05-10: backdrop theme picker lives next to the
   *  dark/light toggle since both are visual settings. */
  backdropTheme?: BackdropTheme
  onBackdropThemeChange?: (theme: BackdropTheme) => void
  /** Spotlight: 15-second foreground burst of the active theme at
   *  full saturation. One-shot trigger; parent owns the timer. */
  onTriggerSpotlight?: () => void
  spotlightActive?: boolean
  /** User-configurable wave duration. 0 means 'always on' (no fade). */
  backdropDurationSec?: number
  onBackdropDurationChange?: (sec: number) => void
  /** Always-on visual intensity boost. When true (default), Rain/Drift
   *  render at boosted opacity always. Doesn't affect one-shot themes. */
  spotlightAlwaysOn?: boolean
  onSpotlightAlwaysOnChange?: (on: boolean) => void
  /** Pricing menu entry — href is /pricing for users without a sub,
   *  or a portal-trigger href when they have one. Parent owns the
   *  click semantics (it can override onClick if needed). When undefined
   *  the menu item is hidden — e.g. when Stripe isn't configured. */
  subscriptionHref?: string | null
  subscriptionLabel?: { cta: string; status: string } | null
}) {
  const [open, setOpen] = useState(false)
  const [importExpanded, setImportExpanded] = useState(false)
  // Themes-section gear popover. Per Dylan 2026-05-10 v2: replaces
  // the inline subtitle ("Picks up the active platform's color...")
  // with a gear icon that toggles a small controls panel.
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false)
  // Per Dylan 2026-05-11: collapse the themes section by default —
  // 'Themes' header is clickable to expand/collapse so the menu
  // doesn't bloat for users not actively switching themes.
  const [themesExpanded, setThemesExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()
  const [themeMounted, setThemeMounted] = useState(false)
  useEffect(() => setThemeMounted(true), [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setImportExpanded(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function signOut() {
    setOpen(false)
    await fetch('/auth/signout', { method: 'POST' })
    window.location.href = '/auth/signin'
  }

  const initials = (userFullName || userEmail || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('') || '?'

  // The "Import" item shows sub-options (Outreach, Dismissed, Retry migration)
  // when expanded inline.
  const importChildren: { label: string; sublabel?: string; onClick: () => void }[] = []
  if (onImportOutreach) {
    importChildren.push({
      label: 'Outreach',
      sublabel: '.xlsx with Channel Name + YouTube URL',
      onClick: () => { onImportOutreach(); setOpen(false); setImportExpanded(false) },
    })
  }
  if (onImportDismissed) {
    importChildren.push({
      label: 'Dismissed',
      sublabel: '.xlsx with Channel Name + YouTube URL',
      onClick: () => { onImportDismissed(); setOpen(false); setImportExpanded(false) },
    })
  }
  if (showRetryMigration && onRetryMigration) {
    importChildren.push({
      label: 'Retry data migration',
      sublabel: "If your old data didn't appear",
      onClick: () => { onRetryMigration(); setOpen(false); setImportExpanded(false) },
    })
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => { setOpen(v => !v); setImportExpanded(false) }}
        className={`flex flex-col gap-1.5 p-2 rounded-lg border transition-colors ${open ? 'bg-muted border-border text-foreground' : 'bg-card border-border text-muted-foreground hover:border-border hover:text-foreground'}`}
        title="Menu"
      >
        <span className="block w-5 h-px bg-current rounded" />
        <span className="block w-5 h-px bg-current rounded" />
        <span className="block w-5 h-px bg-current rounded" />
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ type: 'spring', bounce: 0.18, duration: 0.3 }}
          className="absolute right-0 top-11 w-64 max-h-[calc(100vh-5rem)] bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl shadow-black/40 z-50 overflow-y-auto overflow-x-hidden overscroll-contain py-1"
        >
          {(userEmail || userFullName) && (
            <>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  {userFullName ? (
                    <>
                      <div className="text-sm font-medium text-foreground truncate">{userFullName}</div>
                      {userEmail && <div className="text-[11px] text-muted-foreground truncate">{userEmail}</div>}
                    </>
                  ) : (
                    userEmail && <div className="text-sm text-foreground truncate">{userEmail}</div>
                  )}
                </div>
              </div>
              <div className="mx-4 border-t border-border" />
            </>
          )}

          {/* Lead Criteria */}
          <button
            onClick={() => { onOpenScoreSettings(); setOpen(false) }}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
          >
            <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </span>
            <div className="min-w-0">
              <div className="text-sm text-foreground font-medium leading-tight">Lead Criteria</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">Scoring weights & AI filters</div>
            </div>
          </button>

          {/* Profile */}
          <button
            onClick={() => { onOpenProfile(); setOpen(false) }}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
          >
            <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </span>
            <div className="min-w-0">
              <div className="text-sm text-foreground font-medium leading-tight">Profile</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">Name, LinkedIn, pitch line</div>
            </div>
          </button>

          {/* Templates — per-platform message editor. Slots directly under
              Profile because the templates inherit profile fields (name,
              pitch, LinkedIn) and most users will want to set both
              together. Hidden when no handler is passed so we don't break
              older callers. */}
          {onOpenTemplates && (
            <button
              onClick={() => { onOpenTemplates(); setOpen(false) }}
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
            >
              <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-sm text-foreground font-medium leading-tight">Templates</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">Email + DM drafts per platform</div>
              </div>
            </button>
          )}

          {/* Import (expandable) */}
          {importChildren.length > 0 && (
            <>
              <div className="mx-4 my-1 border-t border-border" />
              <button
                onClick={() => setImportExpanded(v => !v)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
              >
                <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground font-medium leading-tight">Import</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">Upload an Excel export</div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-4 h-4 text-muted-foreground mt-0.5 shrink-0 transition-transform ${importExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                ><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {importExpanded && (
                <div className="bg-background/50">
                  {importChildren.map((c, i) => (
                    <button
                      key={i}
                      onClick={c.onClick}
                      className="w-full pl-12 pr-4 py-2.5 text-left hover:bg-muted transition-colors block"
                    >
                      <div className="text-sm text-foreground leading-tight">{c.label}</div>
                      {c.sublabel && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.sublabel}</div>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {userEmail === ADMIN_EMAIL && (
            <>
              <div className="mx-4 my-1 border-t border-border" />
              <a
                href="/admin"
                onClick={() => setOpen(false)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
              >
                <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-foreground font-medium leading-tight">Admin</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">Users + usage</div>
                </div>
              </a>
              {/* "Seed test data" was here until 2026-05-11 — moved to
                  /admin/page.tsx so all admin dev tools live together
                  and the user-app menu stays clean. */}
            </>
          )}

          <div className="mx-4 my-1 border-t border-border" />

          {/* Theme toggle */}
          {themeMounted && (
            <button
              onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setOpen(false) }}
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
            >
              <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
                {theme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground font-medium leading-tight">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">Switch interface theme</div>
              </div>
            </button>
          )}

          {/* Themes picker — sits next to dark/light because both are
              visual settings (Dylan 2026-05-10). Renamed from
              'Backdrop' → 'Themes' in v3 to reflect the broader set of
              effects (Rain/Drift/Fireworks/Tornado). The descriptive
              subtitle is now hidden behind a small gear icon that
              opens a settings panel (duration etc.) so the menu stays
              compact. */}
          {onBackdropThemeChange && (
            <div className="px-4 py-3 border-t border-border/60">
              <div className="flex items-start gap-3">
                <span className="text-muted-foreground mt-0.5 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  {/* Header row — clicking 'Themes' toggles the
                      whole section. Per Dylan 2026-05-11: keep the
                      menu compact when not actively switching themes.
                      Gear icon (theme settings) only shows when
                      expanded. */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setThemesExpanded(v => {
                          const next = !v
                          if (!next) setThemeSettingsOpen(false)
                          return next
                        })
                      }}
                      aria-expanded={themesExpanded}
                      className="flex-1 flex items-center justify-between gap-1.5 -mx-1 px-1 py-0.5 rounded text-left hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-sm text-foreground font-medium leading-tight">Themes</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${themesExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {themesExpanded && onBackdropDurationChange && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setThemeSettingsOpen(v => !v) }}
                        title="Theme settings — change how long the wave stays before fading."
                        aria-label="Theme settings"
                        aria-expanded={themeSettingsOpen}
                        className={`p-1 rounded transition-colors ${
                          themeSettingsOpen
                            ? 'text-foreground bg-muted/60'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Collapsible body — everything below the header
                      shows/hides on Themes click. */}
                  <AnimatePresence initial={false}>
                    {themesExpanded && (
                      <motion.div
                        key="themes-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2">

                  {/* Theme-settings panel — collapsible under the gear.
                      Per Dylan: duration is the main knob; 0s = always on. */}
                  <AnimatePresence initial={false}>
                    {themeSettingsOpen && onBackdropDurationChange && (
                      <motion.div
                        key="theme-settings"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden mb-2"
                      >
                        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 space-y-2.5">
                          {/* Always-on intensity toggle — per Dylan
                              2026-05-10 v6: spotlight defaults ON so
                              Rain/Drift render at full saturation. */}
                          {onSpotlightAlwaysOnChange && (
                            <label className="flex items-center justify-between gap-2 cursor-pointer group">
                              <span className="text-[11px] text-muted-foreground group-hover:text-foreground/80 transition-colors">
                                Always full saturation
                              </span>
                              <span
                                role="switch"
                                aria-checked={spotlightAlwaysOn ?? true}
                                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full transition-colors ${
                                  (spotlightAlwaysOn ?? true)
                                    ? 'bg-purple-500'
                                    : 'bg-muted-foreground/30'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSpotlightAlwaysOnChange(!(spotlightAlwaysOn ?? true))
                                }}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition-transform ${
                                    (spotlightAlwaysOn ?? true) ? 'translate-x-3.5' : 'translate-x-0.5'
                                  } mt-0.5`}
                                />
                              </span>
                            </label>
                          )}

                          <div className="flex items-center justify-between gap-2">
                            <label htmlFor="backdrop-duration" className="text-[11px] text-muted-foreground">
                              Fade after
                            </label>
                            <span className="text-[11px] font-medium text-foreground tabular-nums">
                              {(backdropDurationSec ?? 30) === 0
                                ? 'Always on'
                                : `${backdropDurationSec ?? 30}s`}
                            </span>
                          </div>
                          <input
                            id="backdrop-duration"
                            type="range"
                            min={0}
                            max={120}
                            step={5}
                            value={backdropDurationSec ?? 30}
                            onChange={(e) => { e.stopPropagation(); onBackdropDurationChange(parseInt(e.target.value, 10)) }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full accent-purple-500"
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground/80 -mt-1">
                            <span>Always</span>
                            <span>30s</span>
                            <span>2m</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground/80 leading-snug pt-1 border-t border-border/40">
                            Wave picks up the active platform&apos;s color and re-fires on theme/platform change, returning to Results, or hitting Find creators.
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex flex-wrap gap-1">
                    {BACKDROP_THEMES.map(t => {
                      const isActive = (backdropTheme ?? 'off') === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onBackdropThemeChange(t.id) }}
                          title={t.description}
                          className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                            isActive
                              ? 'bg-purple-500/15 border-purple-500/40 text-foreground font-medium'
                              : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                          }`}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                  {/* Spotlight — foreground burst at full saturation.
                      Duration is theme-aware (parent supplies the
                      correct length for one-shot themes like
                      Fireworks/Tornado). Disabled when theme is Off. */}
                  {onTriggerSpotlight && (
                    <button
                      type="button"
                      disabled={spotlightActive || (backdropTheme ?? 'off') === 'off'}
                      onClick={(e) => { e.stopPropagation(); onTriggerSpotlight() }}
                      title={(backdropTheme ?? 'off') === 'off'
                        ? 'Pick a theme first.'
                        : 'Show the effect in front of everything else at full saturation.'}
                      className={`mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        spotlightActive
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-200 cursor-wait'
                          : (backdropTheme ?? 'off') === 'off'
                            ? 'border-border text-muted-foreground/40 cursor-not-allowed'
                            : 'border-border text-foreground hover:bg-muted/60 hover:border-foreground/40'
                      }`}
                    >
                      {spotlightActive ? '✨ Showing…' : '✨ Spotlight'}
                    </button>
                  )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          <div className="mx-4 my-1 border-t border-border" />

          {/* Pricing — between Themes and Legal per Dylan 2026-05-11.
              Surfaces the upgrade flow from inside the app without
              forcing users back to the marketing site. The badge under
              the label reflects current subscription state when
              available (parent passes subscriptionLabel). */}
          {subscriptionHref && (
            <a
              href={subscriptionHref}
              onClick={() => setOpen(false)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
            >
              <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-sm text-foreground font-medium leading-tight">
                  {subscriptionLabel?.cta ?? 'Pricing'}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {subscriptionLabel?.status ?? 'Plans & checkout'}
                </div>
              </div>
            </a>
          )}

          {subscriptionHref && <div className="mx-4 my-1 border-t border-border" />}

          {/* Roadmap — same surface that's reachable from the public
              landing page nav (post-signin). Surfaces what's shipped /
              paused / coming next so users can see momentum and vote
              on what to build. Same /roadmap URL whether reached from
              inside the app or from the marketing site. */}
          <a
            href="/roadmap"
            onClick={() => setOpen(false)}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
          >
            <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="text-sm text-foreground font-medium leading-tight">Roadmap</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">What we&apos;re validating and shipping next</div>
            </div>
          </a>

          <div className="mx-4 my-1 border-t border-border" />

          {/* Contact Us */}
          <button
            onClick={() => { window.open('mailto:dmeehanj@gmail.com', '_blank'); setOpen(false) }}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
          >
            <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </span>
            <div className="min-w-0">
              <div className="text-sm text-foreground font-medium leading-tight">Contact Us</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">Questions or feedback</div>
            </div>
          </button>

          {/* Legal — Terms / Privacy / Refunds / Cookies. Compact
              inline row so the menu doesn't bloat. Per Dylan
              2026-05-11: legal docs need to be reachable from the
              authenticated app, not just the landing page footer. */}
          <div className="px-4 pt-3 pb-2 border-t border-border/60">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <div className="text-sm text-foreground font-medium leading-tight">Legal</div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pl-6 text-[11px]">
              <a href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms</a>
              <a href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
              <a href="/refunds" className="text-muted-foreground hover:text-foreground transition-colors">Refunds</a>
              <a href="/security" className="text-muted-foreground hover:text-foreground transition-colors">Security</a>
              <a href="/subprocessors" className="text-muted-foreground hover:text-foreground transition-colors">Subprocessors</a>
              <a href="/support" className="text-muted-foreground hover:text-foreground transition-colors">Support</a>
              <a href="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">Cookies</a>
            </div>
          </div>

          <div className="mx-4 my-1 border-t border-border" />

          {/* Sign out */}
          <button
            onClick={signOut}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
          >
            <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </span>
            <div className="min-w-0">
              <div className="text-sm text-foreground font-medium leading-tight">Sign out</div>
            </div>
          </button>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
