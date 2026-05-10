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
  const [subjectTemplate, setSubjectTemplate] = useState(initial.subjectTemplate ?? '')
  const [mailClient, setMailClient] = useState<UserProfile['mailClient']>(initial.mailClient ?? 'default')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Reset form if the initial prop changes (e.g. user re-opens after editing)
  useEffect(() => {
    setFullName(initial.fullName)
    setLinkedinUrl(initial.linkedinUrl)
    setPitchLine(initial.pitchLine)
    setSubjectTemplate(initial.subjectTemplate ?? '')
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
      subjectTemplate: subjectTemplate.trim() || undefined,
      mailClient,
    }
    const { error: err } = await supabase
      .from('user_profile')
      .update({
        full_name: next.fullName,
        linkedin_url: next.linkedinUrl,
        pitch_line: next.pitchLine,
        subject_template: next.subjectTemplate ?? null,
        mail_client: next.mailClient,
      })
      .eq('user_id', userId)

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
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md p-7 focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 id={titleId} className="text-xl font-bold text-foreground">Profile</h2>
          <button
            onClick={onClose}
            aria-label="Close profile dialog"
            className="text-muted-foreground hover:text-foreground text-lg leading-none w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
          >✕</button>
        </div>
        <p className="text-muted-foreground text-sm mb-6">Used in your outreach emails. Edits apply to every future email you send.</p>

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
              Pitch line <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <textarea
              value={pitchLine}
              onChange={e => setPitchLine(e.target.value)}
              placeholder="e.g. I work with YouTube creators on growth — editing, content strategy, the full picture."
              rows={3}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1">One line about what you do. Goes after &quot;I&apos;m [your name]&quot; in outreach emails.</p>
          </div>

          {/* Subject-line template — used as the actual email subject when
              the user clicks an outreach link. Supports placeholders that
              lib/format.ts substitutes per recipient at compose time. */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Subject line template <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <input
              type="text"
              value={subjectTemplate}
              onChange={e => setSubjectTemplate(e.target.value)}
              placeholder="e.g. quick question about {channel}"
              maxLength={140}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1 leading-relaxed">
              Used as the subject when you click an outreach email link. Placeholders:{' '}
              <code className="px-1 py-0.5 rounded bg-muted-foreground/10 text-foreground/80">{'{name}'}</code>{' '}
              recipient first name,{' '}
              <code className="px-1 py-0.5 rounded bg-muted-foreground/10 text-foreground/80">{'{channel}'}</code>{' '}
              channel name,{' '}
              <code className="px-1 py-0.5 rounded bg-muted-foreground/10 text-foreground/80">{'{content}'}</code>{' '}
              top video title. Leave blank to use the default subject.
            </p>
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
        </div>

        {error && <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2 mt-4">{error}</div>}

        <div className="flex items-center justify-end gap-3 mt-6">
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
