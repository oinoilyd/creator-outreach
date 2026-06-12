/**
 * Shared types + client helpers for the in-app inbox (migration 0042).
 */

export type InboxThreadType = 'broadcast' | 'direct'

export interface InboxThreadSummary {
  id: string
  type: InboxThreadType
  subject: string
  allowReplies: boolean
  updatedAt: string
  lastMessage: { body: string; createdAt: string; fromAdmin: boolean } | null
  unread: boolean
  dismissed: boolean
}

export interface InboxMessage {
  id: string
  body: string
  createdAt: string
  fromAdmin: boolean
  authorUserId: string | null
}

export interface InboxThreadDetail {
  id: string
  type: InboxThreadType
  subject: string
  allowReplies: boolean
  messages: InboxMessage[]
}

export interface InboxListResponse {
  unreadCount: number
  threads: InboxThreadSummary[]
}

// ── Client fetch helpers ────────────────────────────────────────────

export async function fetchInbox(): Promise<InboxListResponse> {
  const res = await fetch('/api/inbox', { cache: 'no-store' })
  if (!res.ok) return { unreadCount: 0, threads: [] }
  return res.json()
}

export async function fetchThread(threadId: string): Promise<InboxThreadDetail | null> {
  const res = await fetch(`/api/inbox/${threadId}`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

export async function replyToThread(
  threadId: string,
  body: string,
): Promise<{ ok: boolean; error?: string; newThreadId?: string }> {
  const res = await fetch(`/api/inbox/${threadId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: data?.error || `HTTP ${res.status}` }
  }
  // Reply to a reply-enabled broadcast spins off a private direct
  // thread — the UI jumps into it so the user sees their sent message.
  return { ok: true, newThreadId: data?.newThreadId }
}

export async function dismissThread(threadId: string): Promise<void> {
  await fetch(`/api/inbox/${threadId}/dismiss`, { method: 'POST' }).catch(() => {})
}
