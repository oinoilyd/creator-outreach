'use client'

import React, { useState, useRef, useEffect } from 'react'

export function HamburgerMenu({
  userEmail,
  userFullName,
  onOpenScoreSettings,
  onOpenProfile,
}: {
  userEmail: string | null
  userFullName: string | null
  onOpenScoreSettings: () => void
  onOpenProfile: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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

  const items: { icon: React.ReactNode; label: string; sublabel?: string; onClick: () => void; dividerAfter?: boolean }[] = [
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      label: 'Lead Criteria',
      sublabel: 'Scoring weights & AI filters',
      onClick: () => { onOpenScoreSettings(); setOpen(false) },
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
      label: 'Profile',
      sublabel: 'Name, LinkedIn, pitch line',
      onClick: () => { onOpenProfile(); setOpen(false) },
      dividerAfter: true,
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
      label: 'Contact Us',
      sublabel: 'Questions or feedback',
      onClick: () => { window.open('mailto:dmeehanj@gmail.com', '_blank'); setOpen(false) },
      dividerAfter: true,
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
      label: 'Sign out',
      onClick: signOut,
    },
  ]

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
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
          {items.map((item, i) => (
            <React.Fragment key={i}>
              <button
                onClick={item.onClick}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors group"
              >
                <span className="text-gray-500 group-hover:text-gray-300 mt-0.5 shrink-0 transition-colors">{item.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm text-gray-200 font-medium leading-tight">{item.label}</div>
                  {item.sublabel && <div className="text-[11px] text-gray-500 mt-0.5 truncate">{item.sublabel}</div>}
                </div>
              </button>
              {item.dividerAfter && <div className="mx-4 my-1 border-t border-gray-800" />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
