'use client'

/**
 * AuditMenu — small icon-only button that opens a popover of admin
 * diagnostic / audit pages. Lives in the admin nav strips alongside
 * the primary tab buttons but visually subdued: icon-only, gray
 * border, no label.
 *
 * Designed to be the home for "defensive plumbing" — pages and
 * actions the admin shouldn't trip over by default but wants
 * reachable when something looks off. Items come in two flavors:
 *
 *   - link    → navigates to a diagnostic page (inbound-debug,
 *               test-data, email-test, ...)
 *   - action  → runs a side-effecting function (seed-test-data,
 *               cache flush, ...). Action handlers manage their
 *               own confirm + busy state.
 *
 * History: Email-test + Seed-test-data used to live as top-level
 * buttons on /admin (next to Database, Legal). Moved here on
 * 2026-05-12 to keep the top nav focused on production
 * surfaces — the audit dropdown is the right home for dev tools.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type LinkItem = {
  kind: 'link'
  href: string
  icon: string
  label: string
  description: string
}

type ActionItem = {
  kind: 'action'
  /** Stable id used by AuditMenu to track per-row busy state. */
  id: string
  icon: string
  label: string
  /** Label swap while the action is in flight (e.g. "Seeding…"). */
  busyLabel: string
  description: string
  /**
   * The action implementation. Receives a `setBusy` so the menu can
   * disable the row + swap to `busyLabel` while in flight.
   * Confirmation dialogs / alerts belong inside this function.
   */
  run: () => Promise<void>
}

type AuditItem = LinkItem | ActionItem

// Seed-test-data action — adds ~100 real creators to the caller's
// outreach with random statuses + dates. Used to be a separate
// SeedTestDataButton component on /admin; folded in here on
// 2026-05-12 so all audit/dev tools live behind one entry point.
async function runSeedTestData() {
  if (
    !confirm(
      'Add ~100 real creators to your Outreach with random statuses + dates? This calls the real /api/search endpoint and may take 20–60s. Cleanup later by deleting rows where notes = "[seed]".',
    )
  ) {
    return
  }
  try {
    const res = await fetch('/api/admin/seed-test-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const text = await res.text()
    let data: { ok?: boolean; added?: number; error?: string; errors?: string[] } = {}
    try { data = JSON.parse(text) } catch { /* ignore */ }
    if (!res.ok || !data.ok) {
      const errMsg = data.error || `HTTP ${res.status}`
      alert(`Seed failed: ${errMsg}`)
      return
    }
    const errs = (data.errors ?? []).filter(Boolean)
    const detail = errs.length > 0 ? `\n\n(${errs.length} non-fatal warnings — see console)` : ''
    if (errs.length > 0) console.warn('[seed-test-data] partial warnings:', errs)
    alert(`Seeded ${data.added} creators.${detail}\n\nReturn to the app to see them in Outreach + Follow-ups.`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    alert(`Seed errored: ${msg}`)
  }
}

const AUDIT_ITEMS: AuditItem[] = [
  {
    kind: 'link',
    href: '/admin/sandbox',
    icon: '👥',
    label: 'Enterprise sandbox',
    description:
      '5-user Test Team (Owner / Admin / 3 Members) with one-click magic-link sign-in per role. Open each in an incognito window for parallel multi-role testing without losing your admin session.',
  },
  {
    kind: 'link',
    href: '/admin/inbound-debug',
    icon: '📬',
    label: 'Inbound email debug',
    description:
      'Last 50 emails received at the SendGrid inbound webhook. Used to grab Gmail forwarding verification codes + diagnose missed reply detections.',
  },
  {
    kind: 'link',
    href: '/admin/email-test',
    icon: '📧',
    label: 'Email test',
    description:
      'Send a test outbound email through SendGrid to verify deliverability, From: address, and DKIM/SPF alignment.',
  },
  {
    kind: 'link',
    href: '/admin/test-data',
    icon: '🧪',
    label: 'Test data',
    description:
      'Synthetic cache rows from smoke checks + automated tests (UC_TEST_, mock_, fake_ prefixes). Excluded from the main contacts view.',
  },
  {
    kind: 'action',
    id: 'seed-test-data',
    icon: '🌱',
    label: 'Seed test data',
    busyLabel: 'Seeding…',
    description:
      'Add ~100 real creators to your Outreach with random statuses + dates for stress-testing Follow-ups and analytics. Cleanup: filter notes=[seed].',
    run: runSeedTestData,
  },
  // Future entries land here — e.g. cache health probe, recent error
  // log, service-role connectivity test. Keep them compact (one
  // sentence in description) so the popover stays readable.
]

export function AuditMenu() {
  const [open, setOpen] = useState(false)
  // Per-action busy state, keyed by ActionItem.id. Lives at the menu
  // level (not per-row) so we can survive re-renders without losing
  // the spinner, and so the menu can stay open while the action runs.
  const [busyId, setBusyId] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Click-outside / Escape close. Do NOT auto-close on Escape while
  // an action is running — would orphan the spinner.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        if (busyId) return
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyId) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, busyId])

  async function handleAction(item: ActionItem) {
    if (busyId) return
    setBusyId(item.id)
    try {
      await item.run()
    } finally {
      setBusyId(null)
    }
  }

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
          {AUDIT_ITEMS.map(item => {
            if (item.kind === 'link') {
              return (
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
              )
            }
            const isBusy = busyId === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => handleAction(item)}
                disabled={isBusy || !!busyId}
                className="block w-full text-left px-3 py-2.5 hover:bg-card/60 transition-colors border-b border-border/40 last:border-b-0 disabled:opacity-60 disabled:cursor-wait"
              >
                <div className="flex items-center gap-2 text-foreground">
                  <span aria-hidden>{isBusy ? '⏳' : item.icon}</span>
                  <span className="text-sm font-medium">
                    {isBusy ? item.busyLabel : item.label}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground/80 mt-0.5 ml-6 leading-snug">
                  {item.description}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
