import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
  PageBreak,
  type ParagraphChild,
  type ITableRowOptions,
} from 'docx'
import type { Block, LegalDoc } from './types'
import { parseInline, type Run } from './parse-inline'

/**
 * Render the *comprehensive* P&P manual — every LegalDoc in
 * `LEGAL_DOCS` concatenated into one Word doc, with a cover page +
 * auto-generated table of contents + page breaks between docs.
 *
 * Built fresh per request, so any new P&P added to the registry
 * automatically lands in the combined manual on next download —
 * zero manual update step.
 *
 * Renderer logic mirrors `render-docx.ts` (per-doc renderer)
 * intentionally — kept as a separate module so the per-doc
 * download path stays untouched. Shared helpers (block parsing,
 * link absolutizing) are duplicated here on purpose; if they
 * grow non-trivially, lift them into a shared file.
 */
export async function renderComprehensiveDocx(docs: LegalDoc[]): Promise<Buffer> {
  const children: (Paragraph | Table)[] = []

  // --- COVER PAGE -------------------------------------------------
  children.push(...buildCoverPage(docs))

  // --- TABLE OF CONTENTS -----------------------------------------
  children.push(pageBreakParagraph())
  children.push(...buildTableOfContents(docs))

  // --- BODY (one doc per "section", page-break-separated) ----------
  docs.forEach((doc, idx) => {
    children.push(pageBreakParagraph())
    children.push(buildHeaderTable(doc))
    children.push(spacer(240))
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Section ${idx + 1} of ${docs.length}`,
            italics: true,
            color: '888888',
            size: 18,
          }),
        ],
        spacing: { after: 80 },
      }),
    )
    children.push(
      new Paragraph({
        children: [new TextRun({ text: doc.title, bold: true, size: 48 })],
        spacing: { after: 120 },
      }),
    )
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Last updated: ${doc.lastUpdated}`,
            italics: true,
            color: '666666',
            size: 20,
          }),
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
  })

  const docx = new Document({
    sections: [{ properties: {}, children }],
  })

  return Packer.toBuffer(docx) as Promise<Buffer>
}

// --- Cover page ------------------------------------------------------

function buildCoverPage(docs: LegalDoc[]): Paragraph[] {
  const publicCount = docs.filter((d) => d.isPublic).length
  const internalCount = docs.length - publicCount
  const today = new Date().toISOString().slice(0, 10)

  return [
    // Vertical spacing to push title toward the middle of the page
    spacer(1200),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Creator Outreach',
          bold: true,
          size: 56,
          color: '111111',
        }),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Policies & Procedures Manual',
          bold: true,
          size: 36,
          color: '333333',
        }),
      ],
      spacing: { after: 360 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Compiled ${today}`,
          italics: true,
          size: 22,
          color: '666666',
        }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${docs.length} document${docs.length === 1 ? '' : 's'} · ${publicCount} public · ${internalCount} internal`,
          size: 22,
          color: '666666',
        }),
      ],
      spacing: { after: 720 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'This manual is auto-generated from the structured P&P registry. The list of included documents updates automatically whenever a new P&P is added to the system.',
          italics: true,
          size: 20,
          color: '888888',
        }),
      ],
    }),
  ]
}

// --- Table of contents ------------------------------------------------

function buildTableOfContents(docs: LegalDoc[]): Paragraph[] {
  const items: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: 'Table of Contents', bold: true, size: 36 })],
      spacing: { after: 240 },
    }),
  ]
  docs.forEach((doc, idx) => {
    items.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${String(idx + 1).padStart(2, '0')}.  `,
            size: 22,
            color: '666666',
          }),
          new TextRun({
            text: `${doc.docNumber} — ${doc.title}`,
            size: 22,
            bold: true,
          }),
          new TextRun({
            text: `   (${doc.docType}, ${doc.isPublic ? 'public' : 'internal'})`,
            size: 20,
            color: '888888',
            italics: true,
          }),
        ],
        spacing: { after: 100 },
      }),
    )
  })
  return items
}

// --- Section header table (re-used per doc) --------------------------

interface HeaderRowSpec {
  label: string
  value: string
}

function buildHeaderTable(doc: LegalDoc): Table {
  const rows: HeaderRowSpec[] = [
    { label: 'Document Title', value: doc.title },
    { label: 'Document Number', value: doc.docNumber },
    { label: 'Type', value: doc.docType },
    { label: 'Version', value: doc.version },
    { label: 'Effective Date', value: doc.effectiveDate },
    { label: 'Last Revised', value: doc.lastUpdated },
    { label: 'Owner', value: doc.owner },
    { label: 'Status', value: doc.status },
  ]

  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }

  const tableRows: ITableRowOptions[] = rows.map((row) => ({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F4F6' },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: row.label, bold: true, size: 20 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFFFFF' },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: row.value, size: 20 })],
          }),
        ],
      }),
    ],
  }))

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
      insideHorizontal: thinBorder,
      insideVertical: thinBorder,
    },
    rows: tableRows.map((opts) => new TableRow(opts)),
  })
}

// --- Block / inline helpers (mirror render-docx.ts) ------------------

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

function absolutizeHref(href: string): string {
  if (href.startsWith('/')) return `https://creatoroutreach.net${href}`
  return href
}

// --- Layout helpers --------------------------------------------------

/** Empty paragraph to add vertical breathing room. */
function spacer(afterTwips: number): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: '' })],
    spacing: { after: afterTwips },
  })
}

/** Force the next content onto a new page. */
function pageBreakParagraph(): Paragraph {
  return new Paragraph({
    children: [new PageBreak()],
  })
}
