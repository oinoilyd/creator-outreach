'use client'

/**
 * InboxBell — the user-facing side of the two-way inbox (migration 0042).
 *
 * A bell in the top bar with an unread badge. Click opens a dropdown
 * that lists the user's threads (admin broadcasts + their own direct
 * messages). Opening a thread shows the conversation and — for direct
 * threads or reply-enabled broadcasts — a composer.
 *
 * Unlike the insight pills, this is visible on mobile too: an unread
 * message from the admin matters more than header tidiness. The label
 * collapses to just the icon below sm.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Inbox as InboxIcon, X as XIcon, ChevronLeft, Send, Loader2, Megaphone, Trash2, PenSquare } from 'lucide-react'
import {
  fetchInbox, fetchThread, replyToThread, dismissThread, startThread,
  type InboxThreadSummary, type InboxThreadDetail,
} from '@/lib/inbox'

// Background list refresh (unread badge). The open thread polls faster
// so a live back-and-forth feels responsive.
const POLL_MS = 90_000
const THREAD_POLL_MS = 12_000

export function InboxBell() {
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState<InboxThreadSummary[]>([])
  const [unread, setUnread] = useState(0)
  const [loadingList, setLoadingList] = useState(false)
  const [active, setActive] = useState<InboxThreadDetail | null>(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const [composing, setComposing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const refreshList = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetchInbox()
      setThreads(res.threads)
      setUnread(res.unreadCount)
    } finally {
      setLoadingList(false)
    }
  }, [])

  // Initial load + background poll for the unread badge.
  useEffect(() => {
    void refreshList()
    const id = window.setInterval(() => { void refreshList() }, POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshList])

  // Click-outside / Escape close.
  useEffect(() => {
    if (!open) return
    function onClick(ev: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(ev.target as Node)) setOpen(false)
    }
    function onKey(ev: KeyboardEvent) { if (ev.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // While a thread is open, poll it so the other side's new messages
  // appear without the user having to close + reopen.
  const activeId = active?.id ?? null
  useEffect(() => {
    if (!activeId) return
    const id = window.setInterval(async () => {
      const fresh = await fetchThread(activeId)
      if (fresh) setActive(fresh)
    }, THREAD_POLL_MS)
    return () => window.clearInterval(id)
  }, [activeId])

  async function openThread(id: string) {
    setComposing(false)
    setLoadingThread(true)
    try {
      const detail = await fetchThread(id)
      setActive(detail)
      // Opening marks it read server-side; reflect that locally.
      setThreads(prev => prev.map(t => (t.id === id ? { ...t, unread: false } : t)))
      setUnread(u => Math.max(0, u - (threads.find(t => t.id === id)?.unread ? 1 : 0)))
    } finally {
      setLoadingThread(false)
    }
  }

  async function handleSent(result: { ok: boolean; newThreadId?: string }) {
    if (!result.ok) return
    if (result.newThreadId) {
      // Broadcast reply → jump into the freshly spun direct thread.
      await refreshList()
      await openThread(result.newThreadId)
    } else if (active) {
      const detail = await fetchThread(active.id)
      setActive(detail)
      void refreshList()
    }
  }

  async function handleDismiss(id: string) {
    setThreads(prev => prev.filter(t => t.id !== id))
    await dismissThread(id)
    void refreshList()
  }

  function back() { setActive(null); void refreshList() }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Open inbox"
        aria-expanded={open}
        title="Inbox"
        className={[
          'relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors',
          open
            ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
            : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80',
        ].join(' ')}
      >
        <InboxIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span className="whitespace-nowrap hidden sm:inline">Inbox</span>
        {unread > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center shadow-sm"
            aria-label={`${unread} unread`}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] bg-card border border-border rounded-xl shadow-2xl shadow-black/30 z-40 overflow-hidden">
          {composing ? (
            <ComposeView
              onBack={() => setComposing(false)}
              onStarted={async (id) => { setComposing(false); await refreshList(); await openThread(id) }}
            />
          ) : active ? (
            <ThreadView
              detail={active}
              onBack={back}
              onSent={handleSent}
              loading={loadingThread}
            />
          ) : (
            <ThreadList
              threads={threads}
              loading={loadingList}
              onOpen={openThread}
              onClose={() => setOpen(false)}
              onDismiss={handleDismiss}
              onCompose={() => setComposing(true)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Thread list ─────────────────────────────────────────────────────

function ThreadList({
  threads, loading, onOpen, onClose, onDismiss, onCompose,
}: {
  threads: InboxThreadSummary[]
  loading: boolean
  onOpen: (id: string) => void
  onClose: () => void
  onDismiss: (id: string) => void
  onCompose: () => void
}) {
  return (
    <>
      <div className="px-4 pt-3.5 pb-2.5 border-b border-border flex items-center gap-2">
        <div className="shrink-0 w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
          <InboxIcon className="w-3.5 h-3.5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-foreground">Inbox</div>
          <div className="text-[10.5px] text-muted-foreground/75">Updates &amp; messages</div>
        </div>
        <button
          type="button"
          onClick={onCompose}
          aria-label="New message"
          title="New message"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-500/10 px-2 py-1 rounded-md transition-colors"
        >
          <PenSquare className="w-3.5 h-3.5" /> New
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/40 transition-colors"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="max-h-[24rem] overflow-y-auto">
        {loading && threads.length === 0 ? (
          <div className="px-4 py-6 space-y-2">
            <div className="h-3 bg-muted/60 rounded animate-pulse w-10/12" />
            <div className="h-3 bg-muted/60 rounded animate-pulse w-7/12" />
          </div>
        ) : threads.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <InboxIcon className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" aria-hidden />
            <p className="text-[12.5px] text-muted-foreground">No messages yet.</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5 mb-3">
              Product updates and replies land here.
            </p>
            <button
              type="button"
              onClick={onCompose}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              <PenSquare className="w-3.5 h-3.5" /> Message the team
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {threads.map(t => (
              <li key={t.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onOpen(t.id)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-start gap-2.5"
                >
                  <span className="shrink-0 mt-0.5">
                    {t.type === 'broadcast'
                      ? <Megaphone className="w-3.5 h-3.5 text-indigo-500" aria-hidden />
                      : <InboxIcon className="w-3.5 h-3.5 text-blue-500" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={[
                        'truncate text-[12.5px]',
                        t.unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/90',
                      ].join(' ')}>
                        {t.subject || (t.type === 'broadcast' ? 'Announcement' : 'Message')}
                      </span>
                      {t.unread && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden />}
                    </span>
                    {t.lastMessage && (
                      <span className="block truncate text-[11.5px] text-muted-foreground mt-0.5">
                        {t.lastMessage.fromAdmin ? '' : 'You: '}{t.lastMessage.body}
                      </span>
                    )}
                    <span className="block text-[10px] text-muted-foreground/60 mt-0.5">
                      {relativeTime(t.updatedAt)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(t.id)}
                  aria-label="Dismiss"
                  title="Dismiss"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-red-500 p-1 rounded hover:bg-muted/60 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

// ── Thread detail + composer ────────────────────────────────────────

function ThreadView({
  detail, onBack, onSent, loading,
}: {
  detail: InboxThreadDetail
  onBack: () => void
  onSent: (r: { ok: boolean; newThreadId?: string }) => void
  loading: boolean
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const canReply = detail.type === 'direct' || detail.allowReplies

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [detail.messages.length])

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    const res = await replyToThread(detail.id, body)
    setSending(false)
    if (!res.ok) { setError(res.error || 'Failed to send.'); return }
    setText('')
    onSent(res)
  }

  return (
    <>
      <div className="px-3 pt-3 pb-2.5 border-b border-border flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/40 transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold text-foreground">
            {detail.subject || (detail.type === 'broadcast' ? 'Announcement' : 'Message')}
          </div>
          <div className="text-[10.5px] text-muted-foreground/75 flex items-center gap-1">
            {detail.type === 'broadcast'
              ? <><Megaphone className="w-3 h-3" aria-hidden /> Announcement</>
              : <>Direct message</>}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[20rem] overflow-y-auto px-3 py-3 space-y-2.5">
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 bg-muted/50 rounded-lg animate-pulse w-8/12" />
            <div className="h-8 bg-muted/50 rounded-lg animate-pulse w-6/12 ml-auto" />
          </div>
        ) : detail.messages.length === 0 ? (
          <p className="text-[12px] text-muted-foreground text-center py-4">No messages.</p>
        ) : (
          detail.messages.map(m => (
            <div key={m.id} className={['flex', m.fromAdmin ? 'justify-start' : 'justify-end'].join(' ')}>
              <div className={[
                'max-w-[80%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words',
                m.fromAdmin
                  ? 'bg-muted/60 text-foreground rounded-tl-sm'
                  : 'bg-blue-500 text-white rounded-tr-sm',
              ].join(' ')}>
                {m.body}
                <span className={[
                  'block text-[9.5px] mt-1',
                  m.fromAdmin ? 'text-muted-foreground/60' : 'text-white/70',
                ].join(' ')}>
                  {m.fromAdmin ? 'Creator Outreach' : 'You'} · {relativeTime(m.createdAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {canReply ? (
        <div className="border-t border-border p-2.5">
          {detail.type === 'broadcast' && (
            <p className="text-[10px] text-muted-foreground/70 mb-1.5 px-1">
              Your reply starts a private message to the team.
            </p>
          )}
          {error && <p className="text-[11px] text-red-600 dark:text-red-400 mb-1.5 px-1">{error}</p>}
          <div className="flex items-end gap-1.5">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() }
              }}
              rows={1}
              placeholder="Write a reply…"
              className="flex-1 resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 max-h-24"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !text.trim()}
              aria-label="Send"
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border px-3 py-2.5 text-center">
          <p className="text-[11px] text-muted-foreground/70">This is an announcement — replies are off.</p>
        </div>
      )}
    </>
  )
}

// ── Compose a new message to the team ───────────────────────────────

function ComposeView({
  onBack, onStarted,
}: {
  onBack: () => void
  onStarted: (threadId: string) => void
}) {
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true); setError(null)
    const res = await startThread(subject.trim(), body)
    setSending(false)
    if (!res.ok || !res.threadId) { setError(res.error || 'Could not send.'); return }
    onStarted(res.threadId)
  }

  return (
    <>
      <div className="px-3 pt-3 pb-2.5 border-b border-border flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/40 transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-foreground">New message</div>
          <div className="text-[10.5px] text-muted-foreground/75">Goes straight to the team</div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-blue-500/50"
        />
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() } }}
          rows={4}
          placeholder="What's on your mind?"
          autoFocus
          className="w-full resize-y min-h-[5rem] rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-blue-500/50"
        />
        {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onBack}
            className="text-[12px] text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || !text.trim()}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed px-3.5 py-1.5 rounded-lg transition-colors"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send
          </button>
        </div>
      </div>
    </>
  )
}

// ── helpers ─────────────────────────────────────────────────────────

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
