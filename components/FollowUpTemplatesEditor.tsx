'use client'

/**
 * FollowUpTemplatesEditor — manages the user's library of follow-up
 * template SETS inside the Templates modal.
 *
 * A set = a name + the four stage bodies (1st / 2nd / 3rd / final).
 * One set is the default the auto-sender uses; on a manual follow-up
 * the user can pick a different set per lead. Email-only for now.
 *
 * Purely controlled: it holds no draft of its own — every edit produces
 * a new FollowUpConfig via onChange, so the parent modal's single Save
 * button persists the whole library alongside the platform templates.
 */

import { useRef, useState } from 'react'
import {
  type FollowUpConfig,
  type TemplateVars,
  FOLLOWUP_STAGE_LABELS,
  DEFAULT_FOLLOWUP_STAGES,
  TEMPLATE_VARS,
  renderTemplatePreview,
  newFollowUpSetId,
} from '@/lib/templates'
import { Star, Plus, Trash2, RotateCcw } from 'lucide-react'

interface Props {
  config: FollowUpConfig
  onChange: (next: FollowUpConfig) => void
  previewVars: TemplateVars
}

export function FollowUpTemplatesEditor({ config, onChange, previewVars }: Props) {
  const [activeSetId, setActiveSetId] = useState<string>(config.defaultId)
  const [activeStage, setActiveStage] = useState<number>(0)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)

  const activeSet = config.sets.find(s => s.id === activeSetId) ?? config.sets[0]
  const stageValue = activeSet.stages[activeStage] ?? ''
  // Blank stage inherits the bundled default at send time — show it here
  // so the editor + preview reflect what actually goes out.
  const effectiveStage = stageValue.trim() ? stageValue : DEFAULT_FOLLOWUP_STAGES[activeStage]
  const stageIsDefault = !stageValue.trim() || stageValue === DEFAULT_FOLLOWUP_STAGES[activeStage]

  function mutateStage(value: string) {
    onChange({
      ...config,
      sets: config.sets.map(s =>
        s.id === activeSet.id
          ? { ...s, stages: s.stages.map((st, i) => (i === activeStage ? value : st)) }
          : s,
      ),
    })
  }

  function renameActive(name: string) {
    onChange({
      ...config,
      sets: config.sets.map(s => (s.id === activeSet.id ? { ...s, name } : s)),
    })
  }

  function addSet() {
    const id = newFollowUpSetId(config.sets.length + 1)
    const next: FollowUpConfig = {
      ...config,
      sets: [...config.sets, { id, name: `Set ${config.sets.length + 1}`, stages: [...DEFAULT_FOLLOWUP_STAGES] }],
    }
    onChange(next)
    setActiveSetId(id)
    setActiveStage(0)
  }

  function deleteActive() {
    if (config.sets.length <= 1) return
    const remaining = config.sets.filter(s => s.id !== activeSet.id)
    const defaultId = config.defaultId === activeSet.id ? remaining[0].id : config.defaultId
    onChange({ sets: remaining, defaultId })
    setActiveSetId(remaining[0].id)
    setActiveStage(0)
  }

  function makeDefault() {
    onChange({ ...config, defaultId: activeSet.id })
  }

  function insertVar(key: string) {
    const token = `{${key}}`
    const el = editorRef.current
    if (!el) {
      mutateStage(effectiveStage + token)
      return
    }
    const start = el.selectionStart ?? effectiveStage.length
    const end = el.selectionEnd ?? effectiveStage.length
    const next = effectiveStage.slice(0, start) + token + effectiveStage.slice(end)
    mutateStage(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  const previewSegments = renderTemplatePreview(effectiveStage, previewVars)
  const isDefaultSet = config.defaultId === activeSet.id

  return (
    <div className="flex flex-col gap-4">
      {/* Set library — chips + New. The default set carries a star. */}
      <div>
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80 mb-2">
          Follow-up sets · pick one to edit
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {config.sets.map(s => (
            <button
              key={s.id}
              onClick={() => { setActiveSetId(s.id); setActiveStage(0) }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] rounded-lg border transition-colors ${
                s.id === activeSet.id
                  ? 'bg-purple-500/15 border-purple-500/50 text-foreground'
                  : 'bg-muted/60 border-border text-foreground/80 hover:text-foreground hover:border-border/80'
              }`}
              title={config.defaultId === s.id ? 'Default set — used by the automatic follow-up sender' : 'Click to edit'}
            >
              {config.defaultId === s.id && (
                <Star className="w-3 h-3 text-amber-500 fill-current shrink-0" aria-label="Default" />
              )}
              <span className="truncate max-w-[140px]">{s.name || 'Untitled'}</span>
            </button>
          ))}
          <button
            onClick={addSet}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-purple-500/40 transition-colors"
          >
            <Plus className="w-3 h-3" /> New set
          </button>
        </div>
      </div>

      {/* Active set controls — rename, make default, delete. */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={activeSet.name}
          onChange={e => renameActive(e.target.value)}
          placeholder="Set name"
          className="flex-1 min-w-[160px] px-3 py-1.5 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
        />
        <button
          onClick={makeDefault}
          disabled={isDefaultSet}
          className="text-[12px] font-medium px-2.5 py-1.5 rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"
          title="Use this set for the automatic follow-up sender"
        >
          <Star className="w-3 h-3" /> {isDefaultSet ? 'Default' : 'Make default'}
        </button>
        <button
          onClick={deleteActive}
          disabled={config.sets.length <= 1}
          className="text-[12px] font-medium px-2.5 py-1.5 rounded-md border border-border text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"
          title={config.sets.length <= 1 ? 'Keep at least one set' : 'Delete this set'}
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>

      {/* Stage sub-tabs */}
      <div className="flex gap-1 border-b border-border">
        {FOLLOWUP_STAGE_LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => setActiveStage(i)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeStage === i
                ? 'bg-muted text-foreground border-b-2 border-purple-500 -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Editor + preview */}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground">
              {FOLLOWUP_STAGE_LABELS[activeStage]}
            </label>
            <button
              onClick={() => mutateStage(DEFAULT_FOLLOWUP_STAGES[activeStage])}
              disabled={stageIsDefault}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Reset this stage to the bundled default"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
          <textarea
            ref={editorRef}
            value={effectiveStage}
            onChange={e => mutateStage(e.target.value)}
            rows={10}
            spellCheck={false}
            className="flex-1 min-h-[200px] w-full px-3 py-2.5 text-[13px] font-mono leading-relaxed bg-background border border-border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
          />
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80 mb-2">
              Variables · click to insert
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARS.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVar(v.key)}
                  className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted hover:bg-purple-500/15 hover:border-purple-500/40 text-foreground/80 hover:text-foreground border border-border transition-colors"
                  title={`${v.label} — ${v.description}`}
                >
                  {'{' + v.key + '}'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground">
              Preview
            </label>
            <span className="text-[11px] text-muted-foreground/80">
              Subject threads as <span className="font-mono">Re: …</span>
            </span>
          </div>
          <div className="flex-1 min-h-[200px] px-3 py-2.5 text-[13px] leading-relaxed bg-background border border-border rounded-lg whitespace-pre-wrap text-foreground/90">
            {previewSegments.map((seg, i) =>
              seg.kind === 'text' ? (
                <span key={i}>{seg.value}</span>
              ) : (
                <u
                  key={i}
                  className={seg.perRecipient ? 'decoration-purple-500/60 underline-offset-2 text-foreground' : 'no-underline text-foreground'}
                  title={`{${seg.key}} — ${seg.perRecipient ? 'substituted per recipient' : 'from your Profile'}`}
                >
                  {seg.value || `{${seg.key}}`}
                </u>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
