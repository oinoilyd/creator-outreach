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
  type ParagraphChild,
  type ITableRowOptions,
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
  const children: (Paragraph | Table)[] = []

  // Standard P&P header table at the very top.
  children.push(buildHeaderTable(doc))
  // Spacer paragraph so the title doesn't butt up against the table.
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '' })],
      spacing: { after: 240 },
    }),
  )

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
