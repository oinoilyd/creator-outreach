'use client'

/**
 * SendPreviewModal — last-line-of-defense preview before sending
 * outreach via Unipile.
 *
 * Shown when the user clicks "Send Email" on a row whose user has
 * connected Gmail via Unipile (Phase 1). Renders the recipient,
 * subject, and body verbatim so a wrong-To or template glitch can be
 * caught before money leaves the wallet, then fires POST /api/unipile/send.
 *
 * The To, Subject, and Body are editable inline — user can tweak the
 * pitch one-off without going back to the profile to change the
 * subject template, and can re-target if the auto-resolved email is
 * wrong.
 */

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { Sparkles, Undo2, Loader2 } from 'lucide-react'

interface Props {
  /** Outreach entry id — sent server-side so the API can persist
   *  message_id / thread_id / tracking_id back onto the row. */
  entryId: string
  /** Initial recipient (may be edited). */
  to: string
  /** Initial subject + body (templated by the parent — see lib/format
   *  buildOutreachEmail for the source). User can edit before send. */
  initialSubject: string
  initialBody: string
  /** Shown in the header for context — "to Ryan Gaynor" etc. */
  recipientLabel?: string
  /** User's physical business address. When null/empty we surface a
   *  yellow CAN-SPAM warning at the top of the modal nudging the
   *  user to set one in their profile before sending commercial mail. */
  physicalAddress?: string | null
  /** Called when the user clicks "Settings → Profile" inside the
   *  warning banner. Parent should close this modal and open the
   *  profile editor. */
  onOpenProfile?: () => void
  /** When true, the primary CTA + dialog title read "Send follow-up"
   *  instead of "Send outreach". Set by the caller — Follow-up rows
   *  always pass true; the Lead Detail modal computes it from whether
   *  the entry has already been contacted. */
  isFollowUp?: boolean
  onClose: () => void
  /** Called with the Unipile response after a successful send so the
   *  parent can update local state without a refetch. */
  onSent: (result: {
    entryId: string
    messageId: string | null
    threadId: string | null
    providerId: string | null
    trackingId: string | null
  }) => void
}

export function SendPreviewModal({
  entryId,
  to: initialTo,
  initialSubject,
  initialBody,
  recipientLabel,
  physicalAddress,
  onOpenProfile,
  isFollowUp = false,
  onClose,
  onSent,
}: Props) {
  // Single source of truth for the verb used throughout the modal —
  // follow-up flows call this 'follow-up' instead of 'outreach' so
  // the user has unambiguous context about what they're about to send.
  const actionVerb = isFollowUp ? 'follow-up' : 'outreach'
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  const [to, setTo] = useState(initialTo)
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [enableOpenTracking, setEnableOpenTracking] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // AI-rewrite state: when the user hits "Rewrite with AI" we POST to
  // /api/ai/rewrite-outreach with the current draft + the entryId so
  // the server can pull channel context. The previous draft is
  // captured in `previousDraft` so the user can one-click undo.
  const [aiIntent, setAiIntent] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [previousDraft, setPreviousDraft] = useState<{ subject: string; body: string } | null>(null)

  async function handleRewriteWithAi() {
    setAiError(null)
    setAiBusy(true)
    // Snapshot the current draft BEFORE the call so an Undo is always
    // possible — even if the call fails partway through state updates.
    const snapshot = { subject, body }
    try {
      const resp = await fetch('/api/ai/rewrite-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId,
          currentSubject: subject,
          currentBody: body,
          intent: aiIntent.trim() || undefined,
        }),
      })
      const data = await resp.json() as { subject?: string; body?: string; error?: string }
      if (!resp.ok) {
        throw new Error(data.error || `Rewrite failed (${resp.status}).`)
      }
      const newSubject = (data.subject ?? snapshot.subject).trim() || snapshot.subject
      const newBody = (data.body ?? '').trim()
      if (!newBody) throw new Error('AI returned an empty body.')
      setPreviousDraft(snapshot)
      setSubject(newSubject)
      setBody(newBody)
      toast.success('Rewrite applied — review before sending.', { duration: 2400 })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setAiError(msg)
    } finally {
      setAiBusy(false)
    }
  }

  function handleUndoAi() {
    if (!previousDraft) return
    setSubject(previousDraft.subject)
    setBody(previousDraft.body)
    setPreviousDraft(null)
    setAiError(null)
    toast.message('Reverted to your previous draft.')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sending])

  async function handleSend() {
    setError(null)
    setSending(true)
    try {
      const resp = await fetch('/api/unipile/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId,
          to,
          subject,
          body,
          toDisplayName: recipientLabel,
          enableOpenTracking,
          enableLinkTracking: enableOpenTracking,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        // 409 + suppressed flag is the CAN-SPAM unsubscribe path —
        // surface a calm, non-destructive toast rather than the
        // generic red error block, then close the modal so the user
        // doesn't have a half-staged send sitting open.
        if (resp.status === 409 && data?.suppressed) {
          toast.error('Recipient has unsubscribed and cannot be contacted.', {
            description:
              data.reason && data.reason !== 'unsubscribed'
                ? `Marked as "${data.reason}" — they won't receive future outreach from you.`
                : 'They removed themselves from your outreach list — they won\'t receive future emails from you.',
          })
          setSending(false)
          onClose()
          return
        }
        setError(data.hint ? `${data.error}\n${data.hint}` : data.error || `HTTP ${resp.status}`)
        setSending(false)
        return
      }
      toast.success('Email sent', {
        description: `Delivered via your connected Gmail. Reply will auto-classify when it arrives.`,
      })
      onSent({
        entryId,
        messageId: data.sent?.messageId ?? null,
        threadId: data.sent?.threadId ?? null,
        providerId: data.sent?.providerId ?? null,
        trackingId: data.sent?.trackingId ?? null,
      })
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => {
        if (!sending) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-preview-title"
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-2xl p-6 focus:outline-none max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h2 id="send-preview-title" className="text-lg font-bold text-foreground">
              Send {actionVerb}{recipientLabel ? ` to ${recipientLabel}` : ''}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Final preview. Tweak anything below — we send via your connected Gmail when you hit Send.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Cancel"
            className="text-muted-foreground hover:text-foreground text-lg leading-none w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        {!physicalAddress?.trim() && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
          >
            <span className="font-semibold">
              <span aria-hidden>⚠️ </span>No business address set in your profile.
            </span>{' '}
            CAN-SPAM requires every commercial email to include your physical address. Add one in{' '}
            {onOpenProfile ? (
              <button
                type="button"
                onClick={onOpenProfile}
                className="underline underline-offset-2 font-semibold hover:opacity-80"
              >
                Settings → Profile
              </button>
            ) : (
              <span className="font-semibold">Settings → Profile</span>
            )}
            .
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] font-bold text-muted-foreground mb-1">
              To
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={sending}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500 font-mono disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] font-bold text-muted-foreground mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] font-bold text-muted-foreground mb-1">
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              disabled={sending || aiBusy}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500 font-mono leading-relaxed resize-y disabled:opacity-60"
            />
            {/* AI-rewrite toolbar — sits flush under the body textarea.
                Optional intent hint + Rewrite button. Undo appears
                once a rewrite has been applied. */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={aiIntent}
                onChange={e => setAiIntent(e.target.value)}
                disabled={sending || aiBusy}
                placeholder="Optional: 'shorter', 'more casual', 'lead with their last video'…"
                className="flex-1 min-w-[200px] bg-background border border-border rounded-md px-2.5 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:border-purple-500 disabled:opacity-60"
                aria-label="Optional intent hint for the AI rewrite"
              />
              <button
                type="button"
                onClick={handleRewriteWithAi}
                disabled={sending || aiBusy || !body.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-br from-purple-600 to-blue-600 text-white text-[12.5px] font-semibold hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-purple-500/20"
                title="Rewrite this draft using AI, with the creator's channel context"
              >
                {aiBusy
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rewriting…</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Rewrite with AI</>}
              </button>
              {previousDraft && (
                <button
                  type="button"
                  onClick={handleUndoAi}
                  disabled={sending || aiBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-[12.5px] text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  title="Revert to the draft before the AI rewrite"
                >
                  <Undo2 className="w-3.5 h-3.5" /> Undo
                </button>
              )}
            </div>
            {aiError && (
              <p className="mt-1.5 text-[11.5px] text-red-600 dark:text-red-400">
                {aiError}
              </p>
            )}
            {!aiError && (
              <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                AI sees this draft + the creator&apos;s channel name, niche, and
                description. It won&apos;t invent details — if the channel has no
                description it&apos;ll keep the rewrite generic.
              </p>
            )}
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableOpenTracking}
              onChange={(e) => setEnableOpenTracking(e.target.checked)}
              disabled={sending}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold text-foreground">Track opens + link clicks.</span>{' '}
              Useful for follow-up timing — but Gmail flags pixel-tracked emails as
              &quot;may track activity&quot; on first contact, which can hurt deliverability.
              Off by default for cold sends, on for follow-ups.
            </span>
          </label>
        </div>

        {error && (
          <div className="mt-4 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2 whitespace-pre-line leading-relaxed">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-5 py-2 bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-wait shadow-md shadow-purple-500/20"
          >
            {sending ? 'Sending…' : `Send ${actionVerb}`}
          </button>
        </div>
      </div>
    </div>
  )
}
