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
  onImportOutreach,
  onImportDismissed,
  showRetryMigration,
  onRetryMigration,
  onSeedTestData,
  backdropTheme,
  onBackdropThemeChange,
  onTriggerSpotlight,
  spotlightActive,
}: {
  userEmail: string | null
  userFullName: string | null
  onOpenScoreSettings: () => void
  onOpenProfile: () => void
  onImportOutreach?: () => void
  onImportDismissed?: () => void
  showRetryMigration?: boolean
  onRetryMigration?: () => void
  onSeedTestData?: () => void
  /** Per Dylan 2026-05-10: backdrop theme picker lives next to the
   *  dark/light toggle since both are visual settings. */
  backdropTheme?: BackdropTheme
  onBackdropThemeChange?: (theme: BackdropTheme) => void
  /** Spotlight: 15-second foreground burst of the active theme at
   *  full saturation. One-shot trigger; parent owns the timer. */
  onTriggerSpotlight?: () => void
  spotlightActive?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [importExpanded, setImportExpanded] = useState(false)
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
          className="absolute right-0 top-11 w-64 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden py-1"
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
              {onSeedTestData && (
                <button
                  onClick={() => { onSeedTestData(); setOpen(false) }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
                >
                  <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-foreground font-medium leading-tight">Seed test data</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">~100 real creators with random statuses</div>
                  </div>
                </button>
              )}
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

          {/* Backdrop theme picker — sits next to dark/light because
              both are visual settings (Dylan 2026-05-10). Inline pill
              row, no thumbnails — the hamburger menu is narrow so
              keeping it compact reads better than the 5-thumbnail
              picker that lived in ProfileModal. */}
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
                  <div className="text-sm text-foreground font-medium leading-tight mb-1">Backdrop</div>
                  <div className="text-[11px] text-muted-foreground mb-2 leading-snug">Picks up the active platform&apos;s color. Fades after 30s or on first action.</div>
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
                  {/* Spotlight — 15-second foreground burst at full
                      saturation. Per Dylan 2026-05-10. Disabled when
                      theme is Off (nothing to spotlight). */}
                  {onTriggerSpotlight && (
                    <button
                      type="button"
                      disabled={spotlightActive || (backdropTheme ?? 'off') === 'off'}
                      onClick={(e) => { e.stopPropagation(); onTriggerSpotlight() }}
                      title={(backdropTheme ?? 'off') === 'off'
                        ? 'Pick a backdrop theme first.'
                        : 'Show the effect in front of everything else at full saturation for 15 seconds.'}
                      className={`mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        spotlightActive
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-200 cursor-wait'
                          : (backdropTheme ?? 'off') === 'off'
                            ? 'border-border text-muted-foreground/40 cursor-not-allowed'
                            : 'border-border text-foreground hover:bg-muted/60 hover:border-foreground/40'
                      }`}
                    >
                      {spotlightActive ? '✨ Showing… (15s)' : '✨ Spotlight (15s)'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

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
