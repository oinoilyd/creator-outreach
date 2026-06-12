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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Megaphone, Send, Loader2, User as UserIcon, MessageSquare, RefreshCw, Lock, RotateCcw, Search, PenSquare, X as XIcon, BookText, Trash2, Plus, Inbox as InboxIcon, Clock, CheckCircle2, Mail, Layers, ChevronLeft, type LucideIcon } from 'lucide-react'
import {
  fetchAdminInbox, fetchAdminThread, createAdminThread, adminReply, closeThread,
  fetchSavedReplies, createSavedReply, deleteSavedReply,
  type AdminThreadSummary, type AdminRecipient, type AdminThreadDetail, type SavedReply,
} from '@/lib/inbox-admin'

// Background refresh of the thread list; the open thread polls faster.
const POLL_MS = 20_000
const THREAD_POLL_MS = 10_000

type SegmentKey = 'needs_reply' | 'open' | 'closed' | 'inquiry' | 'broadcast' | 'all'
const SEGMENTS: { key: SegmentKey; label: string; icon: LucideIcon }[] = [
  { key: 'needs_reply', label: 'Needs reply', icon: Clock },
  { key: 'open', label: 'Open', icon: InboxIcon },
  { key: 'closed', label: 'Closed', icon: CheckCircle2 },
  { key: 'inquiry', label: 'Inquiries', icon: Mail },
  { key: 'broadcast', label: 'Broadcasts', icon: Megaphone },
  { key: 'all', label: 'All', icon: Layers },
]

function inSegment(t: AdminThreadSummary, seg: SegmentKey): boolean {
  switch (seg) {
    case 'needs_reply': return t.needsReply
    case 'open': return t.type === 'direct' && !t.closedAt
    case 'closed': return t.type === 'direct' && !!t.closedAt
    case 'inquiry': return t.fromInquiry
    case 'broadcast': return t.type === 'broadcast'
    case 'all': return true
  }
}

function matchesQuery(t: AdminThreadSummary, q: string): boolean {
  if (!q) return true
  const hay = `${t.withEmail ?? ''} ${t.subject ?? ''} ${t.lastMessage?.body ?? ''}`.toLowerCase()
  return hay.includes(q)
}

export function AdminMessages() {
  const [threads, setThreads] = useState<AdminThreadSummary[]>([])
  const [recipients, setRecipients] = useState<AdminRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminThreadDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [segment, setSegment] = useState<SegmentKey>('needs_reply')
  const [query, setQuery] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const res = await fetchAdminInbox()
    setThreads(res.threads)
    setRecipients(res.recipients)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => { void refresh() }, POLL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  const openThread = useCallback(async (id: string) => {
    setSelectedId(id)
    setLoadingDetail(true)
    try {
      setDetail(await fetchAdminThread(id))
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  // Poll the open thread too, so an incoming reply appears live.
  useEffect(() => {
    if (!selectedId) return
    const id = window.setInterval(async () => {
      const fresh = await fetchAdminThread(selectedId)
      if (fresh) setDetail(fresh)
    }, THREAD_POLL_MS)
    return () => window.clearInterval(id)
  }, [selectedId])

  async function afterReply() {
    if (selectedId) setDetail(await fetchAdminThread(selectedId))
    void refresh()
  }

  async function afterCompose(newId?: string) {
    setComposeOpen(false)
    await refresh()
    if (newId) void openThread(newId)
  }

  // Per-segment counts (off the full set, before search).
  const counts = useMemo(() => {
    const c = {} as Record<SegmentKey, number>
    for (const s of SEGMENTS) c[s.key] = 0
    for (const t of threads) for (const s of SEGMENTS) if (inSegment(t, s.key)) c[s.key]++
    return c
  }, [threads])

  // Filtered + searched + sorted list for the active segment.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = threads.filter(t => inSegment(t, segment) && matchesQuery(t, q))
    const ts = (t: AdminThreadSummary) => new Date(t.lastMessage?.createdAt ?? t.updatedAt).getTime()
    // Needs-reply → longest-waiting first; everything else → newest first.
    list.sort((a, b) => segment === 'needs_reply' ? ts(a) - ts(b) : ts(b) - ts(a))
    return list
  }, [threads, segment, query])

  // Oldest unanswered ticket — the key triage health stat.
  const oldestWaiting = useMemo(() => {
    let oldest: string | null = null
    for (const t of threads) {
      if (!t.needsReply) continue
      const at = t.lastMessage?.createdAt ?? t.updatedAt
      if (!oldest || new Date(at).getTime() < new Date(oldest).getTime()) oldest = at
    }
    return oldest
  }, [threads])

  // Keyboard shortcuts: j/k move, r reply, c close/reopen, / search, Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus(); return }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) { setQuery(''); searchRef.current?.blur(); return }
      if (typing) return
      if (e.key === 'j' || e.key === 'k') {
        if (visible.length === 0) return
        e.preventDefault()
        const idx = visible.findIndex(t => t.id === selectedId)
        const next = idx === -1 ? 0 : Math.max(0, Math.min(visible.length - 1, idx + (e.key === 'j' ? 1 : -1)))
        void openThread(visible[next].id)
        return
      }
      if (e.key === 'r' && selectedId) { e.preventDefault(); window.dispatchEvent(new CustomEvent('admin-inbox-focus-reply')); return }
      if (e.key === 'c' && selectedId && detail?.type === 'direct') {
        e.preventDefault()
        void (async () => { await closeThread(selectedId, !detail.closedAt); setDetail(await fetchAdminThread(selectedId)); void refresh() })()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, selectedId, detail, openThread, refresh])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Compose dialog */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-start justify-center p-4 pt-[8vh]" onClick={() => setComposeOpen(false)}>
          <div className="w-full max-w-lg relative rounded-xl bg-card shadow-2xl shadow-black/40" onClick={e => e.stopPropagation()}>
            <Composer recipients={recipients} onSent={afterCompose} />
            <button
              type="button"
              onClick={() => setComposeOpen(false)}
              aria-label="Close composer"
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/40 transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row border-t border-border">
        {/* ── Folders rail ── */}
        <aside className="shrink-0 lg:w-[212px] border-b lg:border-b-0 lg:border-r border-border bg-muted/15 flex flex-col">
          <div className="p-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 text-white text-[12.5px] font-semibold hover:bg-blue-600 transition-colors shadow-sm shadow-blue-500/25"
            >
              <PenSquare className="w-3.5 h-3.5" /> New message
            </button>
          </div>
          <nav className="px-2 pb-2 lg:flex-1 lg:overflow-y-auto flex lg:flex-col gap-1 overflow-x-auto">
            {SEGMENTS.map(s => {
              const active = segment === s.key
              const n = counts[s.key]
              const urgent = s.key === 'needs_reply' && n > 0
              const Icon = s.icon
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSegment(s.key)}
                  className={[
                    'shrink-0 lg:w-full inline-flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors',
                    active
                      ? (urgent ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-blue-500/15 text-blue-700 dark:text-blue-300')
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  ].join(' ')}
                >
                  <Icon className={['w-4 h-4 shrink-0', urgent && !active ? 'text-amber-500' : ''].join(' ')} aria-hidden />
                  <span className="truncate">{s.label}</span>
                  {n > 0 && (
                    <span className={[
                      'ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                      urgent ? 'bg-amber-500 text-white' : active ? 'bg-blue-500/80 text-white' : 'bg-muted text-muted-foreground/80',
                    ].join(' ')}>{n}</span>
                  )}
                </button>
              )
            })}
          </nav>
          <div className="hidden lg:flex items-center justify-between gap-2 px-3 py-2 border-t border-border text-[10px] text-muted-foreground/60">
            <span className={oldestWaiting ? 'text-amber-600/80 dark:text-amber-400/80 font-medium truncate' : 'truncate'}>
              {oldestWaiting ? `Oldest: ${relativeTime(oldestWaiting).replace(' ago', '')} waiting` : 'All caught up'}
            </span>
            <button type="button" onClick={() => { void refresh() }} aria-label="Refresh" title="Refresh" className="shrink-0 text-muted-foreground/70 hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>

        {/* ── Thread list ── */}
        <div className={[
          'flex-col border-b lg:border-b-0 lg:border-r border-border min-w-0 bg-card/20',
          'lg:w-[340px] lg:shrink-0',
          selectedId ? 'hidden lg:flex' : 'flex flex-1 lg:flex-none',
        ].join(' ')}>
          <div className="p-2.5 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" aria-hidden />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search…  ( / )"
                className="w-full rounded-lg border border-border bg-background pl-8 pr-8 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-blue-500/50"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 lg:min-h-0 overflow-y-auto max-h-[60vh] lg:max-h-none">
            {loading ? (
              <div className="p-4 space-y-2">
                <div className="h-3 bg-muted/60 rounded animate-pulse w-10/12" />
                <div className="h-3 bg-muted/60 rounded animate-pulse w-7/12" />
              </div>
            ) : visible.length === 0 ? (
              <div className="px-4 py-14 text-center text-sm text-muted-foreground">
                {threads.length === 0
                  ? 'No threads yet. Start one with “New message”.'
                  : query
                    ? 'No threads match your search.'
                    : segment === 'needs_reply'
                      ? 'Inbox zero — nothing awaiting a reply. 🎉'
                      : 'Nothing here.'}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {visible.map(t => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openThread(t.id)}
                      className={[
                        'w-full text-left px-3 py-3 flex items-start gap-2.5 transition-colors border-l-2',
                        selectedId === t.id ? 'bg-blue-500/10 border-blue-500' : t.needsReply ? 'border-amber-400/70 hover:bg-muted/40' : 'border-transparent hover:bg-muted/40',
                      ].join(' ')}
                    >
                      <span className="shrink-0 mt-0.5">
                        {t.type === 'broadcast' ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-500">
                            <Megaphone className="w-3.5 h-3.5" aria-hidden />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-300 text-[12px] font-semibold uppercase">
                            {(t.withEmail ?? '?').charAt(0)}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={['truncate text-[12.5px] flex-1', t.needsReply ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'].join(' ')}>
                            {t.type === 'broadcast' ? (t.subject || 'Announcement') : (t.withEmail || 'Direct message')}
                          </span>
                          {t.needsReply && <span className="shrink-0 w-2 h-2 rounded-full bg-amber-500" aria-hidden />}
                        </span>
                        <span className="flex items-center gap-1.5 mt-0.5">
                          {t.fromInquiry && (
                            <span className="shrink-0 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 font-semibold">inquiry</span>
                          )}
                          {t.closedAt && (
                            <span className="shrink-0 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">closed</span>
                          )}
                          {t.type === 'direct' && t.subject && (
                            <span className="truncate text-[11px] text-foreground/70">{t.subject}</span>
                          )}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground mt-0.5">
                          {t.lastMessage ? `${t.lastMessage.fromAdmin ? 'You: ' : ''}${t.lastMessage.body}` : 'No messages'}
                        </span>
                        <span className={['block text-[10px] mt-0.5', t.needsReply ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground/60'].join(' ')}>
                          {t.needsReply ? `waiting ${relativeTime(t.lastMessage?.createdAt ?? t.updatedAt).replace(' ago', '')}` : relativeTime(t.updatedAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Conversation ── */}
        <div className={['flex-col flex-1 min-w-0 min-h-0 bg-background', selectedId ? 'flex' : 'hidden lg:flex'].join(' ')}>
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-muted-foreground/40" aria-hidden />
              </div>
              <p className="text-sm font-medium text-foreground/80">Select a conversation</p>
              <p className="text-[12px] text-muted-foreground mt-1">Pick a thread on the left, or start one with New message.</p>
            </div>
          ) : (
            <AdminThreadView
              detail={detail}
              loading={loadingDetail}
              onReplied={afterReply}
              onBack={() => { setSelectedId(null); setDetail(null) }}
            />
          )}
        </div>
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
  const [emailEveryone, setEmailEveryone] = useState(true)
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
      allowReplies, // honoured for both kinds now
      targetUserId: kind === 'direct' ? targetUserId : undefined,
      emailEveryone: kind === 'broadcast' ? emailEveryone : undefined,
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

      {/* Allow replies — honoured for both kinds. */}
      <label className="flex items-center gap-2 mt-2.5 text-[12px] text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={allowReplies}
          onChange={e => setAllowReplies(e.target.checked)}
          className="rounded border-border"
        />
        Allow replies
        <span className="text-[10.5px] text-muted-foreground/60">
          ({allowReplies
            ? (kind === 'broadcast' ? 'a reply opens a private thread' : 'the member can reply')
            : (kind === 'broadcast' ? 'announcement only' : 'one-way, no replies')})
        </span>
      </label>

      {/* Email everyone — broadcast only. */}
      {kind === 'broadcast' && (
        <label className="flex items-center gap-2 mt-2 text-[12px] text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={emailEveryone}
            onChange={e => setEmailEveryone(e.target.checked)}
            className="rounded border-border"
          />
          Email everyone
          <span className="text-[10.5px] text-muted-foreground/60">
            (also email all users a nudge)
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
  detail, loading, onReplied, onBack,
}: {
  detail: AdminThreadDetail | null
  loading: boolean
  onReplied: () => void
  onBack: () => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [detail?.messages.length])

  // 'r' keyboard shortcut focuses the reply box.
  useEffect(() => {
    function onFocus() { replyRef.current?.focus() }
    window.addEventListener('admin-inbox-focus-reply', onFocus)
    return () => window.removeEventListener('admin-inbox-focus-reply', onFocus)
  }, [])

  const [closing, setClosing] = useState(false)
  const replyRef = useRef<HTMLTextAreaElement>(null)

  async function send() {
    if (!detail || !text.trim() || sending) return
    setSending(true); setError(null)
    const res = await adminReply(detail.id, text.trim())
    setSending(false)
    if (!res.ok) { setError(res.error || 'Failed to send.'); return }
    setText('')
    onReplied()
  }

  async function toggleClosed(closed: boolean) {
    if (!detail || closing) return
    setClosing(true); setError(null)
    const res = await closeThread(detail.id, closed)
    setClosing(false)
    if (!res.ok) { setError(res.error || 'Failed.'); return }
    onReplied() // refetch → reflects closed state
  }

  if (loading || !detail) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
      </div>
    )
  }

  const isBroadcast = detail.type === 'broadcast'
  const isClosed = !!detail.closedAt

  return (
    <>
      <div className="px-3 sm:px-4 py-3 border-b border-border flex items-center gap-2.5 shrink-0 bg-card/30">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="lg:hidden shrink-0 text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {isBroadcast ? (
          <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-500">
            <Megaphone className="w-4 h-4" aria-hidden />
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-300 text-[14px] font-semibold uppercase">
            {(detail.withEmail ?? '?').charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-foreground truncate">
              {isBroadcast ? (detail.subject || 'Announcement') : (detail.withEmail || 'Direct message')}
            </span>
            {isClosed && (
              <span className="shrink-0 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                closed
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground/75 mt-0.5 truncate">
            {isBroadcast
              ? `Broadcast · ${detail.allowReplies ? 'replies on' : 'announcement only'}`
              : `${detail.subject ? detail.subject + ' · ' : ''}${detail.allowReplies ? 'replies on' : 'one-way (no replies)'}`}
          </div>
        </div>
        {/* Close / reopen — direct tickets only. */}
        {!isBroadcast && (
          <button
            type="button"
            onClick={() => toggleClosed(!isClosed)}
            disabled={closing}
            className={[
              'shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50',
              isClosed
                ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/40',
            ].join(' ')}
            title={isClosed ? 'Reopen ticket' : 'Close ticket'}
          >
            {closing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : isClosed ? <RotateCcw className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isClosed ? 'Reopen' : 'Close'}</span>
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 space-y-2.5">
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
      ) : isClosed ? (
        <div className="border-t border-border px-4 py-3 text-center">
          <p className="text-[11px] text-muted-foreground/70 mb-2">
            Ticket closed. The member can't reply — they'll need to start a new message.
          </p>
          <button
            type="button"
            onClick={() => toggleClosed(false)}
            disabled={closing}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Reopen to reply
          </button>
        </div>
      ) : (
        <div className="border-t border-border p-3">
          {error && <p className="text-[11px] text-red-600 dark:text-red-400 mb-1.5">{error}</p>}
          <div className="flex items-end gap-1.5">
            <textarea
              ref={replyRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() } }}
              rows={1}
              placeholder="Write a reply… (⌘↵ to send)"
              className="flex-1 resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-blue-500/50 max-h-28"
            />
            <SavedRepliesMenu text={text} onInsert={b => setText(prev => (prev.trim() ? `${prev}\n\n${b}` : b))} />
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

// ── Saved replies (canned responses) ────────────────────────────────

function SavedRepliesMenu({ text, onInsert }: { text: string; onInsert: (body: string) => void }) {
  const [open, setOpen] = useState(false)
  const [replies, setReplies] = useState<SavedReply[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setReplies(await fetchSavedReplies())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!open) return
    void load()
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open, load])

  async function saveCurrent() {
    const body = text.trim()
    if (!body) return
    const r = await createSavedReply('', body)
    if (r) setReplies(prev => [...prev, r])
  }
  async function remove(id: string) {
    setReplies(prev => prev.filter(r => r.id !== id))
    await deleteSavedReply(id)
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Saved replies"
        aria-label="Saved replies"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
      >
        <BookText className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-72 max-h-72 overflow-y-auto bg-card border border-border rounded-lg shadow-xl shadow-black/30 z-20 p-1">
          <div className="px-2 py-1.5 text-[10.5px] uppercase tracking-wide text-muted-foreground/70 font-semibold">Saved replies</div>
          {loading ? (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">Loading…</div>
          ) : replies.length === 0 ? (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">No saved replies yet. Type a reply, then “Save current draft”.</div>
          ) : replies.map(r => (
            <div key={r.id} className="group flex items-start gap-1">
              <button
                type="button"
                onClick={() => { onInsert(r.body); setOpen(false) }}
                className="flex-1 text-left px-2 py-1.5 rounded hover:bg-muted/50 min-w-0"
              >
                <div className="text-[12px] font-medium text-foreground truncate">{r.title || r.body.slice(0, 40)}</div>
                <div className="text-[10.5px] text-muted-foreground truncate">{r.body}</div>
              </button>
              <button
                type="button"
                onClick={() => remove(r.id)}
                aria-label="Delete saved reply"
                className="opacity-0 group-hover:opacity-100 p-1 mt-1 text-muted-foreground/60 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {text.trim() && (
            <button
              type="button"
              onClick={saveCurrent}
              className="w-full text-left px-2 py-1.5 mt-1 border-t border-border text-[11.5px] text-blue-600 dark:text-blue-300 hover:bg-blue-500/10 rounded-b flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" /> Save current draft as a reply
            </button>
          )}
        </div>
      )}
    </div>
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
