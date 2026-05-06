'use client'

import { useState } from 'react'
import type { ScoreWeights, GuidanceEntry, PlatformId, GuidancePreset } from '@/lib/types'
import { PLATFORM_CONFIGS } from '@/lib/platform'
import { GUIDANCE_PRESETS, DEFAULT_GUIDANCE_WEIGHT } from '@/lib/guidance'
import { DEFAULT_WEIGHTS, WEIGHT_META } from '@/lib/scoring'
import { PlatformIcon } from './ui'

export function ScoreSettingsModal({ weights, narrative, guidanceEntries, activePlatform, onAddGuidance, onRemoveGuidance, onUpdateGuidanceWeight, onResetGuidance, onSave, onClose }: {
  weights: ScoreWeights
  narrative: string
  guidanceEntries: GuidanceEntry[]
  activePlatform: PlatformId
  onAddGuidance: (e: GuidanceEntry) => void
  onRemoveGuidance: (id: string) => void
  onUpdateGuidanceWeight: (id: string, weight: number) => void
  onResetGuidance: () => void
  onSave: (w: ScoreWeights, n: string) => void
  onClose: () => void
}) {
  const [showDefaultSliders, setShowDefaultSliders] = useState(false)
  const [draft, setDraft] = useState<ScoreWeights>({ ...weights })
  const lockedPlatform = PLATFORM_CONFIGS.find(p => p.id === activePlatform && p.condition !== null)

  const activeTexts = new Set(guidanceEntries.map(e => e.text))
  const customEntries = guidanceEntries.filter(e => !GUIDANCE_PRESETS.some(p => p.entry.text === e.text))
  const baseTotal = draft.recency + draft.views + draft.reachability + draft.relevance + draft.quality
  const baseNorm = baseTotal > 0 ? 100 / baseTotal : 1

  function togglePreset(preset: GuidancePreset) {
    const existing = guidanceEntries.find(e => e.text === preset.entry.text)
    if (existing) {
      onRemoveGuidance(existing.id)
    } else {
      onAddGuidance({ id: `g-${Date.now()}-${Math.random().toString(36).slice(2)}`, timestamp: Date.now(), ...preset.entry })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-foreground font-semibold text-base flex items-center gap-2">
              <span className="text-purple-400">✨</span> Lead Criteria
            </h2>
            <p className="text-muted-foreground text-xs mt-0.5">Select what makes a great lead — these affect every creator's score</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold block mb-3">Select your criteria</span>
            {lockedPlatform && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-muted/60 mb-3">
                <span className="text-muted-foreground shrink-0"><PlatformIcon id={lockedPlatform.id} className="w-4 h-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground/80">{lockedPlatform.chipLabel}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Auto-applied · switch platform to change</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {GUIDANCE_PRESETS.map(preset => {
                const active = activeTexts.has(preset.entry.text)
                return (
                  <button
                    key={preset.label}
                    onClick={() => togglePreset(preset)}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                      active
                        ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-400 dark:border-purple-600 text-purple-900 dark:text-foreground'
                        : 'bg-muted/60 border-border text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >
                    <span className="text-base shrink-0 mt-0.5">{preset.emoji}</span>
                    <div className="min-w-0">
                      <div className={`text-sm font-medium leading-tight ${active ? 'text-foreground' : 'text-foreground/80'}`}>{preset.label}</div>
                      <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{preset.description}</div>
                    </div>
                    {active && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-400 shrink-0 ml-auto mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>
                )
              })}
              {customEntries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => onRemoveGuidance(entry.id)}
                  className="flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all bg-purple-100 dark:bg-purple-900/40 border-purple-400 dark:border-purple-600 text-purple-900 dark:text-foreground hover:border-red-500/60 group"
                  title="Click to remove"
                >
                  <span className="text-base shrink-0 mt-0.5">✏️</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight text-foreground truncate">{entry.summary || entry.text}</div>
                    <div className="text-[11px] text-purple-300/70 leading-snug mt-0.5">Custom · click to remove</div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-purple-400 group-hover:text-red-400 shrink-0 ml-auto mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              ))}
            </div>
          </div>

          {guidanceEntries.length > 0 && (
            <div className="border-t border-border pt-4">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold block mb-3">Adjust criteria impact</span>
              <div className="space-y-3">
                {guidanceEntries.map(entry => {
                  const preset = GUIDANCE_PRESETS.find(p => p.entry.text === entry.text)
                  const entryLabel = preset ? `${preset.emoji} ${preset.label}` : (entry.summary?.slice(0, 40) || 'Custom criterion')
                  const w = entry.weight ?? DEFAULT_GUIDANCE_WEIGHT
                  const chipTotal = guidanceEntries.reduce((sum, e) => sum + (e.weight ?? DEFAULT_GUIDANCE_WEIGHT), 0)
                  const pct = chipTotal > 0 ? Math.round((w / chipTotal) * 100) : 0
                  return (
                    <div key={entry.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-purple-300 truncate max-w-[78%]">{entryLabel}</span>
                        <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
                      </div>
                      <input
                        type="range" min={0} max={30} step={1}
                        value={w}
                        onChange={e => onUpdateGuidanceWeight(entry.id, parseInt(e.target.value))}
                        className="w-full h-1.5 appearance-none bg-muted rounded-full cursor-pointer accent-purple-400"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <button
              onClick={() => setShowDefaultSliders(v => !v)}
              className="flex items-center gap-2 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors w-full"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${showDefaultSliders ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              Use default scoring instead
            </button>
            {showDefaultSliders && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground/70">These are the default signals used when no criteria are selected. Selecting criteria above overrides this entirely.</p>
                {WEIGHT_META.map(({ key, label }) => {
                  const pct = Math.round(draft[key] * baseNorm)
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">{label}</span>
                        <span className="text-xs font-mono text-muted-foreground/70">{pct}%</span>
                      </div>
                      <input
                        type="range" min={0} max={50} step={1}
                        value={draft[key]}
                        onChange={e => setDraft(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                        className="w-full h-1.5 appearance-none bg-muted rounded-full cursor-pointer accent-indigo-500"
                      />
                    </div>
                  )
                })}
                <button onClick={() => setDraft({ ...DEFAULT_WEIGHTS })} className="text-xs text-muted-foreground/70 hover:text-muted-foreground underline underline-offset-2">Reset to defaults</button>
              </div>
            )}
          </div>

        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
          <div className="flex items-center gap-3">
            {(guidanceEntries.length > 0 || lockedPlatform)
              ? <span className="text-xs text-purple-400">{guidanceEntries.length + (lockedPlatform ? 1 : 0)} criteria active{lockedPlatform ? ` (incl. ${lockedPlatform.label})` : ''}</span>
              : <span className="text-xs text-muted-foreground">Using default scoring</span>
            }
            {guidanceEntries.length > 0 && (
              <button
                onClick={() => { onResetGuidance(); setDraft({ ...DEFAULT_WEIGHTS }); setShowDefaultSliders(false) }}
                className="text-xs text-muted-foreground/50 hover:text-red-400 underline underline-offset-2 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={() => { onSave(draft, narrative); onClose() }}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-foreground text-sm font-semibold rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
