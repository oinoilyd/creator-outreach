'use client'

import { useState, useRef, useEffect } from 'react'
import type { PlatformId } from '@/lib/types'
import { PLATFORM_CONFIGS } from '@/lib/platform'
import { PlatformIcon } from './ui'

export function PlatformDropdown({ activePlatform, onChange }: { activePlatform: PlatformId; onChange: (id: PlatformId) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = PLATFORM_CONFIGS.find(p => p.id === activePlatform)!

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 text-foreground font-semibold hover:text-foreground transition-colors group"
      >
        <PlatformIcon id={activePlatform} className="w-4 h-4" />
        <span>{active.label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-7 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden py-1">
          {PLATFORM_CONFIGS.map(p => (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                p.id === activePlatform
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <PlatformIcon id={p.id} className={p.id === 'twitter' ? 'w-4 h-4 shrink-0' : 'w-4 h-4 shrink-0'} />
              {p.id !== 'twitter' && <span className="font-medium">{p.label}</span>}
              {p.id === 'youtube' && <span className="text-[10px] text-muted-foreground ml-1">(suggested)</span>}
              {p.id === activePlatform && (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 ml-auto text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
