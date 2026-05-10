'use client'

/**
 * AuditMenu — small icon-only button that opens a popover of admin
 * diagnostic / audit pages. Lives in the admin nav strips alongside
 * the primary tab buttons but visually subdued: icon-only, gray
 * border, no label.
 *
 * Designed to be the home for "defensive plumbing" pages — stuff the
 * admin shouldn't trip over by default but wants reachable when
 * something looks off. Currently just Test data; new entries go in
 * the AUDIT_ITEMS array below.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type AuditItem = {
  href: string
  icon: string
  label: string
  description: string
}

const AUDIT_ITEMS: AuditItem[] = [
  {
    href: '/admin/inbound-debug',
    icon: '📬',
    label: 'Inbound email debug',
    description:
      'Last 50 emails received at the SendGrid inbound webhook. Used to grab Gmail forwarding verification codes + diagnose missed reply detections.',
  },
  {
    href: '/admin/test-data',
    icon: '🧪',
    label: 'Test data',
    description:
      'Synthetic cache rows from smoke checks + automated tests (UC_TEST_, mock_, fake_ prefixes). Excluded from the main contacts view.',
  },
  {
    href: '/admin/design-preview',
    icon: '🎨',
    label: 'Filter design preview',
    description:
      'Four candidate visual directions for the search filter top bar (editorial, neo-brutalist, glass bento, current). Pick one and I\'ll wire it into prod.',
  },
  // Future entries land here — e.g. cache health probe, recent error
  // log, service-role connectivity test. Keep them compact (one
  // sentence in description) so the popover stays readable.
]

export function AuditMenu() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Click-outside / Escape close.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Audit & diagnostics"
        aria-label="Audit & diagnostics"
        aria-expanded={open}
        aria-haspopup="menu"
        className={`text-sm rounded-lg p-2 transition-colors border ${
          open
            ? 'border-border text-foreground bg-card/40'
            : 'border-border text-muted-foreground/80 hover:border-border hover:text-foreground'
        }`}
      >
        {/* Magnifying-glass-with-dot icon — universally reads as
            "inspect / audit". 16px keeps the button a tight square
            next to the wider tab buttons. */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <circle cx="11" cy="11" r="2" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-border bg-background shadow-2xl shadow-black/40 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border/60 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold">
            Audit &amp; diagnostics
          </div>
          {AUDIT_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              role="menuitem"
              className="block px-3 py-2.5 hover:bg-card/60 transition-colors border-b border-border/40 last:border-b-0"
            >
              <div className="flex items-center gap-2 text-foreground">
                <span aria-hidden>{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <div className="text-[11px] text-muted-foreground/80 mt-0.5 ml-6 leading-snug">
                {item.description}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
