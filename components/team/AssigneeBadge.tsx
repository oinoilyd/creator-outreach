'use client'

/**
 * AssigneeBadge — small chip on each outreach row showing who it's
 * assigned to. Clickable for Owner/Admin → opens a popover to
 * reassign to another member.
 *
 * For Members (canAssign=false) it's just a static badge.
 *
 * When the row has no assignee yet (NULL), shows a "—" with the
 * reassign popover available so an admin can claim it.
 */

import { useEffect, useRef, useState } from 'react'
import type { TeamMember } from '@/lib/team-client'

interface Props {
  /** Current assignee user id; null when unassigned. */
  assignedToUserId: string | null
  /** All team members (used to look up the assignee's name + render
   *  the reassign list). */
  members: TeamMember[]
  /** True when the viewing user can reassign rows (Owner/Admin). */
  canAssign: boolean
  /** Called when the user picks a new assignee. Returns a promise so
   *  the badge can show a busy state during the network call. */
  onReassign: (newAssigneeUserId: string) => Promise<void>
  /** Optional — the viewing user's id, used to highlight "you" in the
   *  popover so it's easy to self-assign. */
  currentUserId: string | null
}

function rolePillClass(role: 'owner' | 'admin' | 'member'): string {
  if (role === 'owner') return 'bg-purple-500/15 text-purple-700 dark:text-purple-400'
  if (role === 'admin') return 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
  return 'bg-muted text-muted-foreground/70'
}

export function AssigneeBadge({
  assignedToUserId,
  members,
  canAssign,
  onReassign,
  currentUserId,
}: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const assignee = assignedToUserId
    ? members.find(m => m.userId === assignedToUserId) ?? null
    : null

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handlePick(userId: string) {
    if (userId === assignedToUserId) {
      setOpen(false)
      return
    }
    setBusy(true)
    try {
      await onReassign(userId)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  // Static-only render for Members (can't reassign).
  if (!canAssign) {
    if (!assignee) {
      return <span className="text-[10px] text-muted-foreground/60">unassigned</span>
    }
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/80"
        title={`Assigned to ${assignee.fullName || assignee.email}`}
      >
        <span>{assignee.fullName || assignee.email}</span>
        <span className={`px-1 py-0.5 rounded-full text-[9px] font-mono uppercase ${rolePillClass(assignee.role)}`}>
          {assignee.role.charAt(0)}
        </span>
      </span>
    )
  }

  // Owner/Admin: clickable badge with popover.
  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        disabled={busy}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] transition-colors ${
          busy
            ? 'opacity-50 cursor-wait'
            : 'border-border hover:border-foreground/30 hover:bg-card'
        }`}
        title="Click to reassign"
      >
        {busy ? (
          <span className="text-muted-foreground">…</span>
        ) : assignee ? (
          <>
            <span className="text-foreground/90">{assignee.fullName || assignee.email}</span>
            <span className={`px-1 py-0.5 rounded-full text-[9px] font-mono uppercase ${rolePillClass(assignee.role)}`}>
              {assignee.role.charAt(0)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground italic">unassigned</span>
        )}
        <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 z-50 w-56 bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">
            Reassign to
          </div>
          {members.map(m => {
            const isCurrent = m.userId === assignedToUserId
            const isMe = m.userId === currentUserId
            return (
              <button
                key={m.userId}
                type="button"
                onClick={() => handlePick(m.userId)}
                disabled={busy}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-muted transition-colors ${
                  isCurrent ? 'bg-card/60' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono uppercase shrink-0 ${rolePillClass(m.role)}`}>
                    {m.role.charAt(0)}
                  </span>
                  <span className="truncate">
                    {m.fullName || m.email}
                    {isMe && <span className="text-muted-foreground/60 ml-1">(you)</span>}
                  </span>
                </div>
                {isCurrent && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs shrink-0">✓</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
