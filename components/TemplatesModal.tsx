'use client'

/**
 * TemplatesModal — per-platform template editor.
 *
 * Opens from the hamburger menu → "Templates." Lets users:
 *   • Edit the message template for each platform (Email, IG, LinkedIn, X, TikTok)
 *   • See a live preview with their profile data substituted in + the
 *     per-recipient variables underlined so they can tell at a glance
 *     what changes per creator
 *   • Reset any platform back to the bundled default
 *   • Toggle the CAN-SPAM footer on/off (only meaningful for email).
 *     Turning it OFF triggers a low-key in-modal acknowledgment that
 *     records footerDisabledAcknowledgedAt — the platform-liability
 *     shield documented at /admin/legal.
 *
 * Persistence: writes to user_profile via the same supabase client the
 * ProfileModal uses. NULL/empty in a template field = "use the
 * bundled default" (resolveTemplate handles that fallback).
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
  type Platform,
  type TemplateVars,
  type FollowUpConfig,
  TEMPLATE_VARS,
  DEFAULT_TEMPLATES,
  DEFAULT_EMAIL_SUBJECT,
  PLATFORM_LABELS,
  resolveTemplate,
  renderTemplatePreview,
  SAMPLE_RECIPIENT,
  applyTemplate,
  resolveFollowUpConfig,
  followUpConfigIsDefault,
} from '@/lib/templates'
import type { UserProfile } from '@/lib/types'
import { FollowUpTemplatesEditor } from '@/components/FollowUpTemplatesEditor'
import { X, RotateCcw, Info, Check } from 'lucide-react'

const PLATFORMS: Platform[] = ['email', 'ig_dm', 'linkedin_dm', 'x_dm', 'tiktok_dm']

interface TemplatesModalProps {
  profile: UserProfile | null
  onClose: () => void
  /** Called after a successful save so the parent can update its
   *  cached profile state without an extra round-trip. */
  onSaved?: (updated: Partial<UserProfile>) => void
}

export function TemplatesModal({ profile, onClose, onSaved }: TemplatesModalProps) {
  const [activePlatform, setActivePlatform] = useState<Platform>('email')

  // Email subject template — Email tab only. Separate from the body
  // because subject lines need their own short editor + different
  // variable mix.
  const [subjectDraft, setSubjectDraft] = useState<string>(
    (profile?.subjectTemplate ?? '').trim() || DEFAULT_EMAIL_SUBJECT,
  )

  // Ref to the active textarea for cursor-based variable insertion.
  // Variable chips below the editor insert {var} at the current
  // selection / cursor position instead of always appending to the
  // end — feels like a normal rich text editor.
  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const subjectRef = useRef<HTMLInputElement | null>(null)

  // Track which editor (body or subject) was last focused so chip
  // clicks know where to insert.
  const [lastFocused, setLastFocused] = useState<'body' | 'subject'>('body')

  // Working copy of each template. Starts with the user's override
  // (if any) or the bundled default. Saving writes back to
  // user_profile.{platform}_template.
  const [drafts, setDrafts] = useState<Record<Platform, string>>(() => ({
    email: profile?.emailTemplate ?? DEFAULT_TEMPLATES.email,
    ig_dm: profile?.igDmTemplate ?? DEFAULT_TEMPLATES.ig_dm,
    linkedin_dm: profile?.linkedinDmTemplate ?? DEFAULT_TEMPLATES.linkedin_dm,
    x_dm: profile?.xDmTemplate ?? DEFAULT_TEMPLATES.x_dm,
    tiktok_dm: profile?.tiktokDmTemplate ?? DEFAULT_TEMPLATES.tiktok_dm,
  }))

  // Follow-up template library (email-only, staged sets). Shown under
  // the Follow-ups tab; persisted alongside the platform templates via
  // the same Save button. Seeded from the profile → bundled default.
  const [showFollowUps, setShowFollowUps] = useState(false)
  const [followUpConfig, setFollowUpConfig] = useState<FollowUpConfig>(
    () => resolveFollowUpConfig(profile?.followUpConfig),
  )

  // CAN-SPAM footer toggle local state. Defaults true (the migration
  // default) but reflects whatever the user has saved.
  const [includeCanSpamFooter, setIncludeCanSpamFooter] = useState<boolean>(
    profile?.includeCanSpamFooter ?? true,
  )

  // When the user clicks the toggle OFF, we surface a low-key inline
  // acknowledgment row. They have to check "I understand…" before the
  // save will persist. Keeps the bulletproof legal posture without
  // a heavy modal-on-modal interruption.
  const [showAckRow, setShowAckRow] = useState<boolean>(false)
  const [ackChecked, setAckChecked] = useState<boolean>(false)

  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Close on Escape, lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  function setDraft(platform: Platform, value: string) {
    setDrafts(prev => ({ ...prev, [platform]: value }))
  }

  function resetToDefault(platform: Platform) {
    setDraft(platform, DEFAULT_TEMPLATES[platform])
    if (platform === 'email') {
      setSubjectDraft(DEFAULT_EMAIL_SUBJECT)
    }
  }

  /**
   * Insert a {variable} token at the current cursor position in
   * whichever editor was last focused (body textarea or subject input).
   * Falls back to appending if the editor ref isn't available.
   */
  function insertVariable(key: string) {
    const token = `{${key}}`
    if (lastFocused === 'subject' && activePlatform === 'email') {
      const el = subjectRef.current
      if (el) {
        const start = el.selectionStart ?? subjectDraft.length
        const end = el.selectionEnd ?? subjectDraft.length
        const next = subjectDraft.slice(0, start) + token + subjectDraft.slice(end)
        setSubjectDraft(next)
        // Restore focus + cursor right after the inserted token.
        requestAnimationFrame(() => {
          el.focus()
          const pos = start + token.length
          el.setSelectionRange(pos, pos)
        })
        return
      }
    }
    const el = editorRef.current
    const current = drafts[activePlatform]
    if (el) {
      const start = el.selectionStart ?? current.length
      const end = el.selectionEnd ?? current.length
      const next = current.slice(0, start) + token + current.slice(end)
      setDraft(activePlatform, next)
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + token.length
        el.setSelectionRange(pos, pos)
      })
    } else {
      setDraft(activePlatform, current + token)
    }
  }

  function onToggleCanSpam(next: boolean) {
    if (!next) {
      // Disabling — surface acknowledgment row inline. Don't actually
      // flip the state until the user confirms via the checkbox.
      setShowAckRow(true)
      setAckChecked(false)
      return
    }
    // Re-enabling — no friction. Just flip + clear the ack row.
    setIncludeCanSpamFooter(true)
    setShowAckRow(false)
    setAckChecked(false)
  }

  function confirmDisable() {
    setIncludeCanSpamFooter(false)
    setShowAckRow(false)
  }

  function cancelDisable() {
    setShowAckRow(false)
    setAckChecked(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')

      // Build the update payload — for each platform, store NULL when
      // the draft equals the bundled default so we don't accumulate
      // useless overrides in the DB.
      const update: Record<string, string | boolean | null | FollowUpConfig> = {
        email_template: drafts.email === DEFAULT_TEMPLATES.email ? null : drafts.email,
        ig_dm_template: drafts.ig_dm === DEFAULT_TEMPLATES.ig_dm ? null : drafts.ig_dm,
        linkedin_dm_template: drafts.linkedin_dm === DEFAULT_TEMPLATES.linkedin_dm ? null : drafts.linkedin_dm,
        x_dm_template: drafts.x_dm === DEFAULT_TEMPLATES.x_dm ? null : drafts.x_dm,
        tiktok_dm_template: drafts.tiktok_dm === DEFAULT_TEMPLATES.tiktok_dm ? null : drafts.tiktok_dm,
        // Email subject template — separate column in user_profile.
        // NULL when matching the default keeps the row uncluttered.
        subject_template: subjectDraft.trim() === DEFAULT_EMAIL_SUBJECT ? null : subjectDraft.trim() || null,
        include_can_spam_footer: includeCanSpamFooter,
        // Follow-up library — NULL when it's the untouched bundled default
        // so the user keeps inheriting future default-copy improvements.
        followup_config: followUpConfigIsDefault(followUpConfig) ? null : followUpConfig,
      }
      // Stamp the acknowledgment if the user just disabled it AND
      // wasn't already disabled before (i.e., this save is the moment
      // of disabling).
      if (!includeCanSpamFooter && profile?.includeCanSpamFooter !== false) {
        update.footer_disabled_acknowledged_at = new Date().toISOString()
      }

      const { error: upErr } = await supabase
        .from('user_profile')
        .update(update)
        .eq('user_id', user.id)
      if (upErr) throw new Error(upErr.message)

      // Notify parent so the in-memory profile reflects the save
      // without a full reload.
      onSaved?.({
        emailTemplate: update.email_template as string | null,
        igDmTemplate: update.ig_dm_template as string | null,
        linkedinDmTemplate: update.linkedin_dm_template as string | null,
        xDmTemplate: update.x_dm_template as string | null,
        tiktokDmTemplate: update.tiktok_dm_template as string | null,
        subjectTemplate: (update.subject_template as string | null) ?? undefined,
        includeCanSpamFooter,
        footerDisabledAcknowledgedAt:
          (update.footer_disabled_acknowledged_at as string | undefined) ??
          profile?.footerDisabledAcknowledgedAt ??
          null,
        followUpConfig: (update.followup_config as FollowUpConfig | null),
      })

      setSavedAt(Date.now())
      // Clear the "saved" flash after 1.5s
      setTimeout(() => setSavedAt(null), 1500)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  // Variables for the preview pane. Pulls from the user's profile so
  // the preview shows their actual name, pitch line, LinkedIn URL —
  // and substitutes a sample recipient for {name}/{channel}/{content}.
  const previewVars: TemplateVars = useMemo(() => {
    const senderFull = (profile?.fullName ?? '').trim()
    const senderFirst = senderFull.split(/\s+/)[0] || 'you'
    return {
      ...SAMPLE_RECIPIENT,
      pitch: (profile?.pitchLine ?? '').trim() || '[your pitch line — set this in Profile]',
      sender_first: senderFirst,
      sender_full: senderFull || '[your name — set this in Profile]',
      linkedin: (profile?.linkedinUrl ?? '').trim(),
    }
  }, [profile?.fullName, profile?.pitchLine, profile?.linkedinUrl])

  const currentDraft = drafts[activePlatform]
  const previewSegments = renderTemplatePreview(currentDraft, previewVars)
  const isDefault = currentDraft === DEFAULT_TEMPLATES[activePlatform]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-modal-title"
    >
      <div
        data-tour-id="templates-modal"
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 id="templates-modal-title" className="text-lg font-semibold text-foreground">
              Templates
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tailor the message that gets sent or copied to your clipboard per platform.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-tailored-variables callout — Dylan 2026-06-08. Makes
            it unmistakable that {variables} get filled in per recipient
            so users don't think the template is sent verbatim. */}
        <div className="px-6 py-2.5 border-b border-border bg-purple-500/5 shrink-0">
          <div className="flex items-start gap-2 text-[12px] text-foreground/85 leading-snug">
            <Info className="w-3.5 h-3.5 mt-0.5 text-purple-600 dark:text-purple-400 shrink-0" aria-hidden />
            <p>
              Variables in <span className="font-mono text-purple-700 dark:text-purple-300">{'{curly braces}'}</span> get
              automatically replaced per recipient — their name, channel, top video, your pitch, etc.
              You write the template once; each creator gets a tailored version.
            </p>
          </div>
        </div>

        {/* Platform tabs */}
        <div className="px-6 pt-4 border-b border-border shrink-0">
          <div className="flex gap-1 overflow-x-auto">
            {PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => { setActivePlatform(p); setShowFollowUps(false) }}
                className={`px-3 py-2 text-[13px] font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  activePlatform === p && !showFollowUps
                    ? 'bg-muted text-foreground border-b-2 border-purple-500 -mb-px'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
            <button
              onClick={() => setShowFollowUps(true)}
              className={`px-3 py-2 text-[13px] font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                showFollowUps
                  ? 'bg-muted text-foreground border-b-2 border-purple-500 -mb-px'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Follow-ups
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {showFollowUps ? (
            <FollowUpTemplatesEditor
              config={followUpConfig}
              onChange={setFollowUpConfig}
              previewVars={previewVars}
            />
          ) : (
          <>
          <div className="grid md:grid-cols-2 gap-5">
            {/* Editor column */}
            <div className="flex flex-col">
              {/* Subject editor (Email only). Sits above the body
                  editor since the subject is what the recipient sees
                  first. Same variable syntax as the body — clicking a
                  chip while the subject input is focused inserts there. */}
              {activePlatform === 'email' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="email-subject-input" className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Subject
                    </label>
                    <button
                      onClick={() => setSubjectDraft(DEFAULT_EMAIL_SUBJECT)}
                      disabled={subjectDraft === DEFAULT_EMAIL_SUBJECT}
                      className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Reset subject to default"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </button>
                  </div>
                  <input
                    id="email-subject-input"
                    ref={subjectRef}
                    type="text"
                    value={subjectDraft}
                    onChange={e => setSubjectDraft(e.target.value)}
                    onFocus={() => setLastFocused('subject')}
                    placeholder={DEFAULT_EMAIL_SUBJECT}
                    spellCheck={false}
                    className="w-full px-3 py-2 text-[13px] font-mono bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
                  />
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <label htmlFor="template-body" className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {activePlatform === 'email' ? 'Body' : 'Message'}
                </label>
                <button
                  onClick={() => resetToDefault(activePlatform)}
                  disabled={isDefault}
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Reset to bundled default"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
              <textarea
                id="template-body"
                ref={editorRef}
                value={currentDraft}
                onChange={e => setDraft(activePlatform, e.target.value)}
                onFocus={() => setLastFocused('body')}
                rows={12}
                className="flex-1 min-h-[240px] w-full px-3 py-2.5 text-[13px] font-mono leading-relaxed bg-background border border-border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
                spellCheck={false}
              />
              {/* Variable chips — click-to-insert at cursor. Clicking
                  inserts {var} at whichever input was last focused
                  (subject or body), keeping the cursor right after
                  the inserted token. Hover for full description. */}
              <div className="mt-3">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80 mb-2">
                  Variables · click to insert
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARS.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted hover:bg-purple-500/15 hover:border-purple-500/40 text-foreground/80 hover:text-foreground border border-border transition-colors"
                      title={`${v.label} — ${v.description}`}
                    >
                      {'{' + v.key + '}'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview column */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Preview
                </label>
                <span className="text-[11px] text-muted-foreground/80">
                  <u className="decoration-purple-500/60 underline-offset-2">Underlined</u>
                  {' '}= changes per recipient
                </span>
              </div>
              {/* Email subject preview row — rendered above the body
                  preview for a closer-to-Gmail visual. */}
              {activePlatform === 'email' && (
                <div className="mb-3 px-3 py-2 text-[13px] bg-muted/40 border border-border rounded-lg">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 mb-1">Subject</div>
                  <div className="font-medium text-foreground/90">
                    {applyTemplate(subjectDraft || DEFAULT_EMAIL_SUBJECT, previewVars) || (
                      <span className="text-muted-foreground/50 italic">(empty)</span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex-1 min-h-[240px] px-3 py-2.5 text-[13px] leading-relaxed bg-background border border-border rounded-lg whitespace-pre-wrap text-foreground/90">
                {previewSegments.map((seg, i) =>
                  seg.kind === 'text' ? (
                    <span key={i}>{seg.value}</span>
                  ) : seg.perRecipient ? (
                    <u
                      key={i}
                      className="decoration-purple-500/60 underline-offset-2 text-foreground"
                      title={`{${seg.key}} — substituted per recipient`}
                    >
                      {seg.value || `{${seg.key}}`}
                    </u>
                  ) : (
                    <span
                      key={i}
                      className="text-foreground"
                      title={`{${seg.key}} — from your Profile`}
                    >
                      {seg.value || `{${seg.key}}`}
                    </span>
                  ),
                )}
                {/* Email-only — show what the CAN-SPAM footer would
                    look like (when enabled) so the user can see the
                    full final shape. Reply-based opt-out (no URL, no
                    domain reveal) — see lib/format.ts buildCanSpamFooter. */}
                {activePlatform === 'email' && includeCanSpamFooter && (
                  <span className="text-foreground/60 italic">
                    {`\n\n—\n${previewVars.sender_full ?? ''} · ${(profile?.physicalAddress ?? '').trim() || '[your address from Profile]'}\nReply "unsubscribe" if you'd rather not hear from me again.`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* CAN-SPAM toggle — only meaningful for email. Show on every
              tab so users can find it but make it look like a
              cross-platform setting (since it applies to email body
              regardless of which tab they edit from). */}
          <div className="mt-6 pt-5 border-t border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5 flex-1">
                <input
                  type="checkbox"
                  id="can-spam-toggle"
                  checked={includeCanSpamFooter}
                  onChange={e => onToggleCanSpam(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-purple-600 cursor-pointer"
                />
                <label
                  htmlFor="can-spam-toggle"
                  className="text-[13px] text-foreground/90 cursor-pointer leading-snug"
                >
                  Include unsubscribe footer on email sends
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 ml-1.5 rounded-full bg-muted border border-border text-muted-foreground cursor-help align-middle"
                    title={`When ON (default), every email body gets a 3-line footer:\n\n— Your name · Your postal address\nReply "unsubscribe" if you'd rather not hear from me again.\n\nRequired by CAN-SPAM for commercial emails, plus GDPR / CASL for international recipients. Disabling shifts full compliance responsibility to you as the sender.`}
                    aria-label="More info"
                  >
                    <Info className="w-2.5 h-2.5" />
                  </span>
                </label>
              </div>
            </div>

            {/* Acknowledgment row — only shows when the user clicked
                the toggle OFF. Low-key inline (not a modal-on-modal),
                but requires explicit acceptance before the save will
                persist the disabled state. */}
            {showAckRow && (
              <div className="mt-3 ml-7 bg-yellow-500/8 border border-yellow-500/30 rounded-lg px-3 py-2.5">
                <div className="text-[12px] text-foreground/85 leading-relaxed">
                  <strong className="font-semibold">You are the sender.</strong>{' '}
                  Disabling the unsubscribe footer means you assume full responsibility for
                  compliance with CAN-SPAM, GDPR, CASL, and other applicable email laws.
                  Creator Outreach is the tool; you are the sender.
                </div>
                <label className="mt-2 flex items-center gap-2 text-[12px] text-foreground/85 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ackChecked}
                    onChange={e => setAckChecked(e.target.checked)}
                    className="w-3.5 h-3.5 accent-purple-600"
                  />
                  I understand and accept this responsibility.
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={confirmDisable}
                    disabled={!ackChecked}
                    className="text-[11px] font-medium px-3 py-1 rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    Disable footer
                  </button>
                  <button
                    onClick={cancelDisable}
                    className="text-[11px] font-medium px-3 py-1 rounded-md border border-border text-foreground hover:bg-muted transition-colors"
                  >
                    Keep it on
                  </button>
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border flex items-center justify-between shrink-0 bg-card/60">
          <div className="text-[12px] text-muted-foreground">
            {error ? (
              <span className="text-red-600 dark:text-red-400">{error}</span>
            ) : savedAt ? (
              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            ) : (
              <span>NULL drafts that match the default are stored as NULL — no DB bloat.</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-[13px] font-medium px-4 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors"
            >
              Close
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-[13px] font-medium px-4 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Suppress unused-export warning for `useRef` — kept available for future
// editor enhancements (e.g., insert-at-cursor variable chip insertion).
void useRef
