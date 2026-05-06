'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import type { OutreachEntry } from '@/lib/types'

/**
 * Lets a user upload an .xlsx file (the format produced by
 * /api/export-outreach) and writes its rows to their Supabase row.
 *
 * Maps Excel column names → OutreachEntry fields:
 *   "Channel Name"   → channelName
 *   "YouTube URL"    → channelUrl
 *   "Email"          → email
 *   "Description"    → description
 *   "Product"        → product
 *   "Reached Out"    → reachedOut ("Yes"/"No" → boolean)
 *   "Medium"         → medium
 *   "Subject Line"   → headerUsed
 *   "Status"         → status
 *
 * Other OutreachEntry fields default to '' / 0 / false / current timestamp
 * since the export format doesn't include them.
 */
export function ImportOutreachModal({
  onImport,
  onClose,
}: {
  onImport: (entries: OutreachEntry[]) => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<OutreachEntry[] | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function extractChannelId(channelUrl: string): string {
    // YouTube channel URLs: https://www.youtube.com/channel/UCxxxxxxx
    const m = channelUrl.match(/\/channel\/(UC[\w-]{22})/)
    return m ? m[1] : ''
  }

  async function processFile(file: File) {
    setError('')
    setPreview(null)
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError(`Need an Excel file (.xlsx or .xls). Got: ${file.name}`)
      return
    }
    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })

      const entries: OutreachEntry[] = []
      const now = Date.now()
      let i = 0
      for (const r of rows) {
        const channelName = String(r['Channel Name'] || '').trim()
        const channelUrl = String(r['YouTube URL'] || '').trim()
        if (!channelName || !channelUrl) continue
        const channelId = extractChannelId(channelUrl)
        if (!channelId) continue
        const reachedOutRaw = String(r['Reached Out'] || '').trim().toLowerCase()
        entries.push({
          id: `${channelId}-${now + i}`,
          channelId,
          channelName,
          channelUrl,
          description: String(r['Description'] || ''),
          email: String(r['Email'] || ''),
          product: String(r['Product'] || ''),
          favorite: false,
          reachedOut: reachedOutRaw === 'yes' || reachedOutRaw === 'true',
          medium: (String(r['Medium'] || '') as OutreachEntry['medium']) || '',
          mediumOther: '',
          headerUsed: String(r['Subject Line'] || ''),
          status: (String(r['Status'] || '') as OutreachEntry['status']) || '',
          addedAt: now + i,
          notes: '',
          followUpDate: '',
          dateReachedOut: '',
          touchpoints: '',
          responseDate: '',
          subscribers: '',
          avgViews: 0,
          fitScore: 0,
          linkedin: '',
          contentNiche: '',
          phone: '',
          dealValue: '',
          contractSent: false,
          meetingScheduled: '',
        })
        i++
      }

      if (entries.length === 0) {
        setError('No usable rows found. Make sure the file has "Channel Name" and "YouTube URL" columns.')
        setBusy(false)
        return
      }
      setPreview(entries)
    } catch (caught: any) {
      setError(`Could not read file: ${caught?.message || caught}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await processFile(file)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await processFile(file)
  }

  async function confirmImport() {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      await onImport(preview)
      // Caller closes modal + refreshes
    } catch (e: any) {
      setError(`Import failed: ${e?.message || e}`)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-7" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-white">Import outreach from Excel</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          Upload an <code className="text-gray-400">.xlsx</code> file you downloaded from this app (or from another export with matching columns).
        </p>

        {!preview && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="hidden"
            />
            <div
              onDragOver={onDragOver}
              onDragEnter={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              className={`w-full py-12 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-blue-500 bg-blue-900/10 text-blue-300'
                  : 'border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200'
              } ${busy ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {busy
                ? 'Reading file…'
                : dragOver
                  ? '📥 Drop the file to upload'
                  : <>📁 <span className="block mt-1">Click or drag an <code className="text-gray-300">.xlsx</code> file here</span></>
              }
            </div>
            <p className="text-[11px] text-gray-600 mt-3">
              Required columns: <span className="text-gray-400">Channel Name</span>, <span className="text-gray-400">YouTube URL</span>. All other columns are optional.
            </p>
          </>
        )}

        {preview && (
          <>
            <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-3 mb-4">
              <div className="text-sm text-white font-medium mb-2">
                Found {preview.length} {preview.length === 1 ? 'entry' : 'entries'}
              </div>
              <div className="text-xs text-gray-400 space-y-1 max-h-40 overflow-y-auto">
                {preview.slice(0, 10).map((e, i) => (
                  <div key={i} className="truncate">• {e.channelName}{e.email ? ` (${e.email})` : ''}</div>
                ))}
                {preview.length > 10 && <div className="text-gray-600">…and {preview.length - 10} more</div>}
              </div>
            </div>
          </>
        )}

        {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2 mb-4">{error}</div>}

        <div className="flex items-center justify-end gap-3 mt-2">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50">
            Cancel
          </button>
          {preview && (
            <button
              onClick={confirmImport}
              disabled={busy}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Importing…' : `Import ${preview.length} item${preview.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
