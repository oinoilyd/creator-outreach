/**
 * Tiny inline-markdown parser shared by the three renderers (JSX,
 * DOCX, PDF). Supports just two formats:
 *   • **bold text**
 *   • [link text](href)
 *
 * Anything else is treated as plain text. Keep this dumb — if we
 * ever need real markdown, swap in a vetted library instead of
 * growing this file.
 */

export type Run =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'link'; text: string; href: string }

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g
const BOLD_RE = /\*\*([^*]+)\*\*/g

/**
 * Parse a mini-markdown string into typed runs.
 *
 * Two passes: first slice out links so their inner text is never
 * mistaken for bold markup, then slice bold runs out of each
 * remaining text segment.
 */
export function parseInline(md: string): Run[] {
  // Pass 1: split out [text](href) into discrete link runs;
  // everything else stays as 'text' for the next pass.
  type PreRun = { type: 'text'; text: string } | { type: 'link'; text: string; href: string }
  const preRuns: PreRun[] = []
  let lastIndex = 0
  LINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = LINK_RE.exec(md)) !== null) {
    if (match.index > lastIndex) {
      preRuns.push({ type: 'text', text: md.slice(lastIndex, match.index) })
    }
    preRuns.push({ type: 'link', text: match[1], href: match[2] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < md.length) {
    preRuns.push({ type: 'text', text: md.slice(lastIndex) })
  }

  // Pass 2: within each plain-text fragment, split out **bold**
  // segments. Link runs pass through unchanged.
  const runs: Run[] = []
  for (const run of preRuns) {
    if (run.type !== 'text') {
      runs.push(run)
      continue
    }
    const segment = run.text
    let segLast = 0
    BOLD_RE.lastIndex = 0
    let boldMatch: RegExpExecArray | null
    while ((boldMatch = BOLD_RE.exec(segment)) !== null) {
      if (boldMatch.index > segLast) {
        runs.push({ type: 'text', text: segment.slice(segLast, boldMatch.index) })
      }
      runs.push({ type: 'bold', text: boldMatch[1] })
      segLast = boldMatch.index + boldMatch[0].length
    }
    if (segLast < segment.length) {
      runs.push({ type: 'text', text: segment.slice(segLast) })
    }
  }

  return runs
}
