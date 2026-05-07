'use client'

import { useState } from 'react'

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    setErrorMsg(null)
    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setStatus('error')
        setErrorMsg(data.error || 'Something went wrong. Please try again.')
        return
      }
      setStatus('sent')
      setName(''); setEmail(''); setMessage('')
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please try again.')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <div className="text-emerald-300 font-medium mb-1">Got it — message received.</div>
        <div className="text-sm text-emerald-300/80">I&apos;ll get back to you within a day or two.</div>
        <button
          onClick={() => setStatus('idle')}
          className="mt-4 text-xs text-emerald-300 hover:underline"
        >
          Send another
        </button>
      </div>
    )
  }

  const inputCls =
    'w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors'

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          className={inputCls}
        />
        <input
          type="email"
          required
          maxLength={200}
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputCls}
        />
      </div>
      <textarea
        required
        maxLength={5000}
        rows={5}
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="What's on your mind?"
        className={`${inputCls} resize-none`}
      />
      {errorMsg && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {errorMsg}
        </div>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full sm:w-auto bg-primary text-primary-foreground hover:opacity-90 px-5 py-2.5 rounded-lg font-medium transition-opacity disabled:opacity-60 disabled:cursor-wait"
      >
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
