'use client'

import { useState, useRef, useEffect, useId } from 'react'
import * as XLSX from 'xlsx'
import type { OutreachEntry } from '@/lib/types'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

/**
 * Lets a user upload a spreadsheet (.xlsx, .xls, or .csv) and import
 * its rows as OutreachEntry records.
 *
 * Dylan 2026-06-09: original version required EXACT column names
 * ("Channel Name", "YouTube URL") and EXACT YouTube channel-URL
 * format (must match /channel/UCxxx). Spreadsheets coming from other
 * CRMs almost never look like that, so most imports failed with
 * "No usable rows found." This version is intentionally forgiving:
 *
 *   • Column-name aliases — case-insensitive, accepts common variants
 *     ("Name", "Creator", "Channel Name" all → channelName etc.)
 *   • CSV support — same XLSX library handles all three formats
 *   • No YouTube requirement — rows without a YT channel URL still
 *     import. Synthetic ID is generated. Social URLs in any column
 *     get auto-routed to the right field (instagram.com → instagram,
 *     linkedin.com → linkedin, etc.).
 *
 * Minimum bar: a column matching the channelName aliases. Everything
 * else is optional.
 */

/** Case-insensitive header alias table. Each entry's array lists the
 *  column-name variants we accept and map to a single OutreachEntry
 *  field. Add to this as users surface common naming patterns. */
const COLUMN_ALIASES: Record<string, readonly string[]> = {
  channelName: ['channel name', 'name', 'creator', 'channel', 'creator name', 'full name', 'lead name', 'company', 'first name'],
  channelUrl:  ['youtube url', 'youtube', 'channel url', 'url', 'link', 'profile url', 'profile', 'yt url'],
  email:       ['email', 'email address', 'contact email', 'e-mail', 'mail'],
  description: ['description', 'notes', 'note', 'comments', 'about', 'bio', 'summary'],
  product:     ['product', 'service', 'offering', 'product/service'],
  reachedOut:  ['reached out', 'contacted', 'reached', 'has reached out', 'outreach started'],
  medium:      ['medium', 'method', 'outreach method', 'channel of contact'],
  headerUsed:  ['subject line', 'subject', 'email subject', 'header'],
  status:      ['status', 'state', 'stage', 'lead status'],
  instagram:   ['instagram', 'ig', 'ig url', 'instagram url', 'instagram handle', 'instagram profile'],
  linkedin:    ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin profile url'],
  twitter:     ['twitter', 'x', 'x url', 'twitter url', 'x handle', 'twitter handle'],
  tiktok:      ['tiktok', 'tiktok url', 'tiktok handle', 'tiktok profile'],
  website:     ['website', 'site', 'web', 'homepage'],
}

/** Case-insensitive lookup of the first matching column. */
function getField(row: Record<string, unknown>, aliases: readonly string[]): string {
  const keys = Object.keys(row)
  for (const alias of aliases) {
    const found = keys.find(k => k.trim().toLowerCase() === alias)
    if (found && row[found] != null) {
      const val = String(row[found]).trim()
      if (val) return val
    }
  }
  return ''
}

/** Scan every string value in the row for known social-platform URLs.
 *  Routes them to the right field even when they live in a column
 *  named something unrelated like "Profile" or "Link". */
interface DetectedSocials {
  channelUrl?: string
  instagram?: string
  linkedin?: string
  twitter?: string
  tiktok?: string
  website?: string
}
function detectSocialsFromRow(row: Record<string, unknown>): DetectedSocials {
  const result: DetectedSocials = {}
  for (const val of Object.values(row)) {
    if (typeof val !== 'string') continue
    const url = val.trim()
    if (!/^https?:\/\//i.test(url)) continue
    if (/youtube\.com\/(channel|c|user|@)/i.test(url) && !result.channelUrl) result.channelUrl = url
    else if (/instagram\.com\//i.test(url) && !result.instagram) result.instagram = url
    else if (/linkedin\.com\//i.test(url) && !result.linkedin) result.linkedin = url
    else if (/(twitter|x)\.com\//i.test(url) && !result.twitter) result.twitter = url
    else if (/tiktok\.com\//i.test(url) && !result.tiktok) result.tiktok = url
    else if (!result.website) result.website = url
  }
  return result
}
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
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(dialogRef, true)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function extractChannelId(channelUrl: string): string {
    // YouTube channel URLs: https://www.youtube.com/channel/UCxxxxxxx
    const m = channelUrl.match(/\/channel\/(UC[\w-]{22})/)
    return m ? m[1] : ''
  }

  async function processFile(file: File) {
    setError('')
    setPreview(null)
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError(`Need a spreadsheet file (.xlsx, .xls, or .csv). Got: ${file.name}`)
      return
    }
    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      // XLSX.read handles xlsx, xls, AND csv with the same call — the
      // library auto-detects the format from the buffer contents.
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      const entries: OutreachEntry[] = []
      const now = Date.now()
      let i = 0
      for (const r of rows) {
        // Required: a recognizable name column. Without it we can't
        // render the row in the table, so skip silently.
        const channelName = getField(r, COLUMN_ALIASES.channelName)
        if (!channelName) continue

        // Try to find a YouTube channel URL anywhere in the row + the
        // explicit URL column. Falls back to "" if none — the lead
        // still imports as a non-YouTube row.
        const explicitUrl = getField(r, COLUMN_ALIASES.channelUrl)
        const detected = detectSocialsFromRow(r)
        const channelUrl = detected.channelUrl || (explicitUrl.match(/youtube\.com/i) ? explicitUrl : '')
        const ytChannelId = channelUrl ? extractChannelId(channelUrl) : ''

        // ID generation: YouTube channel ID if we found one (lets the
        // same creator dedupe across imports), else synthetic.
        const id = ytChannelId
          ? `${ytChannelId}-${now + i}`
          : `manual-${now + i}`
        const channelId = ytChannelId || id

        const reachedOutRaw = getField(r, COLUMN_ALIASES.reachedOut).toLowerCase()
        const reachedOut = reachedOutRaw === 'yes' || reachedOutRaw === 'true' || reachedOutRaw === '1'

        // Social fields: prefer the auto-detected URL from row scan,
        // fall back to whatever the user put in a named column.
        const instagram = detected.instagram || getField(r, COLUMN_ALIASES.instagram)
        const linkedin  = detected.linkedin  || getField(r, COLUMN_ALIASES.linkedin)
        const twitter   = detected.twitter   || getField(r, COLUMN_ALIASES.twitter)
        const tiktok    = detected.tiktok    || getField(r, COLUMN_ALIASES.tiktok)
        const website   = detected.website   || getField(r, COLUMN_ALIASES.website)

        entries.push({
          id,
          channelId,
          channelName,
          // channelUrl is YT-specific. For non-YT leads we use the
          // first social URL we found (instagram/linkedin/etc.) so the
          // row has a clickable "go to creator" link.
          channelUrl: channelUrl || instagram || linkedin || twitter || tiktok || website || '',
          description: getField(r, COLUMN_ALIASES.description),
          email: getField(r, COLUMN_ALIASES.email),
          product: getField(r, COLUMN_ALIASES.product),
          favorite: false,
          reachedOut,
          medium: (getField(r, COLUMN_ALIASES.medium) as OutreachEntry['medium']) || '',
          mediumOther: '',
          headerUsed: getField(r, COLUMN_ALIASES.headerUsed),
          status: ((): OutreachEntry['status'] => {
            const raw = getField(r, COLUMN_ALIASES.status) as OutreachEntry['status']
            if (raw) return raw
            return reachedOut ? 'Open' : 'Not Outreached'
          })(),
          addedAt: now + i,
          notes: '',
          followUpDate: '',
          dateReachedOut: '',
          touchpoints: '',
          responseDate: '',
          subscribers: '',
          avgViews: 0,
          fitScore: 0,
          linkedin,
          instagram,
          twitter,
          tiktok,
          website,
          contentNiche: '',
          phone: '',
          dealValue: '',
          contractSent: false,
          meetingScheduled: '',
        })
        i++
      }

      if (entries.length === 0) {
        setError(
          'No usable rows found. Each row needs at least a name column ' +
          '(e.g. "Name", "Creator", "Channel Name", "Full Name", "Lead Name"). ' +
          'Email + URLs are optional and auto-detected from any column.',
        )
        setBusy(false)
        return
      }
      setPreview(entries)
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(`Could not read file: ${message}`)
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md p-7 focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 id={titleId} className="text-xl font-bold text-foreground">Import outreach</h2>
          <button
            onClick={onClose}
            aria-label="Close import dialog"
            className="text-muted-foreground hover:text-foreground text-lg leading-none w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
          >✕</button>
        </div>
        <p className="text-muted-foreground text-sm mb-5">
          Drop a spreadsheet from your CRM, Excel, or Google Sheets. Accepts
          {' '}<code className="text-muted-foreground">.xlsx</code>,{' '}
          <code className="text-muted-foreground">.xls</code>, or{' '}
          <code className="text-muted-foreground">.csv</code>. Column names
          are auto-matched — no need to rename anything.
        </p>

        {!preview && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
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
                  ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-300'
                  : 'border-border hover:border-border text-muted-foreground hover:text-foreground'
              } ${busy ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {busy
                ? 'Reading file…'
                : dragOver
                  ? '📥 Drop the file to upload'
                  : <>📁 <span className="block mt-1">Click or drag a spreadsheet here</span></>
              }
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed">
              Each row needs at least a name column —{' '}
              <span className="text-muted-foreground">Name</span>,{' '}
              <span className="text-muted-foreground">Creator</span>,{' '}
              <span className="text-muted-foreground">Channel Name</span>,{' '}
              <span className="text-muted-foreground">Lead Name</span>, etc. all work.
              Emails and URLs are auto-detected from any column. Social URLs
              (Instagram / LinkedIn / TikTok / X / YouTube) get routed to the
              right field automatically.
            </p>
          </>
        )}

        {preview && (
          <>
            <div className="bg-muted/40 border border-border rounded-lg p-3 mb-4">
              <div className="text-sm text-foreground font-medium mb-2">
                Found {preview.length} {preview.length === 1 ? 'entry' : 'entries'}
              </div>
              <div className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                {preview.slice(0, 10).map((e, i) => (
                  <div key={i} className="truncate">• {e.channelName}{e.email ? ` (${e.email})` : ''}</div>
                ))}
                {preview.length > 10 && <div className="text-muted-foreground/70">…and {preview.length - 10} more</div>}
              </div>
            </div>
          </>
        )}

        {error && <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2 mb-4">{error}</div>}

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
