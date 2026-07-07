/**
 * Per-platform message templates.
 *
 * Today every outreach platform has a baked-in template (email lives
 * in lib/format.ts:buildOutreachContent, IG DM lives in lib/outreach.ts).
 * This module centralizes:
 *
 *   1. The default template strings for all five platforms below.
 *   2. A simple `applyTemplate()` engine that substitutes {name}, {channel},
 *      {content}, {pitch}, {sender_first}, {sender_full}, {linkedin} into
 *      the template text.
 *   3. A `renderTemplatePreview()` helper that produces the substituted
 *      text PLUS a parsed structure marking which spans came from
 *      variables — used by the Templates modal to render the live
 *      preview with per-recipient variables underlined.
 *
 * User-customized templates (saved on user_profile.{platform}_template)
 * override these defaults at render + send time. NULL/empty override
 * means "use the bundled default."
 *
 * The variable syntax `{var}` is intentionally minimal:
 *   • Easy to type in a textarea
 *   • Easy to grep/transform
 *   • Familiar to anyone who's used a basic SaaS template editor
 *
 * To add a new variable, extend TEMPLATE_VARS + update the resolveVar
 * function below. The TemplatesModal reads TEMPLATE_VARS to render the
 * "available variables" sidebar.
 */

export type Platform = 'email' | 'ig_dm' | 'linkedin_dm' | 'x_dm' | 'tiktok_dm'

export interface TemplateVar {
  key: string
  label: string
  description: string
  example: string
}

/**
 * Variables available in every template, in order they'd typically
 * appear. The Templates modal renders this list as "click to insert"
 * chips next to the editor.
 */
export const TEMPLATE_VARS: TemplateVar[] = [
  {
    key: 'name',
    label: 'Their first name',
    description: 'Recipient\'s first name — parsed from their channel name.',
    example: 'Gaynor',
  },
  {
    key: 'channel',
    label: 'Their channel name',
    description: 'Full channel / handle as listed on the platform.',
    example: 'Gaynor Media',
  },
  {
    key: 'content',
    label: 'Reference to their content',
    description: 'A short phrase referencing the recipient\'s recent content (latest video title or niche description).',
    example: '"How I grew my channel to 100K subs"',
  },
  {
    key: 'pitch',
    label: 'Your pitch line',
    description: 'Pulled from your Profile → Pitch line. Same on every send.',
    example: 'I run a YouTube growth agency that helped 50+ creators 2x their subs in 90 days.',
  },
  {
    key: 'sender_first',
    label: 'Your first name',
    description: 'Pulled from your Profile → Full name. Used to sign emails.',
    example: 'Ryan',
  },
  {
    key: 'sender_full',
    label: 'Your full name',
    description: 'Pulled from your Profile → Full name.',
    example: 'Ryan Gaynor',
  },
  {
    key: 'linkedin',
    label: 'Your LinkedIn URL',
    description: 'Pulled from your Profile → LinkedIn URL.',
    example: 'https://linkedin.com/in/ryan-gaynor',
  },
]

/**
 * The default template text per platform. Each is intentionally short
 * and personal-sounding — voice matters more than length for cold
 * outreach. Users can rewrite them entirely in the Templates modal.
 *
 * Defaults sized to each platform:
 *   • email          — 4 paragraphs, formal-but-warm. Includes opener,
 *                      personalized hook, pitch, soft CTA.
 *   • ig_dm          — 1-2 sentences, casual, no signoff.
 *   • linkedin_dm    — 3 paragraphs, business-warm.
 *   • x_dm           — 1 sentence, ultra-tight. 1000-char limit on X.
 *   • tiktok_dm      — 1 sentence, friendly, no period at end.
 */
export const DEFAULT_TEMPLATES: Record<Platform, string> = {
  email: `Hey {name},

Came across {channel} recently and {content} stood out. {pitch}

Worth a quick chat this week?

{sender_first}`,

  ig_dm: `Hey {name}! Found you through {channel} — loved {content}. {pitch} Open to a quick chat?`,

  linkedin_dm: `Hi {name},

Came across {channel} on LinkedIn and {content} caught my eye. {pitch}

Worth a quick chat this week?`,

  x_dm: `Hey {name} — big fan of {channel}, especially {content}. {pitch} Down to chat?`,

  tiktok_dm: `Hey {name}! Love {content} on {channel}. {pitch}`,
}

/**
 * Email-only: subject line template. Stored separately from the body
 * because subject lines deserve their own editor in the Templates
 * modal (different variable mix usually — recipient channel, not body
 * pitch). User override lives in user_profile.subject_template.
 */
export const DEFAULT_EMAIL_SUBJECT = `Quick thought on {channel}`

// ── Follow-up templates (email) ─────────────────────────────────────
//
// Follow-ups are STAGED: the message escalates across touches (gentle
// nudge → reframe → short ask → break-up). Users can keep a LIBRARY of
// named sets and choose one per lead; one set is the default the auto-
// sender falls back to. Everything below is email-only for now.

/** Human labels for the four follow-up stages, index-aligned with a
 *  set's `stages` array. Shown as the editor tabs in the modal. */
export const FOLLOWUP_STAGE_LABELS = [
  'First follow-up',
  'Second follow-up',
  'Third follow-up',
  'Final attempt',
] as const

export const FOLLOWUP_STAGE_COUNT = FOLLOWUP_STAGE_LABELS.length

/** Bundled default copy for each stage. Same {variable} syntax as the
 *  cold-email template; subjects thread on the original (Re:) so no
 *  per-stage subject is needed. */
export const DEFAULT_FOLLOWUP_STAGES: string[] = [
  `Hey {name},

Quick nudge on my last note — didn't want it to slip by. Still think there's something worth exploring with {channel}, and I'll keep it short.

Open to a quick chat this week?

{sender_first}`,

  `Hey {name},

Following up once more — I'll be brief. {pitch}

If the timing's off, just say the word and I'll circle back later.

{sender_first}`,

  `Hey {name},

Still worth a conversation? A quick yes or no is all I need — I don't want to clutter your inbox.

{sender_first}`,

  `Hey {name},

I'll close the loop here so I'm not a pest. If working together ever makes sense down the road, my door's open — just reply anytime.

All the best,
{sender_first}`,
]

/** One named follow-up set = the four stage bodies + a display name.
 *  `stages` is always length FOLLOWUP_STAGE_COUNT; a blank entry falls
 *  back to the bundled default for that stage at send time. */
export interface FollowUpSet {
  id: string
  name: string
  stages: string[]
}

/** The whole library: the user's sets + which one is the default. */
export interface FollowUpConfig {
  sets: FollowUpSet[]
  defaultId: string
}

/** Stable id for the bundled starter set so a fresh user always has a
 *  valid default without writing anything to their profile. */
export const BUNDLED_FOLLOWUP_SET_ID = 'default'

export function bundledFollowUpSet(): FollowUpSet {
  return {
    id: BUNDLED_FOLLOWUP_SET_ID,
    name: 'Default',
    stages: [...DEFAULT_FOLLOWUP_STAGES],
  }
}

/** Normalize any stored config into a guaranteed-valid one: at least one
 *  set, every set padded to FOLLOWUP_STAGE_COUNT stages, and a defaultId
 *  that actually points at a set. Callers can trust the result. */
export function resolveFollowUpConfig(cfg: FollowUpConfig | null | undefined): FollowUpConfig {
  const sets = (cfg?.sets ?? []).filter(s => s && typeof s.id === 'string')
  if (sets.length === 0) {
    const bundled = bundledFollowUpSet()
    return { sets: [bundled], defaultId: bundled.id }
  }
  const normalized = sets.map(s => ({
    id: s.id,
    name: (s.name || 'Untitled').trim() || 'Untitled',
    stages: Array.from({ length: FOLLOWUP_STAGE_COUNT }, (_, i) => s.stages?.[i] ?? ''),
  }))
  const defaultId = normalized.some(s => s.id === cfg?.defaultId)
    ? (cfg as FollowUpConfig).defaultId
    : normalized[0].id
  return { sets: normalized, defaultId }
}

/** Which stage template applies given how many touches have happened.
 *  touchpoints ≤1 → first follow-up … ≥4 → final attempt. Mirrors
 *  followUpStageLabel in lib/outreach.ts. */
export function followUpStageIndex(touchpoints: number): number {
  if (touchpoints <= 1) return 0
  if (touchpoints === 2) return 1
  if (touchpoints === 3) return 2
  return FOLLOWUP_STAGE_COUNT - 1
}

/** Resolve the set to use for a lead: its assigned set if the id still
 *  exists, else the configured default, else the first set. Never null. */
export function pickFollowUpSet(
  cfg: FollowUpConfig | null | undefined,
  setId: string | null | undefined,
): FollowUpSet {
  const resolved = resolveFollowUpConfig(cfg)
  return (
    resolved.sets.find(s => s.id === setId) ||
    resolved.sets.find(s => s.id === resolved.defaultId) ||
    resolved.sets[0]
  )
}

/** The stage body to send for a given set + touch count, falling back to
 *  the bundled default when the user left that stage blank. */
export function followUpStageBody(set: FollowUpSet, touchpoints: number): string {
  const idx = followUpStageIndex(touchpoints)
  const own = (set.stages?.[idx] ?? '').trim()
  return own || DEFAULT_FOLLOWUP_STAGES[idx]
}

/** True when a config is just the untouched bundled default. Callers
 *  store NULL in that case so the user keeps inheriting future default-
 *  copy improvements instead of a frozen snapshot. */
export function followUpConfigIsDefault(cfg: FollowUpConfig): boolean {
  if (cfg.sets.length !== 1) return false
  const s = cfg.sets[0]
  return (
    s.id === BUNDLED_FOLLOWUP_SET_ID &&
    cfg.defaultId === BUNDLED_FOLLOWUP_SET_ID &&
    s.name === 'Default' &&
    s.stages.length === DEFAULT_FOLLOWUP_STAGES.length &&
    s.stages.every((st, i) => st === DEFAULT_FOLLOWUP_STAGES[i])
  )
}

/** Generate a short, url-safe id for a new set. Index-seeded (not random)
 *  so it stays deterministic — callers pass the current set count. */
export function newFollowUpSetId(seed: number): string {
  return `set-${seed}-${(seed * 2654435761 % 100000).toString(36)}`
}

/**
 * Pick the template to use for a given platform — user override if
 * set, otherwise bundled default.
 */
export function resolveTemplate(
  platform: Platform,
  userOverride: string | null | undefined,
): string {
  const trimmed = (userOverride ?? '').trim()
  return trimmed || DEFAULT_TEMPLATES[platform]
}

export interface TemplateVars {
  name?: string
  channel?: string
  content?: string
  pitch?: string
  sender_first?: string
  sender_full?: string
  linkedin?: string
}

/**
 * Substitute {variable} placeholders in `template` with values from
 * `vars`. Missing values become empty strings so the rendered output
 * doesn't leak placeholder syntax to recipients.
 */
export function applyTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{([a-z_]+)\}/g, (_, key) => {
    const v = (vars as Record<string, string | undefined>)[key]
    return (v ?? '').toString()
  })
}

/**
 * Parsed segment from a template — either literal text or a variable
 * span. Used by the Templates modal to render the live preview with
 * per-recipient variables marked (e.g. underlined). The send path uses
 * applyTemplate() directly and ignores this structure.
 */
export type RenderedSegment =
  | { kind: 'text'; value: string }
  | { kind: 'var'; key: string; value: string; perRecipient: boolean }

/**
 * Variables whose value changes for EVERY recipient (so the Templates
 * modal underlines them in the preview). The others (pitch, sender_*,
 * linkedin) come from the user's profile and are the same on every
 * send — they're substituted but rendered as plain text.
 */
const PER_RECIPIENT_VARS = new Set<string>(['name', 'channel', 'content'])

/**
 * Render a template into a sequence of segments suitable for preview
 * rendering. Literal text is one kind of segment; each {var} becomes
 * its own segment with the resolved value + a flag indicating whether
 * it's per-recipient (preview should underline) or static (preview
 * shows as normal text).
 */
export function renderTemplatePreview(
  template: string,
  vars: TemplateVars,
): RenderedSegment[] {
  const out: RenderedSegment[] = []
  const re = /\{([a-z_]+)\}/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(template)) !== null) {
    if (m.index > lastIndex) {
      out.push({ kind: 'text', value: template.slice(lastIndex, m.index) })
    }
    const key = m[1]
    const value =
      (vars as Record<string, string | undefined>)[key] ?? ''
    out.push({
      kind: 'var',
      key,
      value,
      perRecipient: PER_RECIPIENT_VARS.has(key),
    })
    lastIndex = re.lastIndex
  }
  if (lastIndex < template.length) {
    out.push({ kind: 'text', value: template.slice(lastIndex) })
  }
  return out
}

/**
 * Sample values used for the live preview in the Templates modal so
 * the user sees what a real send will look like before they save.
 * These are placeholders that the modal substitutes into preview
 * variables; real sends use values from the actual creator + profile.
 *
 * "John Doe" intentionally generic — no real user, easy to recognize
 * as a placeholder so the preview reads as obviously fake.
 */
export const SAMPLE_RECIPIENT: TemplateVars = {
  name: 'John',
  channel: 'John Doe',
  content: 'your latest video',
}

/**
 * Display labels for each platform — used in the Templates modal tabs.
 */
export const PLATFORM_LABELS: Record<Platform, string> = {
  email: 'Email',
  ig_dm: 'Instagram DM',
  linkedin_dm: 'LinkedIn DM',
  x_dm: 'X DM',
  tiktok_dm: 'TikTok DM',
}

/**
 * Map a Platform key to its corresponding user_profile column. Used by
 * the Templates modal save flow so the right field on the profile
 * gets written. Keeping this map in one place prevents drift between
 * the modal, the migration, and the send-time resolver.
 */
export const PLATFORM_TO_PROFILE_FIELD: Record<
  Platform,
  'emailTemplate' | 'igDmTemplate' | 'linkedinDmTemplate' | 'xDmTemplate' | 'tiktokDmTemplate'
> = {
  email: 'emailTemplate',
  ig_dm: 'igDmTemplate',
  linkedin_dm: 'linkedinDmTemplate',
  x_dm: 'xDmTemplate',
  tiktok_dm: 'tiktokDmTemplate',
}
