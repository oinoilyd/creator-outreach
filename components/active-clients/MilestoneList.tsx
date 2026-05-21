'use client'

/**
 * MilestoneList — editable checklist of milestones on an active-client
 * engagement. Lives inside the detail modal.
 *
 * Each milestone: { id, label, dueDate, completedAt }. Toggling a
 * checkbox sets/clears completedAt. Editing the label commits on
 * blur (not per keystroke — see perf note below).
 *
 * Perf note (matches CollaboratorsList v2):
 *   v1 fired onChange on every label keystroke, which round-tripped to
 *   Supabase and re-rendered the whole 4000-line page tree each
 *   character. v2 lifts each row into MilestoneRow with LOCAL label
 *   state — only commits on blur, Enter, or unmount. Date + toggle
 *   stay direct (they don't fire per character).
 *
 * Bulk action: ActiveClientDetailModal auto-seeds the default list on
 * first open for a brand-new engagement (no milestone history). The
 * "Use default checklist" button stays as a fallback for older entries
 * that pre-date the auto-seed behaviour.
 */

import { useEffect, useRef, useState } from 'react'
import type { ClientMilestone } from '@/lib/types'
import { Plus, Check, Trash2, ListChecks } from 'lucide-react'

interface MilestoneListProps {
  milestones: ClientMilestone[]
  onChange: (next: ClientMilestone[]) => void
}

export const DEFAULT_MILESTONES: Omit<ClientMilestone, 'id'>[] = [
  { label: 'Kickoff call',        dueDate: '' },
  { label: 'Brief signed',        dueDate: '' },
  { label: 'Deliverable shipped', dueDate: '' },
  { label: 'Invoice paid',        dueDate: '' },
]

export function newMilestoneId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try { return (crypto as Crypto).randomUUID() } catch { /* fall through */ }
  }
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function MilestoneList({ milestones, onChange }: MilestoneListProps) {
  const [draft, setDraft] = useState('')

  function addMilestone(label: string) {
    const trimmed = label.trim()
    if (!trimmed) return
    onChange([...milestones, { id: newMilestoneId(), label: trimmed, dueDate: '' }])
    setDraft('')
  }

  function toggleMilestone(id: string) {
    onChange(
      milestones.map(m => {
        if (m.id !== id) return m
        return m.completedAt
          ? { ...m, completedAt: '' }
          : { ...m, completedAt: new Date().toISOString() }
      }),
    )
  }

  function removeMilestone(id: string) {
    onChange(milestones.filter(m => m.id !== id))
  }

  function commitLabel(id: string, label: string) {
    onChange(milestones.map(m => (m.id === id ? { ...m, label } : m)))
  }

  function updateDueDate(id: string, dueDate: string) {
    onChange(milestones.map(m => (m.id === id ? { ...m, dueDate } : m)))
  }

  function seedDefaults() {
    if (milestones.length > 0) return
    onChange(DEFAULT_MILESTONES.map(m => ({ ...m, id: newMilestoneId() })))
  }

  const completedCount = milestones.filter(m => !!m.completedAt).length
  const total = milestones.length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
          <h4 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Milestones
          </h4>
          {total > 0 && (
            <span className="text-[11px] text-muted-foreground/75 tabular-nums">
              {completedCount}/{total}
            </span>
          )}
        </div>
        {milestones.length === 0 && (
          <button
            type="button"
            onClick={seedDefaults}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Use default checklist
          </button>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1 bg-muted rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-green-500/70 transition-[width]"
            style={{ width: `${(completedCount / total) * 100}%` }}
            aria-hidden
          />
        </div>
      )}

      {/* Milestone rows */}
      {milestones.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {milestones.map(m => (
            <MilestoneRow
              key={m.id}
              row={m}
              onToggle={() => toggleMilestone(m.id)}
              onCommitLabel={label => commitLabel(m.id, label)}
              onUpdateDueDate={d => updateDueDate(m.id, d)}
              onRemove={() => removeMilestone(m.id)}
            />
          ))}
        </ul>
      )}

      {/* Add row */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMilestone(draft) } }}
          placeholder="Add a milestone…"
          className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
        />
        <button
          type="button"
          onClick={() => addMilestone(draft)}
          disabled={!draft.trim()}
          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Add milestone"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Per-row component ─────────────────────────────────────────────────
// Local state for the label input so per-character typing doesn't
// re-render the entire modal/page tree. Commits on blur, Enter, or
// unmount. Date + toggle stay direct — they fire once per change, not
// per character, so no perf issue.

interface MilestoneRowProps {
  row: ClientMilestone
  onToggle: () => void
  onCommitLabel: (label: string) => void
  onUpdateDueDate: (date: string) => void
  onRemove: () => void
}

function MilestoneRow({
  row, onToggle, onCommitLabel, onUpdateDueDate, onRemove,
}: MilestoneRowProps) {
  const [label, setLabel] = useState(row.label)

  // Re-sync if the underlying row label changes (e.g. seeded by parent).
  useEffect(() => {
    if (row.label !== label) setLabel(row.label)
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [row.label])

  // Flush in-progress label on unmount (modal close mid-edit).
  const latestLabel = useRef(label)
  latestLabel.current = label
  useEffect(() => {
    return () => {
      if (latestLabel.current !== row.label) onCommitLabel(latestLabel.current)
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  const done = !!row.completedAt

  return (
    <li className="flex items-center gap-2 group">
      <button
        type="button"
        onClick={onToggle}
        className={[
          'shrink-0 inline-flex items-center justify-center w-5 h-5 rounded border transition-colors',
          done
            ? 'bg-green-500/20 border-green-500/60 text-green-700 dark:text-green-300'
            : 'border-border hover:border-foreground/40 text-transparent hover:text-foreground/30',
        ].join(' ')}
        aria-label={done ? `Uncheck ${row.label}` : `Check ${row.label}`}
      >
        <Check className="w-3 h-3" />
      </button>
      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={() => { if (label !== row.label) onCommitLabel(label) }}
        onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
        className={[
          'flex-1 bg-transparent border-0 px-1 py-0.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-purple-500/30 rounded',
          done ? 'line-through text-muted-foreground/70' : 'text-foreground',
        ].join(' ')}
      />
      <input
        type="date"
        value={row.dueDate || ''}
        onChange={e => onUpdateDueDate(e.target.value)}
        className="shrink-0 w-[120px] bg-background border border-border rounded px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/30"
        aria-label={`Due date for ${row.label}`}
      />
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-red-500 transition-opacity"
        aria-label={`Remove ${row.label}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  )
}
