'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/types'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

export function ProfileModal({
  userId,
  initial,
  onSave,
  onClose,
}: {
  userId: string
  initial: UserProfile
  onSave: (next: UserProfile) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(dialogRef, true)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const [fullName, setFullName] = useState(initial.fullName)
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedinUrl)
  const [pitchLine, setPitchLine] = useState(initial.pitchLine)
  const [subjectTemplate, setSubjectTemplate] = useState(initial.subjectTemplate ?? '')
  const [mailClient, setMailClient] = useState<UserProfile['mailClient']>(initial.mailClient ?? 'default')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Unipile / "Connect Gmail" + "Connect LinkedIn" state. Decoupled
  // from the save() flow because the link happens via Unipile's
  // hosted page + webhook, not the local form. We poll /api/unipile/me
  // on mount to render the right Connect / Disconnect affordance for
  // each provider.
  const [unipileEmail, setUnipileEmail] = useState<string | null>(null)
  const [unipileLinkedInUsername, setUnipileLinkedInUsername] = useState<string | null>(null)
  const [unipileLoading, setUnipileLoading] = useState(false)
  const [unipileLinkedInLoading, setUnipileLinkedInLoading] = useState(false)
  const [unipileError, setUnipileError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await fetch('/api/unipile/me', { cache: 'no-store' })
        if (!resp.ok) return
        const data = (await resp.json()) as {
          connected?: boolean
          email?: string | null
          linkedinConnected?: boolean
          linkedinUsername?: string | null
        }
        if (!cancelled && data.connected) setUnipileEmail(data.email ?? null)
        if (!cancelled && data.linkedinConnected) setUnipileLinkedInUsername(data.linkedinUsername ?? null)
      } catch {
        // best-effort — surface only when user clicks the action
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleConnectGmail() {
    setUnipileError(null)
    setUnipileLoading(true)
    try {
      const resp = await fetch('/api/unipile/connect', { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok || !data.url) {
        setUnipileError(data.error ?? 'Could not start Gmail connect flow')
        setUnipileLoading(false)
        return
      }
      // Whole-page navigation — Unipile's hosted page redirects back
      // to /unipile/connected once OAuth finishes.
      window.location.href = data.url
    } catch (e) {
      setUnipileError((e as Error).message)
      setUnipileLoading(false)
    }
  }

  async function handleConnectLinkedIn() {
    setUnipileError(null)
    setUnipileLinkedInLoading(true)
    try {
      const resp = await fetch('/api/unipile/connect-linkedin', { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok || !data.url) {
        setUnipileError(data.error ?? 'Could not start LinkedIn connect flow')
        setUnipileLinkedInLoading(false)
        return
      }
      window.location.href = data.url
    } catch (e) {
      setUnipileError((e as Error).message)
      setUnipileLinkedInLoading(false)
    }
  }

  async function handleDisconnectGmail() {
    setUnipileError(null)
    setUnipileLoading(true)
    try {
      const resp = await fetch('/api/unipile/disconnect', { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok) {
        setUnipileError(data.error ?? 'Could not disconnect')
        setUnipileLoading(false)
        return
      }
      setUnipileEmail(null)
      if (data.warning) setUnipileError(`Disconnected locally. Note: ${data.warning}`)
    } catch (e) {
      setUnipileError((e as Error).message)
    } finally {
      setUnipileLoading(false)
    }
  }

  // Reset form if the initial prop changes (e.g. user re-opens after editing)
  useEffect(() => {
    setFullName(initial.fullName)
    setLinkedinUrl(initial.linkedinUrl)
    setPitchLine(initial.pitchLine)
    setSubjectTemplate(initial.subjectTemplate ?? '')
    setMailClient(initial.mailClient ?? 'default')
  }, [initial])

  async function save() {
    setError('')
    if (!fullName.trim()) {
      setError('Full name is required')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const next: UserProfile = {
      fullName: fullName.trim(),
      linkedinUrl: linkedinUrl.trim(),
      pitchLine: pitchLine.trim(),
      subjectTemplate: subjectTemplate.trim() || undefined,
      mailClient,
    }
    const { error: err } = await supabase
      .from('user_profile')
      .update({
        full_name: next.fullName,
        linkedin_url: next.linkedinUrl,
        pitch_line: next.pitchLine,
        subject_template: next.subjectTemplate ?? null,
        mail_client: next.mailClient,
      })
      .eq('user_id', userId)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    onSave(next)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md p-7 focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 id={titleId} className="text-xl font-bold text-foreground">Profile</h2>
          <button
            onClick={onClose}
            aria-label="Close profile dialog"
            className="text-muted-foreground hover:text-foreground text-lg leading-none w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
          >✕</button>
        </div>
        <p className="text-muted-foreground text-sm mb-6">Used in your outreach emails. Edits apply to every future email you send.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Full name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              LinkedIn URL <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/your-handle"
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Pitch line <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <textarea
              value={pitchLine}
              onChange={e => setPitchLine(e.target.value)}
              placeholder="e.g. I work with YouTube creators on growth — editing, content strategy, the full picture."
              rows={3}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1">One line about what you do. Goes after &quot;I&apos;m [your name]&quot; in outreach emails.</p>
          </div>

          {/* Subject-line template — used as the actual email subject when
              the user clicks an outreach link. Supports placeholders that
              lib/format.ts substitutes per recipient at compose time. */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Subject line template <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <input
              type="text"
              value={subjectTemplate}
              onChange={e => setSubjectTemplate(e.target.value)}
              placeholder="e.g. quick question about {channel}"
              maxLength={140}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1 leading-relaxed">
              Used as the subject when you click an outreach email link. Placeholders:{' '}
              <code className="px-1 py-0.5 rounded bg-muted-foreground/10 text-foreground/80">{'{name}'}</code>{' '}
              recipient first name,{' '}
              <code className="px-1 py-0.5 rounded bg-muted-foreground/10 text-foreground/80">{'{channel}'}</code>{' '}
              channel name,{' '}
              <code className="px-1 py-0.5 rounded bg-muted-foreground/10 text-foreground/80">{'{content}'}</code>{' '}
              top video title. Leave blank to use the default subject.
            </p>
          </div>

          {/* Mail client preference — controls where outreach email
              links open. Default = OS handler via mailto:. The web
              providers open compose with to/subject/body pre-filled. */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Email link opens in
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'default', label: 'Default (mailto:)', hint: 'Apple Mail / OS default' },
                { id: 'gmail',   label: 'Gmail',             hint: 'mail.google.com' },
                { id: 'outlook', label: 'Outlook',           hint: 'outlook.office.com' },
                { id: 'yahoo',   label: 'Yahoo',             hint: 'compose.mail.yahoo.com' },
              ] as { id: UserProfile['mailClient']; label: string; hint: string }[]).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMailClient(opt.id)}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                    mailClient === opt.id
                      ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/40 text-purple-700 dark:text-purple-200'
                      : 'bg-muted border-border text-foreground/80 hover:border-border/80'
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.hint}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1.5">
              Web providers open in a new tab with the recipient + subject + body pre-filled.
            </p>
          </div>

          {/* Connect Gmail (Unipile) — the path forward. When connected
              we send programmatically via Unipile's API, eliminating
              the multi-account / wrong-To bugs entirely. Existing
              "Email link opens in" preference above stays as the
              fallback for users who don't connect. */}
          <div className="border-t border-border pt-4">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Connect Gmail for one-click sending
              <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-purple-700 dark:text-purple-300 font-bold">Beta</span>
            </label>
            {unipileEmail ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">Connected as</div>
                  <div className="text-sm font-mono text-foreground break-all">{unipileEmail}</div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectGmail}
                  disabled={unipileLoading}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-700 dark:hover:text-red-400 hover:border-red-400/60 transition-colors disabled:opacity-50"
                >
                  {unipileLoading ? 'Working…' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectGmail}
                disabled={unipileLoading}
                className="w-full rounded-lg border border-border bg-card hover:border-purple-500/60 hover:bg-purple-500/5 transition-colors px-4 py-3 text-left flex items-center gap-3 disabled:opacity-50 disabled:cursor-wait"
              >
                <span className="text-xl" aria-hidden>✉️</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">
                    {unipileLoading ? 'Opening Google…' : 'Connect Gmail'}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug">
                    One-time Google sign-in. After that, &quot;Send&quot; in our app sends from
                    your Gmail — no compose tab, no account confusion.
                  </div>
                </div>
                <span className="text-muted-foreground/60" aria-hidden>→</span>
              </button>
            )}
            {unipileError && (
              <div className="mt-2 text-[11px] text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-2.5 py-1.5 leading-relaxed">
                {unipileError}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-relaxed">
              Sends via Unipile, an email infrastructure provider. They get access to
              messages you send / receive through this connection. Disconnect any time.
            </p>
          </div>

          {/* Connect LinkedIn (Phase 6) — same hosted-auth flow as
              Gmail, lets us send connection requests + DMs from your
              real LinkedIn account. Heavy usage risks LinkedIn flagging
              the account, so default off and gated per-action. */}
          <div className="border-t border-border pt-4">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Connect LinkedIn for outreach DMs
              <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-purple-700 dark:text-purple-300 font-bold">Beta</span>
            </label>
            {unipileLinkedInUsername ? (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">LinkedIn connected</div>
                  <div className="text-sm font-mono text-foreground break-all">{unipileLinkedInUsername}</div>
                </div>
                <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-blue-700 dark:text-blue-300">Active</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectLinkedIn}
                disabled={unipileLinkedInLoading}
                className="w-full rounded-lg border border-border bg-card hover:border-blue-500/60 hover:bg-blue-500/5 transition-colors px-4 py-3 text-left flex items-center gap-3 disabled:opacity-50 disabled:cursor-wait"
              >
                <span className="text-xl" aria-hidden>in</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">
                    {unipileLinkedInLoading ? 'Opening LinkedIn…' : 'Connect LinkedIn'}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug">
                    DMs + connection requests come from your real account.
                    Heavy usage can trigger LinkedIn flags — keep activity human-paced.
                  </div>
                </div>
                <span className="text-muted-foreground/60" aria-hidden>→</span>
              </button>
            )}
          </div>
        </div>

        {error && <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2 mt-4">{error}</div>}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
