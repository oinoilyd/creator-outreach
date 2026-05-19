'use client'

/**
 * ContractUpload — manage the signed contract on an active-client
 * engagement. Two paths:
 *
 *   1) Upload a file to Supabase Storage (bucket `contracts`) via
 *      uploadContractFile(). Returns a 7-day signed URL.
 *   2) Paste an external link (Drive / Notion / Dropbox) into the
 *      URL field, same behavior as the v1.
 *
 * The component shows whichever is set. If both exist (user uploaded
 * AND has a URL), we surface the uploaded file as primary with a
 * "Replace with external link instead" affordance.
 *
 * On every commit it calls onPatch with the relevant fields PLUS a
 * synthetic activity event so the timeline records the change.
 */

import { useEffect, useRef, useState } from 'react'
import type { ClientActivityEvent } from '@/lib/types'
import type { ActiveClientPatch } from '@/lib/storage'
import {
  uploadContractFile, removeContractFile, getContractSignedUrl,
} from '@/lib/storage'
import {
  Upload, FileText, ExternalLink, Trash2, Loader2,
  AlertCircle, Link as LinkIcon,
} from 'lucide-react'

interface ContractUploadProps {
  entryId: string
  /** Current Supabase Storage path — null if no upload yet. */
  contractPath?: string | null
  contractName?: string | null
  contractSize?: number | null
  contractUploadedAt?: string | null
  /** Legacy URL fallback — still supported. */
  contractUrl?: string | null
  onPatch: (patch: ActiveClientPatch, activity?: ClientActivityEvent) => void
}

export function ContractUpload({
  entryId,
  contractPath,
  contractName,
  contractSize,
  contractUploadedAt,
  contractUrl,
  onPatch,
}: ContractUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'uploading' | 'removing' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Cached signed URL for the currently-uploaded file. Refreshes on
  // mount + whenever contractPath changes.
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setSignedUrl(null)
    if (!contractPath) return
    getContractSignedUrl(contractPath).then(url => {
      if (!cancelled) setSignedUrl(url)
    })
    return () => { cancelled = true }
  }, [contractPath])

  // URL field state — local draft so typing doesn't churn the parent.
  const [urlDraft, setUrlDraft] = useState(contractUrl || '')
  useEffect(() => { setUrlDraft(contractUrl || '') }, [contractUrl])

  async function handleFile(file: File) {
    setError(null)
    setBusy('uploading')
    const result = await uploadContractFile(entryId, file)
    setBusy(null)
    if (!result.ok) {
      setError(result.error || 'Upload failed.')
      return
    }
    setSignedUrl(result.signedUrl ?? null)
    onPatch(
      {
        clientContractPath: result.path ?? null,
        clientContractName: result.name ?? null,
        clientContractSize: result.size ?? null,
        clientContractUploadedAt: result.uploadedAt ?? null,
      },
      {
        ts: Date.now(),
        type: 'contract',
        summary: `Uploaded contract "${result.name}"`,
      },
    )
  }

  async function handleRemove() {
    if (!contractPath) return
    setError(null)
    setBusy('removing')
    await removeContractFile(contractPath)
    setBusy(null)
    onPatch(
      {
        clientContractPath: null,
        clientContractName: null,
        clientContractSize: null,
        clientContractUploadedAt: null,
      },
      {
        ts: Date.now(),
        type: 'contract',
        summary: `Removed contract${contractName ? ` "${contractName}"` : ''}`,
      },
    )
  }

  function commitUrl() {
    const next = urlDraft.trim()
    if ((next || '') === (contractUrl || '')) return
    onPatch(
      { clientContractUrl: next || null },
      {
        ts: Date.now(),
        type: 'contract',
        summary: next ? 'Set external contract link' : 'Cleared external contract link',
      },
    )
  }

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80 mb-2">
        Contract
      </div>

      {/* Uploaded file (primary path) */}
      {contractPath ? (
        <div className="bg-card/40 border border-border rounded-lg p-3 flex items-center gap-3">
          <FileText className="w-5 h-5 text-rose-500/80 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-foreground truncate">
              {contractName || 'Contract'}
            </div>
            <div className="text-[11px] text-muted-foreground/75 tabular-nums">
              {formatSize(contractSize)} · {formatUploadedAt(contractUploadedAt)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Open contract"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy === 'removing'}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border hover:bg-red-500/10 hover:border-red-500/40 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
              aria-label="Remove contract"
              title="Remove file"
            >
              {busy === 'removing'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ) : (
        // Upload dropzone — only when no file yet
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
          className={[
            'rounded-lg border-2 border-dashed transition-colors p-4 text-center',
            dragOver
              ? 'border-purple-500/60 bg-purple-500/5'
              : 'border-border hover:border-foreground/30 bg-card/30',
          ].join(' ')}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,application/pdf,image/png,image/jpeg"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              if (fileRef.current) fileRef.current.value = ''
            }}
            className="hidden"
            aria-label="Upload contract file"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy === 'uploading'}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-foreground text-background text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {busy === 'uploading'
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
              : <><Upload className="w-3.5 h-3.5" /> Upload contract</>}
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground/70">
            PDF, DOC, or image — drag-and-drop or click to choose. 20 MB max.
          </p>
        </div>
      )}

      {/* Optional external link — always available */}
      <div className="mt-3">
        <div className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground/70 mb-1 flex items-center gap-1.5">
          <LinkIcon className="w-3 h-3" aria-hidden />
          {contractPath ? 'Or link to an external copy' : 'Or paste an external link'}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="url"
            value={urlDraft}
            onChange={e => setUrlDraft(e.target.value)}
            onBlur={commitUrl}
            placeholder="https://drive.google.com/…  or  https://notion.so/…"
            className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-[12.5px] font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
          />
          {contractUrl && (
            <a
              href={contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Open external link"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-[11.5px] text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatUploadedAt(iso: string | null | undefined): string {
  if (!iso) return 'uploaded'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'uploaded'
  return `uploaded ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}
