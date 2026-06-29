'use client'

/**
 * HelpChat — the floating AI help/sales chatbox.
 *
 *   mode="help"  → in-app helper for logged-in users. Escalation opens a
 *                  thread in the in-app inbox (/api/inbox/new).
 *   mode="sales" → public marketing-site bot. Requires Cloudflare
 *                  Turnstile (a fresh token per message), and stays
 *                  DORMANT (renders nothing) unless NEXT_PUBLIC_TURNSTILE_
 *                  SITE_KEY is configured. Escalation captures an email
 *                  into the contact pipeline (/api/contact).
 *
 * One component, two surfaces. Backend personas + abuse caps live in
 * /api/help-chat. Non-streaming v1 (typing indicator while awaiting).
 */
import { useEffect, useRef, useState } from 'react'

type Mode = 'help' | 'sales'
interface Msg { role: 'user' | 'assistant'; content: string }

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

const GREETING: Record<Mode, string> = {
  help: "Hi! I'm the Creator Outreach helper. Ask me how to do anything in the app — search, scoring, follow-ups, Active Clients…",
  sales: "Hey! Questions about Creator Outreach before you dive in? Ask me what it does, which platforms, pricing — anything.",
}

declare global {
  interface Window { turnstile?: any }
}

export function HelpChat({ mode }: { mode: Mode }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [escalateState, setEscalateState] = useState<'idle' | 'email' | 'sent'>('idle')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const tokenRef = useRef<string | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const tsHostRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Sales bot is dormant until Turnstile is configured.
  const salesDisabled = mode === 'sales' && !SITE_KEY

  // Load + render Turnstile for the sales bot when the panel opens.
  useEffect(() => {
    if (mode !== 'sales' || !SITE_KEY || !open) return
    let cancelled = false
    const render = () => {
      if (cancelled || !window.turnstile || !tsHostRef.current || widgetIdRef.current) return
      widgetIdRef.current = window.turnstile.render(tsHostRef.current, {
        sitekey: SITE_KEY,
        callback: (t: string) => { tokenRef.current = t },
        'expired-callback': () => { tokenRef.current = null },
        'error-callback': () => { tokenRef.current = null },
        appearance: 'interaction-only',
      })
    }
    if (window.turnstile) { render(); return }
    const existing = document.querySelector('script[data-turnstile]')
    if (existing) { existing.addEventListener('load', render); return () => existing.removeEventListener('load', render) }
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    s.async = true; s.defer = true; s.setAttribute('data-turnstile', '1')
    s.onload = render
    document.head.appendChild(s)
    return () => { cancelled = true }
  }, [mode, open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, loading])

  if (salesDisabled) return null

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    if (mode === 'sales' && SITE_KEY && !tokenRef.current) {
      setNote('Please complete the quick verification check, then send.')
      return
    }
    setNote(null)
    const next = [...msgs, { role: 'user' as const, content: text }]
    setMsgs(next); setInput(''); setLoading(true)
    try {
      const res = await fetch('/api/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, messages: next, turnstileToken: tokenRef.current }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsgs(m => [...m, { role: 'assistant', content: data?.error || 'Something went wrong — try again.' }])
      } else {
        setMsgs(m => [...m, { role: 'assistant', content: data.reply }])
      }
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: 'Network hiccup — try again in a moment.' }])
    } finally {
      setLoading(false)
      // Mint a fresh Turnstile token for the next message.
      if (mode === 'sales' && window.turnstile && widgetIdRef.current) {
        tokenRef.current = null
        try { window.turnstile.reset(widgetIdRef.current) } catch { /* noop */ }
      }
    }
  }

  async function escalate() {
    const transcript = msgs.map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content}`).join('\n\n') || '(no messages yet)'
    if (mode === 'help') {
      try {
        const res = await fetch('/api/inbox/new', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: 'Help chat — needs a human', body: `From the help chatbox:\n\n${transcript}` }),
        })
        setEscalateState('sent')
        setNote(res.ok ? "Sent — we'll reply in your inbox (the bell, top bar)." : "Couldn't send just now — try the inbox bell directly.")
      } catch { setNote('Could not send — try the inbox bell directly.') }
    } else {
      setEscalateState('email')
    }
  }

  async function submitEmail() {
    const e = email.trim()
    if (!/.+@.+\..+/.test(e)) { setNote('Enter a valid email so we can reach you.'); return }
    const transcript = msgs.map(m => `${m.role === 'user' ? 'Visitor' : 'Bot'}: ${m.content}`).join('\n\n') || '(no messages)'
    try {
      await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Chat visitor', email: e, message: `From the website chatbox:\n\n${transcript}` }),
      })
    } catch { /* best-effort */ }
    setEscalateState('sent'); setNote("Thanks — we'll be in touch by email.")
  }

  /** Turn an `action:` link from the bot into the matching in-app event,
   *  then close the panel so the user sees what happened (tour starts /
   *  tab switches). Mirrors the CustomEvents TourContext + app/page.tsx
   *  already listen for. */
  function handleAction(href: string) {
    const [kind, query] = href.slice('action:'.length).split('?')
    const params = new URLSearchParams(query || '')
    if (kind === 'tour') {
      window.dispatchEvent(new CustomEvent('tour-start', { detail: { tier: params.get('tier') || 'short' } }))
      setOpen(false)
    } else if (kind === 'goto') {
      window.dispatchEvent(
        new CustomEvent('tour-navigate', { detail: { tab: params.get('tab'), sub: params.get('sub') || undefined } }),
      )
      setOpen(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end" data-help-chat={mode}>
      {open && (
        <div className="mb-3 w-[min(92vw,380px)] h-[min(70vh,560px)] flex flex-col rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-br from-brand to-brand-2 text-white">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white/20 text-[12px] font-bold">C</span>
              <span className="font-semibold text-[14px]">{mode === 'help' ? 'Help' : 'Ask us anything'}</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-white/80 hover:text-white text-lg leading-none">×</button>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-[13.5px]">
            <Bubble role="assistant" onAction={handleAction}>{GREETING[mode]}</Bubble>
            {msgs.map((m, i) => <Bubble key={i} role={m.role} onAction={handleAction}>{m.content}</Bubble>)}
            {loading && (
              <div className="flex gap-1 px-3 py-2 w-fit rounded-2xl bg-muted">
                <Dot /><Dot d={150} /><Dot d={300} />
              </div>
            )}
          </div>

          {/* escalation / note */}
          {note && <div className="px-4 py-2 text-[12px] text-muted-foreground border-t border-border">{note}</div>}
          {escalateState === 'email' && (
            <div className="px-3 py-2 border-t border-border flex gap-2">
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" type="email"
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-brand" />
              <button onClick={submitEmail} className="px-3 py-1.5 rounded-lg bg-gradient-to-br from-brand to-brand-2 text-white text-[13px] font-semibold">Send</button>
            </div>
          )}

          {/* input */}
          {escalateState !== 'sent' && escalateState !== 'email' && (
            <div className="border-t border-border p-2.5">
              {mode === 'sales' && SITE_KEY && <div ref={tsHostRef} className="mb-2" />}
              <div className="flex items-end gap-2">
                <textarea
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  rows={1} placeholder="Type your question…" maxLength={1200}
                  className="flex-1 resize-none bg-muted border border-border rounded-lg px-3 py-2 text-[13.5px] text-foreground focus:outline-none focus:border-brand max-h-28"
                />
                <button onClick={send} disabled={loading || !input.trim()}
                  className="px-3.5 py-2 rounded-lg bg-gradient-to-br from-brand to-brand-2 text-white text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  Send
                </button>
              </div>
              <button onClick={escalate} className="mt-2 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors">
                Talk to a human →
              </button>
            </div>
          )}
        </div>
      )}

      {/* launcher */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close help chat' : 'Open help chat'}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-brand-2 text-white shadow-xl shadow-brand/30 flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        {open ? (
          <span className="text-2xl leading-none">×</span>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
      </button>
    </div>
  )
}

/** Only allow links the bot is supposed to emit: in-app actions, app-
 *  relative paths, or our own domain. Anything else renders as plain text
 *  — defense-in-depth against the model ever producing a stray URL. */
function isSafeHref(href: string): boolean {
  return (
    href.startsWith('action:') ||
    href.startsWith('/') ||
    /^https:\/\/(www\.)?creatoroutreach\.net/i.test(href)
  )
}

/** Minimal, safe markdown renderer for assistant bubbles: [label](href)
 *  links and **bold**. Newlines are preserved by the bubble's pre-wrap.
 *  action: links become buttons that fire in-app events; everything else
 *  is a normal anchor. */
function parseRich(text: string, onAction: (href: string) => void): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g
  const linkCls = 'text-brand underline underline-offset-2 hover:opacity-80 font-medium'
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1] !== undefined && m[2] !== undefined) {
      const label = m[1]
      const href = m[2]
      if (!isSafeHref(href)) {
        nodes.push(label)
      } else if (href.startsWith('action:')) {
        nodes.push(
          <button key={key++} type="button" onClick={() => onAction(href)} className={linkCls}>{label}</button>,
        )
      } else {
        const external = href.startsWith('http')
        nodes.push(
          <a key={key++} href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={linkCls}>{label}</a>,
        )
      }
    } else if (m[3] !== undefined) {
      nodes.push(<strong key={key++}>{m[3]}</strong>)
    }
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function Bubble({ role, children, onAction }: { role: 'user' | 'assistant'; children: React.ReactNode; onAction?: (href: string) => void }) {
  const mine = role === 'user'
  const content = !mine && onAction && typeof children === 'string' ? parseRich(children, onAction) : children
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] px-3 py-2 rounded-2xl whitespace-pre-wrap leading-relaxed ${
        mine ? 'bg-gradient-to-br from-brand to-brand-2 text-white rounded-br-sm'
             : 'bg-muted text-foreground rounded-bl-sm'}`}>
        {content}
      </div>
    </div>
  )
}

function Dot({ d = 0 }: { d?: number }) {
  return <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
}
