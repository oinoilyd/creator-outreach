'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/types'

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
  const [fullName, setFullName] = useState(initial.fullName)
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedinUrl)
  const [pitchLine, setPitchLine] = useState(initial.pitchLine)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Reset form if the initial prop changes (e.g. user re-opens after editing)
  useEffect(() => {
    setFullName(initial.fullName)
    setLinkedinUrl(initial.linkedinUrl)
    setPitchLine(initial.pitchLine)
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
    }
    const { error: err } = await supabase
      .from('user_profile')
      .update({
        full_name: next.fullName,
        linkedin_url: next.linkedinUrl,
        pitch_line: next.pitchLine,
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
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-7" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-white">Profile</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>
        <p className="text-gray-500 text-sm mb-6">Used in your outreach emails. Edits apply to every future email you send.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Full name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              LinkedIn URL <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/your-handle"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Pitch line <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={pitchLine}
              onChange={e => setPitchLine(e.target.value)}
              placeholder="e.g. I work with YouTube creators on growth — editing, content strategy, the full picture."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
            <p className="text-[11px] text-gray-600 mt-1">One line about what you do. Goes after &quot;I&apos;m [your name]&quot; in outreach emails.</p>
          </div>
        </div>

        {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2 mt-4">{error}</div>}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
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
