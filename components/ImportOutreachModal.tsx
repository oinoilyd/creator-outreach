'use client'

import { useState, useRef, useEffect, useId } from 'react'
import * as XLSX from 'xlsx'
import type { OutreachEntry } from '@/lib/types'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import {
  autoMapColumns,
  buildEntriesFromMapping,
  MAP_FIELDS,
  type ImportField,
} from '@/lib/import/column-map'

/**
 * Upload a spreadsheet (.xlsx, .xls, .csv) and import its rows as
 * OutreachEntry records.
 *
 * Dylan 2026-06-28: made column handling roadblock-proof. Previously, if
 * no header matched the name aliases the whole file was rejected ("No
 * usable rows found") — a hard wall for CRM exports with unusual columns.
 * Now:
 *   • Headers are fuzzy-matched (see lib/import/column-map).
 *   • If the name column can't be auto-detected, we DON'T fail — we drop
 *     the user into a manual mapping step to point us at the right columns.
 *   • The mapping step is always reachable from the preview ("Adjust
 *     columns"), so any mismatch is fixable instead of fatal.
 *   • Split names (HubSpot First/Last) combine automatically.
 */

type Step = 'upload' | 'map' | 'preview'

export function ImportOutreachModal({
  onImport,
  onClose,
}: {
  onImport: (entries: OutreachEntry[]) => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<Step>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Partial<Record<ImportField, string>>>({})
  const [preview, setPreview] = useState<OutreachEntry[] | null>(null)
  const [skipped, setSkipped] = useState(0)
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
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      if (parsed.length === 0) {
        setError('That sheet looks empty — no rows found below the header.')
        setBusy(false)
        return
      }

      // Collect every header that appears (rows can have ragged keys).
      const headerSet = new Set<string>()
      for (const row of parsed.slice(0, 100)) for (const k of Object.keys(row)) headerSet.add(k)
      const cols = [...headerSet]

      const auto = autoMapColumns(cols)
      setHeaders(cols)
      setRows(parsed)
      setMapping(auto)

      // If we confidently found the name column, go straight to preview.
      // Otherwise, route to manual mapping — never a dead end.
      if (auto.channelName) {
        const { entries, skipped: sk } = buildEntriesFromMapping(parsed, auto, Date.now())
        if (entries.length > 0) {
          setPreview(entries)
          setSkipped(sk)
          setStep('preview')
        } else {
          setStep('map')
        }
      } else {
        setStep('map')
      }
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(`Could not read file: ${message}`)
    } finally {
      setBusy(false)
    }
  }

  function setFieldMapping(field: ImportField, header: string) {
    setMapping((m) => ({ ...m, [field]: header || undefined }))
  }

  function applyMapping() {
    setError('')
    const { entries, skipped: sk } = buildEntriesFromMapping(rows, mapping, Date.now())
    if (entries.length === 0) {
      setError('Still no usable rows — make sure the Name column is mapped and has values in it.')
      return
    }
    setPreview(entries)
    setSkipped(sk)
    setStep('preview')
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
    } catch (e: unknown) {
      setError(`Import failed: ${(e as Error)?.message || e}`)
      setBusy(false)
    }
  }

  const nameMapped = Boolean(mapping.channelName)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md p-7 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 id={titleId} className="text-xl font-bold text-foreground">Import outreach</h2>
          <button
            onClick={onClose}
            aria-label="Close import dialog"
            className="text-muted-foreground hover:text-foreground text-lg leading-none w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
          >✕</button>
        </div>

        {/* ── Upload step ── */}
        {step === 'upload' && (
          <>
            <p className="text-muted-foreground text-sm mb-5">
              Drop a spreadsheet from your CRM, Excel, or Google Sheets. Accepts{' '}
              <code className="text-muted-foreground">.xlsx</code>,{' '}
              <code className="text-muted-foreground">.xls</code>, or{' '}
              <code className="text-muted-foreground">.csv</code>. We auto-match your
              columns — and if anything’s unclear, you’ll get to map it yourself. No
              renaming required.
            </p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
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
              {busy ? 'Reading file…' : dragOver ? '📥 Drop the file to upload' : <>📁 <span className="block mt-1">Click or drag a spreadsheet here</span></>}
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed">
              Works with exports from HubSpot, Salesforce, Pipedrive, a Google Sheet —
              anything. Emails and social URLs are auto-detected from any column.
            </p>
          </>
        )}

        {/* ── Mapping step ── */}
        {step === 'map' && (
          <>
            <p className="text-muted-foreground text-sm mb-1">
              Match your columns
            </p>
            <p className="text-[12px] text-muted-foreground/80 mb-4">
              We pre-filled what we recognized. Point each field at the right column —
              only <span className="text-foreground font-medium">Name</span> is required.
            </p>
            <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1 mb-4">
              {MAP_FIELDS.map(({ field, label, required }) => (
                <label key={field} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-foreground shrink-0 w-1/2">
                    {label}{required && <span className="text-red-500"> *</span>}
                  </span>
                  <select
                    value={mapping[field] ?? ''}
                    onChange={(e) => setFieldMapping(field, e.target.value)}
                    className={`flex-1 bg-muted border rounded-md px-2 py-1.5 text-[13px] text-foreground focus:outline-none focus:border-brand ${
                      required && !mapping[field] ? 'border-red-400/60' : 'border-border'
                    }`}
                  >
                    <option value="">— skip —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {!nameMapped && (
              <p className="text-[12px] text-amber-600 dark:text-amber-400 mb-3">
                Pick which column holds the name to continue.
              </p>
            )}
          </>
        )}

        {/* ── Preview step ── */}
        {step === 'preview' && preview && (
          <>
            <div className="bg-muted/40 border border-border rounded-lg p-3 mb-3 mt-4">
              <div className="text-sm text-foreground font-medium mb-2">
                Ready to import {preview.length} {preview.length === 1 ? 'entry' : 'entries'}
                {skipped > 0 && <span className="text-muted-foreground font-normal"> · {skipped} skipped (no name)</span>}
              </div>
              <div className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                {preview.slice(0, 10).map((e, i) => (
                  <div key={i} className="truncate">• {e.channelName}{e.email ? ` (${e.email})` : ''}</div>
                ))}
                {preview.length > 10 && <div className="text-muted-foreground/70">…and {preview.length - 10} more</div>}
              </div>
            </div>
            <button
              onClick={() => setStep('map')}
              className="text-[12px] text-brand hover:underline mb-3"
            >
              Adjust columns
            </button>
          </>
        )}

        {error && <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2 mb-4">{error}</div>}

        <div className="flex items-center justify-end gap-3 mt-2">
          {step === 'map' && (
            <button onClick={() => setStep('upload')} disabled={busy} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 mr-auto">
              ← Back
            </button>
          )}
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            Cancel
          </button>
          {step === 'map' && (
            <button
              onClick={applyMapping}
              disabled={busy || !nameMapped}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          )}
          {step === 'preview' && preview && (
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
