'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/types'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

export function ProfileModal({
  userId,
  initial,
  onSave,
  onClose,
}: {
  userId: string
  initial: UserProfile
  onSave: (next: UserProfile) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(dialogRef, true)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const [fullName, setFullName] = useState(initial.fullName)
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedinUrl)
  const [pitchLine, setPitchLine] = useState(initial.pitchLine)
  const [targetAudience, setTargetAudience] = useState(initial.targetAudience ?? '')
  const [mailClient, setMailClient] = useState<UserProfile['mailClient']>(initial.mailClient ?? 'default')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 2026-06-08: Unipile "Connect Gmail" + "Connect LinkedIn" cards
  // removed. Both were rendering 404s on production (Unipile's
  // /api/v1/hosted/accounts/link is returning Route Not Found) and
  // crowding the Profile modal with template-adjacent integration UI.
  // The send flow falls back to the existing mailto:/Gmail-compose
  // path via the "Email link opens in" picker below. Backend routes
  // (/api/unipile/*) are kept for now but unused; rip if they stay
  // dead for another pass.

  // Reset form if the initial prop changes (e.g. user re-opens after editing)
  useEffect(() => {
    setFullName(initial.fullName)
    setLinkedinUrl(initial.linkedinUrl)
    setPitchLine(initial.pitchLine)
    setTargetAudience(initial.targetAudience ?? '')
    setMailClient(initial.mailClient ?? 'default')
  }, [initial])

  async function save() {
    setError('')
    if (!fullName.trim()) {
      setError('Full name is required')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const next: UserProfile = {
      fullName: fullName.trim(),
      linkedinUrl: linkedinUrl.trim(),
      pitchLine: pitchLine.trim(),
      targetAudience: targetAudience.trim() || null,
      mailClient,
    }
    // Migration-tolerant write: try with target_audience first
    // (migration 0039). If the column is missing, retry without it
    // so the rest of the save still lands. Same fallback pattern as
    // the home-page profile load.
    let { error: err } = await supabase
      .from('user_profile')
      .update({
        full_name: next.fullName,
        linkedin_url: next.linkedinUrl,
        pitch_line: next.pitchLine,
        target_audience: next.targetAudience ?? null,
        mail_client: next.mailClient,
      })
      .eq('user_id', userId)
    if (err && /target_audience|schema cache|PGRST204|column .* does not exist/i.test(err.message)) {
      console.warn('[ProfileModal] target_audience write failed (migration 0039 not applied?), retrying without it:', err.message)
      const retry = await supabase
        .from('user_profile')
        .update({
          full_name: next.fullName,
          linkedin_url: next.linkedinUrl,
          pitch_line: next.pitchLine,
          mail_client: next.mailClient,
        })
        .eq('user_id', userId)
      err = retry.error
    }

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    onSave(next)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      {/* Modal layout: flex-col with max-h-[90vh] so on small screens
          the dialog never exceeds the viewport. Header (title + close)
          and footer (Cancel + Save) are sticky via flex-shrink-0 so
          they stay visible while the middle scrolls. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md max-h-[90vh] flex flex-col focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex-shrink-0 px-7 pt-7 pb-4 border-b border-border/60">
          <div className="flex items-start justify-between mb-1">
            <h2 id={titleId} className="text-xl font-bold text-foreground">Profile</h2>
            <button
              onClick={onClose}
              aria-label="Close profile dialog"
              className="text-muted-foreground hover:text-foreground text-lg leading-none w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
            >✕</button>
          </div>
          <p className="text-muted-foreground text-sm">Who you are and who you target. Outreach templates pull from this — message content lives in the Templates panel.</p>
        </div>

        {/* Scrollable middle */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Full name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              LinkedIn URL <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/your-handle"
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              What do you do? <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <textarea
              value={pitchLine}
              onChange={e => setPitchLine(e.target.value)}
              placeholder="e.g. I work with YouTube creators on growth — editing, content strategy, the full picture."
              rows={3}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1">One line about your work. Your outreach templates pull this in automatically (via the <code className="text-foreground/80">{'{pitch}'}</code> variable).</p>
          </div>

          {/* Target audience — Dylan 2026-06-08. Free-text description
              of who the user is reaching out to. Stored as
              user_profile.target_audience (migration 0039). Used today
              for AI fit scoring context + visible on the dashboard;
              future work: auto-suggest niche buckets + tailor template
              tone based on this. */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Who do you target? <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <textarea
              value={targetAudience}
              onChange={e => setTargetAudience(e.target.value)}
              placeholder="e.g. fitness creators 100K-1M subs, mostly YouTube. Sometimes Instagram if they post Reels."
              rows={3}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1">Helps the AI score better and (soon) tailor templates to the creator type you actually reach.</p>
          </div>

          {/* Mail client preference — controls where outreach email
              links open. Default = OS handler via mailto:. The web
              providers open compose with to/subject/body pre-filled. */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Email link opens in
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'default', label: 'Default (mailto:)', hint: 'Apple Mail / OS default' },
                { id: 'gmail',   label: 'Gmail',             hint: 'mail.google.com' },
                { id: 'outlook', label: 'Outlook',           hint: 'outlook.office.com' },
                { id: 'yahoo',   label: 'Yahoo',             hint: 'compose.mail.yahoo.com' },
              ] as { id: UserProfile['mailClient']; label: string; hint: string }[]).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMailClient(opt.id)}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                    mailClient === opt.id
                      ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/40 text-purple-700 dark:text-purple-200'
                      : 'bg-muted border-border text-foreground/80 hover:border-border/80'
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.hint}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1.5">
              Web providers open in a new tab with the recipient + subject + body pre-filled.
            </p>
          </div>

          {/* Backdrop theme picker moved to the hamburger menu next to
              the dark/light toggle (Dylan 2026-05-10): both are visual
              settings, they belong together. */}
          {/* 2026-06-08: Removed "Connect Gmail" + "Connect LinkedIn"
              Unipile cards — both were rendering 404s on production
              and crowding the profile with template-adjacent
              integration UI. The /api/unipile/* routes remain (for
              now) but aren't surfaced from anywhere. */}
        </div>

          {error && <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2 mt-4">{error}</div>}
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 px-7 py-4 border-t border-border/60 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

