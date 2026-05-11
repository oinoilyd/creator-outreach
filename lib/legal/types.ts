/**
 * Structured content types for legal/PnP documents.
 *
 * Each document is a `LegalDoc` with metadata + an array of blocks.
 * Blocks render to three formats from one source:
 *   • JSX  — on /terms, /privacy public pages
 *   • DOCX — admin Word downloads
 *   • PDF  — admin PDF downloads
 *
 * Inline formatting uses a tiny markdown-flavored mini-syntax:
 *   • **bold text**
 *   • [link text](https://example.com)
 *
 * Keep the block vocabulary minimal. New formatting needs → add a
 * new block type and support it in every renderer.
 */

export type Block =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; md: string } // markdown-flavored: **bold** + [text](url)
  | { type: 'ul'; items: string[] } // each item supports the same mini-md

export interface LegalDoc {
  /** URL slug used in /api routes + /admin/legal links. */
  slug: string
  /** Display name shown in headings + admin index. */
  title: string
  /** Human-readable last-updated stamp. */
  lastUpdated: string
  /** Short summary for the admin table. */
  summary: string
  /** True for public-facing docs (live at /terms, /privacy, etc).
   *  False for internal-only PnPs. */
  isPublic: boolean
  /** Optional intro paragraph rendered before the first heading. */
  intro?: string
  /** Body content as an ordered list of blocks. */
  blocks: Block[]
}
