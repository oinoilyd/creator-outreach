'use client'

import React, { useEffect, useState } from 'react'

/**
 * Inline email editor that appears as a small "Edit" link by default,
 * then swaps in a textarea on click. Hides itself again on blur or
 * when the user hits Enter / Escape. Keeps the row compact in its
 * default state — the green clickable email link above is the
 * primary read affordance, this is just the rare "edit" path.
 */
export function EmailEditToggle({
  email,
  onChange,
}: {
  email: string
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(email)

  // Keep the draft in sync if the parent value changes while we're
  // not actively editing (e.g. a deep-search result lands).
  useEffect(() => {
    if (!editing) setDraft(email)
  }, [email, editing])

  function commit() {
    const next = draft.trim()
    if (next !== email) onChange(next)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(email)
          setEditing(true)
        }}
        title="Edit email — replace, fix a typo, or paste a different address"
        className="self-start text-[10px] text-muted-foreground hover:text-foreground border border-border hover:border-purple-500/40 rounded px-1.5 py-0.5 transition-colors inline-flex items-center gap-1"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Edit email
      </button>
    )
  }

  return (
    <input
      type="email"
      autoFocus
      value={draft}
      onChange={ev => setDraft(ev.target.value)}
      onBlur={commit}
      onKeyDown={ev => {
        if (ev.key === 'Enter') {
          ev.preventDefault()
          commit()
        } else if (ev.key === 'Escape') {
          setDraft(email)
          setEditing(false)
        }
      }}
      placeholder="email@domain.com"
      className="bg-muted border border-purple-500/40 rounded px-2 py-0.5 text-xs text-foreground focus:outline-none focus:border-purple-500 w-full"
    />
  )
}
