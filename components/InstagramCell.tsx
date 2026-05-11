'use client'

import { useState } from 'react'

/**
 * Drop-in replacement for the existing inline Instagram cell in
 * the Results table. Two states:
 *
 *   1. Have IG URL → render "DM" link that opens the profile in a new
 *      tab. (Previously also rendered an inline follower-count badge
 *      next to "DM" via Meta Graph API polling — removed 2026-05-11
 *      per Dylan: the badge was visually noisy and the dedicated
 *      IG Followers column carries the same data when needed.)
 *
 *   2. No IG URL → render a small "Find IG" button. Clicking opens
 *      a tiny inline input where the user can paste a handle. After
 *      submit, the cell saves the URL via the onUpdate callback.
 */

export interface InstagramCellProps {
  channelName: string
  instagramUrl: string
  onCopyDm?: () => void
  onUpdateInstagram?: (url: string) => void
  /** When true, suppresses the manual-find UI (e.g. read-only views). */
  readOnly?: boolean
  className?: string
}

export function InstagramCell({
  channelName,
  instagramUrl,
  onCopyDm,
  onUpdateInstagram,
  readOnly = false,
  className = '',
}: InstagramCellProps) {
  if (instagramUrl) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onCopyDm}
          title={`Open IG${onCopyDm ? ' + copy DM template' : ''}`}
          className="text-pink-700 dark:text-pink-400 hover:underline"
        >
          DM
        </a>
      </span>
    )
  }

  if (readOnly || !onUpdateInstagram) {
    return <span className={className}>—</span>
  }

  return (
    <FindInstagramButton
      channelName={channelName}
      onSubmit={onUpdateInstagram}
      className={className}
    />
  )
}

/**
 * Manual-find UI for rows where the IG handle wasn't auto-resolved.
 * Click → input appears → user pastes handle/URL → onSubmit fires
 * with the normalized URL. Parent saves it and the row's
 * useInstagramMetrics hook will start polling on next render.
 */
function FindInstagramButton({
  channelName,
  onSubmit,
  className = '',
}: {
  channelName: string
  onSubmit: (url: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  function commit() {
    const cleaned = normalizeIgInput(value)
    if (!cleaned) {
      setOpen(false)
      setValue('')
      return
    }
    onSubmit(cleaned)
    setOpen(false)
    setValue('')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Manually add Instagram handle for ${channelName}`}
        className={`text-[11px] text-muted-foreground/70 hover:text-pink-700 dark:hover:text-pink-400 hover:underline transition-colors ${className}`}
      >
        + Find IG
      </button>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setOpen(false)
            setValue('')
          }
        }}
        onBlur={commit}
        placeholder="@handle or URL"
        className="text-[11px] w-[110px] px-1.5 py-0.5 bg-card border border-border rounded text-foreground focus:outline-none focus:border-pink-700"
      />
    </span>
  )
}

/**
 * Normalize free-form user input into a canonical instagram.com URL.
 * Accepts: "@handle", "handle", "instagram.com/handle",
 * "https://www.instagram.com/handle/?utm=foo", etc.
 * Returns "" when input is unusable.
 */
function normalizeIgInput(input: string): string {
  if (!input) return ''
  const trimmed = input.trim().replace(/^@/, '')

  // If it parses as a URL containing instagram.com, strip query/path
  // back to just /{handle}/.
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed)
    if (url.hostname.includes('instagram.com')) {
      const segments = url.pathname.split('/').filter(Boolean)
      if (segments.length === 0) return ''
      const first = segments[0]
      if (['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts'].includes(first.toLowerCase())) {
        return ''
      }
      if (!/^[a-zA-Z0-9._]{1,30}$/.test(first)) return ''
      return `https://instagram.com/${first}`
    }
  } catch {
    // Not a URL — fall through to bare-handle handling.
  }

  // Bare handle case.
  if (/^[a-zA-Z0-9._]{1,30}$/.test(trimmed)) {
    return `https://instagram.com/${trimmed}`
  }
  return ''
}
