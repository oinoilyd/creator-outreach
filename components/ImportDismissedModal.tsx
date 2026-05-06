'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import type { Creator } from '@/lib/types'

/**
 * Same UX as ImportOutreachModal but for the dismissed-creators list.
 * Accepts an .xlsx with at least:
 *   "Channel Name"  → channelName
 *   "YouTube URL"   → channelUrl
 * Optional columns picked up if present:
 *   "Avg Views"     → avgViews (number)
 *   "Email"         → email
 *   "Description"   → description
 *   "LinkedIn"      → linkedin
 *   "Website"       → website
 *   "Instagram"     → instagram
 *   "Twitter/X"     → twitter
 *   "TikTok"        → tiktok
 */
export function ImportDismissedModal({
  onImport,
  onClose,
}: {
  onImport: (items: Creator[]) => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Creator[] | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function extractChannelId(channelUrl: string): string {
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

      const items: Creator[] = []
      for (const r of rows) {
        const channelName = String(r['Channel Name'] || '').trim()
        const channelUrl = String(r['YouTube URL'] || '').trim()
        if (!channelName || !channelUrl) continue
        const channelId = extractChannelId(channelUrl)
        if (!channelId) continue
        const avgViewsRaw = r['Avg Views']
        const avgViews = typeof avgViewsRaw === 'number' ? avgViewsRaw : parseInt(String(avgViewsRaw || '0').replace(/[^0-9]/g, '')) || 0
        items.push({
          channelId,
          channelName,
          channelUrl,
          avgViews,
          subscribers: '',
          email: String(r['Email'] || ''),
          website: String(r['Website'] || ''),
          linkedin: String(r['LinkedIn'] || ''),
          twitter: String(r['Twitter/X'] || r['Twitter'] || r['X'] || ''),
          instagram: String(r['Instagram'] || ''),
          tiktok: String(r['TikTok'] || ''),
          company: '',
          matchedVia: 'imported',
          videoTitles: [],
          videoDates: [],
          description: String(r['Description'] || ''),
        })
      }

      if (items.length === 0) {
        setError('No usable rows found. Make sure the file has "Channel Name" and "YouTube URL" columns.')
        setBusy(false)
        return
      }
      setPreview(items)
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

  function onDragOver(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setDragOver(true) }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setDragOver(false) }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await processFile(file)
  }

  async function confirmImport() {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      await onImport(preview)
    } catch (e: any) {
      setError(`Import failed: ${e?.message || e}`)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md p-7" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-foreground">Import dismissed creators</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>
        <p className="text-muted-foreground text-sm mb-5">
          Upload an <code className="text-muted-foreground">.xlsx</code> file with at least <span className="text-muted-foreground">Channel Name</span> and <span className="text-muted-foreground">YouTube URL</span> columns.
        </p>

        {!preview && (
          <>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
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
                  : 'border-border hover:border-border text-muted-foreground hover:text-foreground'
              } ${busy ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {busy
                ? 'Reading file…'
                : dragOver
                  ? '📥 Drop the file to upload'
                  : <>📁 <span className="block mt-1">Click or drag an <code className="text-foreground/80">.xlsx</code> file here</span></>
              }
            </div>
          </>
        )}

        {preview && (
          <div className="bg-muted/40 border border-border rounded-lg p-3 mb-4">
            <div className="text-sm text-foreground font-medium mb-2">
              Found {preview.length} {preview.length === 1 ? 'creator' : 'creators'}
            </div>
            <div className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
              {preview.slice(0, 10).map((c, i) => (
                <div key={i} className="truncate">• {c.channelName}{c.avgViews ? ` (${c.avgViews.toLocaleString()} views)` : ''}</div>
              ))}
              {preview.length > 10 && <div className="text-muted-foreground/70">…and {preview.length - 10} more</div>}
            </div>
          </div>
        )}

        {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2 mb-4">{error}</div>}

        <div className="flex items-center justify-end gap-3 mt-2">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
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
