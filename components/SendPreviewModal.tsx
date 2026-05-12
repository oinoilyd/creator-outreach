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
  onClose,
  onSent,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  const [to, setTo] = useState(initialTo)
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [enableOpenTracking, setEnableOpenTracking] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
              Send outreach{recipientLabel ? ` to ${recipientLabel}` : ''}
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
              disabled={sending}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500 font-mono leading-relaxed resize-y disabled:opacity-60"
            />
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
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
