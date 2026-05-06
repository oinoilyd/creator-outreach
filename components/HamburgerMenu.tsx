'use client'

import React, { useState, useRef, useEffect } from 'react'

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
}: {
  userEmail: string | null
  userFullName: string | null
  onOpenScoreSettings: () => void
  onOpenProfile: () => void
  onImportOutreach?: () => void
  onImportDismissed?: () => void
  showRetryMigration?: boolean
  onRetryMigration?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [importExpanded, setImportExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
        className={`flex flex-col gap-1.5 p-2 rounded-lg border transition-colors ${open ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}`}
        title="Menu"
      >
        <span className="block w-5 h-px bg-current rounded" />
        <span className="block w-5 h-px bg-current rounded" />
        <span className="block w-5 h-px bg-current rounded" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
          {(userEmail || userFullName) && (
            <>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  {userFullName ? (
                    <>
                      <div className="text-sm font-medium text-white truncate">{userFullName}</div>
                      {userEmail && <div className="text-[11px] text-gray-500 truncate">{userEmail}</div>}
                    </>
                  ) : (
                    userEmail && <div className="text-sm text-gray-200 truncate">{userEmail}</div>
                  )}
                </div>
              </div>
              <div className="mx-4 border-t border-gray-800" />
            </>
          )}

          {/* Lead Criteria */}
          <button
            onClick={() => { onOpenScoreSettings(); setOpen(false) }}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors group"
          >
            <span className="text-gray-500 group-hover:text-gray-300 mt-0.5 shrink-0 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </span>
            <div className="min-w-0">
              <div className="text-sm text-gray-200 font-medium leading-tight">Lead Criteria</div>
              <div className="text-[11px] text-gray-500 mt-0.5 truncate">Scoring weights & AI filters</div>
            </div>
          </button>

          {/* Profile */}
          <button
            onClick={() => { onOpenProfile(); setOpen(false) }}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors group"
          >
            <span className="text-gray-500 group-hover:text-gray-300 mt-0.5 shrink-0 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </span>
            <div className="min-w-0">
              <div className="text-sm text-gray-200 font-medium leading-tight">Profile</div>
              <div className="text-[11px] text-gray-500 mt-0.5 truncate">Name, LinkedIn, pitch line</div>
            </div>
          </button>

          {/* Import (expandable) */}
          {importChildren.length > 0 && (
            <>
              <div className="mx-4 my-1 border-t border-gray-800" />
              <button
                onClick={() => setImportExpanded(v => !v)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors group"
              >
                <span className="text-gray-500 group-hover:text-gray-300 mt-0.5 shrink-0 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-200 font-medium leading-tight">Import</div>
                  <div className="text-[11px] text-gray-500 mt-0.5 truncate">Upload an Excel export</div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-4 h-4 text-gray-500 mt-0.5 shrink-0 transition-transform ${importExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                ><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {importExpanded && (
                <div className="bg-gray-950/50">
                  {importChildren.map((c, i) => (
                    <button
                      key={i}
                      onClick={c.onClick}
                      className="w-full pl-12 pr-4 py-2.5 text-left hover:bg-gray-800 transition-colors block"
                    >
                      <div className="text-sm text-gray-200 leading-tight">{c.label}</div>
                      {c.sublabel && <div className="text-[11px] text-gray-500 mt-0.5 truncate">{c.sublabel}</div>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {userEmail === ADMIN_EMAIL && (
            <>
              <div className="mx-4 my-1 border-t border-gray-800" />
              <a
                href="/admin"
                onClick={() => setOpen(false)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors group"
              >
                <span className="text-gray-500 group-hover:text-gray-300 mt-0.5 shrink-0 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-gray-200 font-medium leading-tight">Admin</div>
                  <div className="text-[11px] text-gray-500 mt-0.5 truncate">Users + usage</div>
                </div>
              </a>
            </>
          )}

          <div className="mx-4 my-1 border-t border-gray-800" />

          {/* Contact Us */}
          <button
            onClick={() => { window.open('mailto:dmeehanj@gmail.com', '_blank'); setOpen(false) }}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors group"
          >
            <span className="text-gray-500 group-hover:text-gray-300 mt-0.5 shrink-0 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </span>
            <div className="min-w-0">
              <div className="text-sm text-gray-200 font-medium leading-tight">Contact Us</div>
              <div className="text-[11px] text-gray-500 mt-0.5 truncate">Questions or feedback</div>
            </div>
          </button>

          <div className="mx-4 my-1 border-t border-gray-800" />

          {/* Sign out */}
          <button
            onClick={signOut}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors group"
          >
            <span className="text-gray-500 group-hover:text-gray-300 mt-0.5 shrink-0 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </span>
            <div className="min-w-0">
              <div className="text-sm text-gray-200 font-medium leading-tight">Sign out</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
