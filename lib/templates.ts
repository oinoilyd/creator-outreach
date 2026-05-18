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
 */
export const DEFAULT_TEMPLATES: Record<Platform, string> = {
  email: `Hey {name},

Love {content}.

{pitch}

Worth a quick chat?

{sender_first}`,

  ig_dm: `Hey {name} — saw {content} and had to reach out. {pitch} Down to chat?`,

  linkedin_dm: `Hi {name} — really enjoyed {content}. {pitch} Open to a quick chat?`,

  x_dm: `Hey {name}, big fan of {content}. {pitch} Open to chatting?`,

  tiktok_dm: `Hey {name}! Love {content}. {pitch} Let's connect?`,
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
 */
export const SAMPLE_RECIPIENT: TemplateVars = {
  name: 'Gaynor',
  channel: 'Gaynor Media',
  content: 'your latest video on growth tactics',
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
