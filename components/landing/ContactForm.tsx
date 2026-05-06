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
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-6 text-center">
        <div className="text-emerald-700 dark:text-emerald-300 font-medium mb-1">Got it — message received.</div>
        <div className="text-sm text-emerald-700/80 dark:text-emerald-300/80">I'll get back to you within a day or two.</div>
        <button
          onClick={() => setStatus('idle')}
          className="mt-4 text-xs text-emerald-700 dark:text-emerald-300 hover:underline"
        >
          Send another
        </button>
      </div>
    )
  }

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
          className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-purple-400 dark:focus:border-purple-500 transition-colors"
        />
        <input
          type="email"
          required
          maxLength={200}
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-purple-400 dark:focus:border-purple-500 transition-colors"
        />
      </div>
      <textarea
        required
        maxLength={5000}
        rows={5}
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="What's on your mind?"
        className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-purple-400 dark:focus:border-purple-500 transition-colors resize-none"
      />
      {errorMsg && (
        <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2">
          {errorMsg}
        </div>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full sm:w-auto bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200 px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
