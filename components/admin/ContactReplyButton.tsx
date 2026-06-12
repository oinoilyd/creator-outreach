'use client'

/**
 * ContactReplyButton — Phase 4 inquiry reply.
 *
 * On a contact_messages row, lets the admin answer in-app: spins a
 * direct thread to the matching account (+ emails them). If no account
 * matches the inquiry email (public sender), it falls back to a plain
 * mailto so the admin can still respond.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, MessageSquarePlus, Mail } from 'lucide-react'
import { replyFromContact } from '@/lib/inbox-admin'

export function ContactReplyButton({
  contactId, email, resolved,
}: {
  contactId: string
  email: string
  resolved: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noAccount, setNoAccount] = useState(false)
  const [done, setDone] = useState(false)

  async function send() {
    if (!body.trim() || sending) return
    setSending(true); setError(null); setNoAccount(false)
    const res = await replyFromContact(contactId, body.trim())
    setSending(false)
    if (res.ok) {
      setDone(true)
      setOpen(false)
      router.refresh() // inquiry is now resolved + thread exists
      return
    }
    if (res.noAccount) { setNoAccount(true); return }
    setError(res.error || 'Failed to send.')
  }

  if (done) {
    return <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Replied in-app ✓</span>
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded border border-blue-500/40 text-blue-600 dark:text-blue-300 hover:bg-blue-500/10 transition-colors inline-flex items-center gap-1.5"
      >
        <MessageSquarePlus className="w-3.5 h-3.5" />
        {resolved ? 'Message in-app' : 'Reply in-app'}
      </button>
    )
  }

  return (
    <div className="mt-3 w-full">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        placeholder="Write your reply… (delivered to their in-app inbox + email)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-blue-500/50 resize-y"
      />
      {noAccount && (
        <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2 flex-wrap">
          <span>No account matches {email} — reply by email instead:</span>
          <a
            href={`mailto:${email}?subject=${encodeURIComponent('Re: your message on Creator Outreach')}&body=${encodeURIComponent(body)}`}
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-300 hover:underline"
          >
            <Mail className="w-3.5 h-3.5" /> Open email
          </a>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={send}
          disabled={sending || !body.trim()}
          className="text-xs px-3 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Send in-app
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); setNoAccount(false) }}
          className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
