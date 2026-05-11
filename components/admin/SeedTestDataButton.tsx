'use client'

/**
 * SeedTestDataButton — admin-only button that calls
 * POST /api/admin/seed-test-data to seed the caller's outreach with
 * ~100 real creators (random statuses, follow-up dates, response
 * dates) for testing the Follow-ups view + analytics widgets.
 *
 * History: this used to be a hamburger-menu item gated behind
 * `userEmail === ADMIN_EMAIL` (HamburgerMenu.tsx). Moved to the admin
 * dashboard on 2026-05-11 because (a) it's purely a dev tool and (b)
 * the prop-drilling from app/page.tsx through HamburgerMenu was a
 * smell — every admin function should live on /admin instead.
 *
 * Cleanup: every seeded row gets notes = '[seed]' so they're easy to
 * filter and bulk-delete later.
 */

import { useState } from 'react'

export function SeedTestDataButton() {
  const [busy, setBusy] = useState(false)

  async function onClick() {
    if (busy) return
    if (
      !confirm(
        'Add ~100 real creators to your Outreach with random statuses + dates? This calls the real /api/search endpoint and may take 20–60s. Cleanup later by deleting rows where notes = "[seed]".',
      )
    ) {
      return
    }
    setBusy(true)
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
    } catch (err: any) {
      alert(`Seed errored: ${err?.message || err}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Seed ~100 real creators with random statuses + dates (admin only). Cleanup: filter notes=[seed]."
      className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border border-border text-muted-foreground hover:border-border hover:text-foreground disabled:opacity-60 disabled:cursor-wait"
    >
      <span aria-hidden>{busy ? '⏳' : '🧪'}</span>
      {busy ? 'Seeding…' : 'Seed test data'}
    </button>
  )
}
