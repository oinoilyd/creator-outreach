'use client'

import React, { memo, useEffect, useState } from 'react'

// memo'd in Phase 3a — value is a primitive string, onChange should
// be useCallback'd by parent so memo stays effective.
export const PipelineChip = memo(function PipelineChip({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const num = parseFloat(String(value || '').replace(/[^0-9.]/g, '')) || 0
  useEffect(() => { setDraft(value) }, [value])
  function commit() {
    const cleaned = draft.replace(/[^0-9.]/g, '')
    const display = cleaned ? `$${parseFloat(cleaned).toLocaleString()}` : ''
    onChange(display)
    setEditing(false)
  }
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { commit() }
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        placeholder="0"
        className="text-[10px] font-mono px-1.5 py-px rounded bg-card border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 w-20 focus:outline-none shrink-0"
      />
    )
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className={`text-[10px] font-mono px-1.5 py-px rounded border shrink-0 transition-colors ${num > 0
        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-300'
        : 'bg-muted/30 text-muted-foreground/60 border-border hover:border-border/80 hover:text-emerald-700 dark:hover:text-emerald-300'}`}
      title={num > 0 ? 'Pipeline value — click to edit' : 'Add pipeline $ — click to enter a value'}
    >
      {num > 0 ? `$${num.toLocaleString()}` : '$0'}
    </button>
  )
})
