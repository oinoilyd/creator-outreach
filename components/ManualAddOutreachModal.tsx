'use client'

import { useState } from 'react'
import type { OutreachEntry } from '@/lib/types'

export function ManualAddOutreachModal({
  existingChannelIds,
  onAdd,
  onClose,
}: {
  existingChannelIds: Set<string>
  onAdd: (entry: OutreachEntry) => Promise<void> | void
  onClose: () => void
}) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [autoEnrich, setAutoEnrich] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setStatus('')
    if (!url.trim()) { setError('YouTube URL is required.'); return }
    if (!/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url.trim())) {
      setError('That doesn\'t look like a YouTube URL.')
      return
    }
    setBusy(true)
    try {
      setStatus('Resolving channel...')
      const r = await fetch(`/api/lookup-channel?url=${encodeURIComponent(url.trim())}`)
      const lookup = await r.json()
      if (!r.ok || !lookup.channelId) {
        setError(`Lookup failed: ${lookup.error || 'unknown'}`)
        setBusy(false); setStatus('')
        return
      }
      if (existingChannelIds.has(lookup.channelId)) {
        setError('That channel is already in your outreach list.')
        setBusy(false); setStatus('')
        return
      }

      let extra: any = {}
      if (autoEnrich) {
        setStatus('Fetching email + socials...')
        try {
          const params = new URLSearchParams({
            name: lookup.channelName || name || '',
            channelId: lookup.channelId,
            description: lookup.description || '',
          })
          const er = await fetch(`/api/enrich?${params}`)
          if (er.ok) extra = await er.json()
        } catch { /* swallow — entry still gets created without enrichment */ }
      }

      const channelName = (name.trim() || lookup.channelName || '').trim()
      const entry: OutreachEntry = {
        id: `${lookup.channelId}-${Date.now()}`,
        channelId: lookup.channelId,
        channelName: channelName || lookup.channelId,
        channelUrl: lookup.channelUrl || url.trim(),
        description: lookup.description || '',
        email: email.trim() || extra.email || '',
        product: '',
        favorite: false,
        reachedOut: false,
        medium: '',
        mediumOther: '',
        headerUsed: '',
        status: 'Not Outreached',
        addedAt: Date.now(),
        notes: notes.trim(),
        followUpDate: '',
        dateReachedOut: '',
        touchpoints: '',
        responseDate: '',
        subscribers: extra.subscribers || '',
        avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : 0,
        fitScore: 0,
        linkedin: extra.linkedin || '',
        contentNiche: '',
        phone: '',
        dealValue: '',
        contractSent: false,
        meetingScheduled: '',
      }
      await onAdd(entry)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Could not add entry.')
      setBusy(false)
      setStatus('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-white">Add to outreach manually</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>
        <p className="text-gray-500 text-xs mb-5">Paste the creator's YouTube URL. We'll look up the channel and (optionally) try to find their email + socials.</p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">YouTube URL <span className="text-red-400">*</span></label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/@channelhandle"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Channel name (optional)</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Will auto-fill from URL if blank"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="creator@example.com"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoEnrich}
              onChange={e => setAutoEnrich(e.target.checked)}
              className="w-4 h-4 rounded accent-purple-500"
            />
            Try to fetch email + socials automatically
          </label>

          {status && <div className="text-xs text-gray-400">{status}</div>}
          {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</div>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50">Cancel</button>
            <button
              type="submit"
              disabled={busy || !url.trim()}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Adding…' : 'Add to outreach'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
