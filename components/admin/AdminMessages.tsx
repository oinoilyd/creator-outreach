'use client'

/**
 * AdminMessages — the admin side of the two-way inbox (Phase 3).
 *
 * Left: a composer (broadcast vs. direct) + the thread list.
 * Right: the selected conversation with an admin reply box.
 *
 * Broadcasts carry an "Allow replies" toggle — on means a user's reply
 * spins a private direct thread (discussion); off means announcement.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Megaphone, Send, Loader2, User as UserIcon, MessageSquare, RefreshCw } from 'lucide-react'
import {
  fetchAdminInbox, fetchAdminThread, createAdminThread, adminReply,
  type AdminThreadSummary, type AdminRecipient, type AdminThreadDetail,
} from '@/lib/inbox-admin'

export function AdminMessages() {
  const [threads, setThreads] = useState<AdminThreadSummary[]>([])
  const [recipients, setRecipients] = useState<AdminRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminThreadDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const refresh = useCallback(async () => {
    const res = await fetchAdminInbox()
    setThreads(res.threads)
    setRecipients(res.recipients)
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const openThread = useCallback(async (id: string) => {
    setSelectedId(id)
    setLoadingDetail(true)
    try {
      setDetail(await fetchAdminThread(id))
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  async function afterReply() {
    if (selectedId) setDetail(await fetchAdminThread(selectedId))
    void refresh()
  }

  async function afterCompose(newId?: string) {
    await refresh()
    if (newId) void openThread(newId)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5">
      {/* Left — composer + list */}
      <div className="space-y-5">
        <Composer recipients={recipients} onSent={afterCompose} />
        <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">All threads</span>
            <button
              type="button"
              onClick={() => { void refresh() }}
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/40 transition-colors"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              <div className="h-3 bg-muted/60 rounded animate-pulse w-10/12" />
              <div className="h-3 bg-muted/60 rounded animate-pulse w-7/12" />
            </div>
          ) : threads.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No threads yet. Send your first broadcast or direct message above.
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-[28rem] overflow-y-auto">
              {threads.map(t => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openThread(t.id)}
                    className={[
                      'w-full text-left px-4 py-3 flex items-start gap-2.5 transition-colors',
                      selectedId === t.id ? 'bg-blue-500/10' : 'hover:bg-muted/40',
                    ].join(' ')}
                  >
                    <span className="shrink-0 mt-0.5">
                      {t.type === 'broadcast'
                        ? <Megaphone className="w-3.5 h-3.5 text-indigo-500" aria-hidden />
                        : <UserIcon className="w-3.5 h-3.5 text-blue-500" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate text-[12.5px] font-medium text-foreground">
                          {t.subject || (t.type === 'broadcast' ? 'Announcement' : 'Direct message')}
                        </span>
                        {t.needsReply && (
                          <span className="shrink-0 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold">
                            needs reply
                          </span>
                        )}
                        {t.fromInquiry && (
                          <span className="shrink-0 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 font-semibold">
                            inquiry
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground mt-0.5">
                        {t.type === 'direct' && t.withEmail ? `${t.withEmail} · ` : ''}
                        {t.lastMessage ? `${t.lastMessage.fromAdmin ? 'You: ' : ''}${t.lastMessage.body}` : 'No messages'}
                      </span>
                      <span className="block text-[10px] text-muted-foreground/60 mt-0.5">{relativeTime(t.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right — selected thread */}
      <div className="rounded-xl border border-border bg-card/40 min-h-[24rem] flex flex-col">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-3" aria-hidden />
            <p className="text-sm text-muted-foreground">Select a thread to read and reply.</p>
          </div>
        ) : (
          <AdminThreadView
            detail={detail}
            loading={loadingDetail}
            onReplied={afterReply}
          />
        )}
      </div>
    </div>
  )
}

// ── Composer ────────────────────────────────────────────────────────

function Composer({
  recipients, onSent,
}: {
  recipients: AdminRecipient[]
  onSent: (newId?: string) => void
}) {
  const [kind, setKind] = useState<'broadcast' | 'direct'>('broadcast')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [allowReplies, setAllowReplies] = useState(true)
  const [targetUserId, setTargetUserId] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function submit() {
    if (sending) return
    setError(null); setOk(false)
    if (!body.trim()) { setError('Message body is required.'); return }
    if (kind === 'direct' && !targetUserId) { setError('Pick a recipient.'); return }
    setSending(true)
    const res = await createAdminThread({
      kind,
      subject: subject.trim(),
      body: body.trim(),
      allowReplies: kind === 'broadcast' ? allowReplies : true,
      targetUserId: kind === 'direct' ? targetUserId : undefined,
    })
    setSending(false)
    if (!res.ok) { setError(res.error || 'Failed to send.'); return }
    setOk(true)
    setSubject(''); setBody(''); setTargetUserId('')
    onSent(res.threadId)
    window.setTimeout(() => setOk(false), 2500)
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-1 mb-3 p-0.5 bg-muted/40 rounded-lg w-fit">
        {(['broadcast', 'direct'] as const).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
              kind === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {k === 'broadcast' ? <Megaphone className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
            {k === 'broadcast' ? 'Broadcast' : 'Direct'}
          </button>
        ))}
      </div>

      {kind === 'direct' && (
        <select
          value={targetUserId}
          onChange={e => setTargetUserId(e.target.value)}
          className="w-full mb-2.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-blue-500/50"
        >
          <option value="">Select recipient…</option>
          {recipients.map(r => (
            <option key={r.userId} value={r.userId}>{r.email}</option>
          ))}
        </select>
      )}

      <input
        type="text"
        value={subject}
        onChange={e => setSubject(e.target.value)}
        placeholder={kind === 'broadcast' ? 'Subject (e.g. New feature: …)' : 'Subject'}
        className="w-full mb-2.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-blue-500/50"
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={4}
        placeholder={kind === 'broadcast' ? 'Write a site-wide update…' : 'Write a direct message…'}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-blue-500/50 resize-y min-h-[5rem]"
      />

      {kind === 'broadcast' && (
        <label className="flex items-center gap-2 mt-2.5 text-[12px] text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allowReplies}
            onChange={e => setAllowReplies(e.target.checked)}
            className="rounded border-border"
          />
          Allow replies
          <span className="text-[10.5px] text-muted-foreground/60">
            ({allowReplies ? 'a reply opens a private thread' : 'announcement only'})
          </span>
        </label>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="text-[11px]">
          {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
          {ok && <span className="text-emerald-600 dark:text-emerald-400">Sent.</span>}
          {kind === 'direct' && !error && !ok && <span className="text-muted-foreground/60">Also emails the recipient.</span>}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={sending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500 text-white text-[12.5px] font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {kind === 'broadcast' ? 'Broadcast' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// ── Admin thread view ───────────────────────────────────────────────

function AdminThreadView({
  detail, loading, onReplied,
}: {
  detail: AdminThreadDetail | null
  loading: boolean
  onReplied: () => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [detail?.messages.length])

  async function send() {
    if (!detail || !text.trim() || sending) return
    setSending(true); setError(null)
    const res = await adminReply(detail.id, text.trim())
    setSending(false)
    if (!res.ok) { setError(res.error || 'Failed to send.'); return }
    setText('')
    onReplied()
  }

  if (loading || !detail) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
      </div>
    )
  }

  const isBroadcast = detail.type === 'broadcast'

  return (
    <>
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          {isBroadcast
            ? <Megaphone className="w-3.5 h-3.5 text-indigo-500" aria-hidden />
            : <UserIcon className="w-3.5 h-3.5 text-blue-500" aria-hidden />}
          <span className="text-[13px] font-semibold text-foreground truncate">
            {detail.subject || (isBroadcast ? 'Announcement' : 'Direct message')}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground/75 mt-0.5">
          {isBroadcast
            ? `Broadcast · ${detail.allowReplies ? 'replies on' : 'announcement only'}`
            : `with ${detail.withEmail ?? 'user'}`}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 max-h-[24rem]">
        {detail.messages.length === 0 ? (
          <p className="text-[12px] text-muted-foreground text-center py-4">No messages.</p>
        ) : (
          detail.messages.map(m => (
            <div key={m.id} className={['flex', m.fromAdmin ? 'justify-end' : 'justify-start'].join(' ')}>
              <div className={[
                'max-w-[80%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words',
                m.fromAdmin
                  ? 'bg-blue-500 text-white rounded-tr-sm'
                  : 'bg-muted/60 text-foreground rounded-tl-sm',
              ].join(' ')}>
                {m.body}
                <span className={['block text-[9.5px] mt-1', m.fromAdmin ? 'text-white/70' : 'text-muted-foreground/60'].join(' ')}>
                  {m.fromAdmin ? 'You' : (detail.withEmail ?? 'User')} · {relativeTime(m.createdAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {isBroadcast ? (
        <div className="border-t border-border px-4 py-3 text-center text-[11px] text-muted-foreground/70">
          This is a broadcast. To continue a conversation, reply inside the private thread a user starts.
        </div>
      ) : (
        <div className="border-t border-border p-3">
          {error && <p className="text-[11px] text-red-600 dark:text-red-400 mb-1.5">{error}</p>}
          <div className="flex items-end gap-1.5">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() } }}
              rows={1}
              placeholder="Write a reply… (⌘↵ to send)"
              className="flex-1 resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-blue-500/50 max-h-28"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !text.trim()}
              aria-label="Send"
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── helper ──────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.round(ms / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  if (d < 7) return `${d}d ago`
  return `${Math.round(d / 7)}w ago`
}
