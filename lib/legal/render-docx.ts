import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
  type ParagraphChild,
} from 'docx'
import type { Block, LegalDoc } from './types'
import { parseInline, type Run } from './parse-inline'

/**
 * Render a LegalDoc as a .docx file. Returns a Buffer ready to
 * send as an attachment download.
 *
 * Internal links (e.g. /privacy) get expanded to absolute URLs
 * so the resulting Word doc is self-contained.
 */
export async function renderDocx(doc: LegalDoc): Promise<Buffer> {
  const children: Paragraph[] = []

  // Title page-ish (we don't bother with a real cover page — just
  // a big title + last-updated stamp at the top of the body).
  children.push(
    new Paragraph({
      children: [new TextRun({ text: doc.title, bold: true, size: 48 })],
      spacing: { after: 120 },
    }),
  )
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Last updated: ${doc.lastUpdated}`, italics: true, color: '666666', size: 20 }),
      ],
      spacing: { after: 360 },
    }),
  )

  if (doc.intro) {
    children.push(
      new Paragraph({
        children: runsToDocxChildren(parseInline(doc.intro)),
        spacing: { after: 240 },
      }),
    )
  }

  for (const block of doc.blocks) {
    children.push(...blockToParagraphs(block))
  }

  const docx = new Document({
    sections: [{ properties: {}, children }],
  })

  // Packer.toBuffer returns a Node Buffer when run server-side.
  return Packer.toBuffer(docx) as Promise<Buffer>
}

function blockToParagraphs(block: Block): Paragraph[] {
  switch (block.type) {
    case 'h2':
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: block.text, bold: true })],
          spacing: { before: 320, after: 120 },
        }),
      ]
    case 'h3':
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: block.text, bold: true })],
          spacing: { before: 200, after: 80 },
        }),
      ]
    case 'p':
      return [
        new Paragraph({
          children: runsToDocxChildren(parseInline(block.md)),
          spacing: { after: 160 },
        }),
      ]
    case 'ul':
      return block.items.map(
        (item) =>
          new Paragraph({
            children: runsToDocxChildren(parseInline(item)),
            bullet: { level: 0 },
            spacing: { after: 80 },
          }),
      )
  }
}

function runsToDocxChildren(runs: Run[]): ParagraphChild[] {
  return runs.map((run): ParagraphChild => {
    if (run.type === 'text') return new TextRun({ text: run.text })
    if (run.type === 'bold') return new TextRun({ text: run.text, bold: true })
    // link
    return new ExternalHyperlink({
      link: absolutizeHref(run.href),
      children: [
        new TextRun({
          text: run.text,
          style: 'Hyperlink',
          color: '1155CC',
          underline: {},
        }),
      ],
    })
  })
}

/**
 * Word docs can't resolve "/privacy" — expand internal links to
 * absolute URLs so a downloaded .docx is portable.
 */
function absolutizeHref(href: string): string {
  if (href.startsWith('/')) return `https://creatoroutreach.net${href}`
  return href
}
