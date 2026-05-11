import PDFDocument from 'pdfkit'
import type { Block, LegalDoc } from './types'
import { parseInline, type Run } from './parse-inline'

/**
 * Render a LegalDoc as a PDF using pdfkit. Returns a Buffer.
 *
 * pdfkit uses a streaming API — we wire up data/end listeners,
 * collect chunks, and resolve once the document is finalized.
 *
 * Note: pdfkit doesn't make truly-clickable links trivial (it
 * needs explicit annotate calls with measured rects). We style
 * links as underlined blue so users can read the URL and copy
 * it; if real click-throughs become a requirement, switch the
 * `runLink` helper to use `doc.link(x,y,w,h,href)` after measuring
 * each fragment.
 */
export async function renderPdf(doc: LegalDoc): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      info: { Title: doc.title },
    })

    const chunks: Buffer[] = []
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    pdf.on('error', reject)

    // Title
    pdf
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor('#000')
      .text(doc.title, { paragraphGap: 4 })

    // Last updated
    pdf
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#666')
      .text(`Last updated: ${doc.lastUpdated}`, { paragraphGap: 20 })

    if (doc.intro) {
      writeParagraph(pdf, doc.intro, { fontSize: 11 })
    }

    for (const block of doc.blocks) {
      writeBlock(pdf, block)
    }

    pdf.end()
  })
}

type PDFKitDoc = PDFKit.PDFDocument

function writeBlock(pdf: PDFKitDoc, block: Block): void {
  switch (block.type) {
    case 'h2':
      pdf
        .moveDown(0.6)
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#000')
        .text(block.text, { paragraphGap: 6 })
      return
    case 'h3':
      pdf
        .moveDown(0.3)
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#000')
        .text(block.text, { paragraphGap: 4 })
      return
    case 'p':
      writeParagraph(pdf, block.md, { fontSize: 11 })
      return
    case 'ul':
      for (const item of block.items) {
        writeBulletItem(pdf, item)
      }
      pdf.moveDown(0.3)
      return
  }
}

function writeParagraph(
  pdf: PDFKitDoc,
  md: string,
  opts: { fontSize: number; indent?: number; bulletPrefix?: string },
): void {
  const runs = parseInline(md)
  const indent = opts.indent ?? 0

  // Continuous text mode — pdfkit treats successive .text(..., { continued: true })
  // calls as one paragraph and handles wrapping automatically.
  // Prefix the bullet on the first call if provided.
  const total = runs.length

  // Slight breathing room above each paragraph/bullet.
  pdf.moveDown(0.25)

  if (opts.bulletPrefix) {
    pdf
      .font('Helvetica')
      .fontSize(opts.fontSize)
      .fillColor('#000')
      .text(opts.bulletPrefix, {
        continued: true,
        indent,
      })
  }

  for (let i = 0; i < total; i++) {
    const run = runs[i]
    const isLast = i === total - 1
    applyRunStyle(pdf, run, opts.fontSize)
    const textOptions: PDFKit.Mixins.TextOptions = {
      continued: !isLast,
    }
    if (!opts.bulletPrefix && i === 0) {
      textOptions.indent = indent
    }
    if (run.type === 'link') {
      textOptions.underline = true
    }
    pdf.text(runText(run), textOptions)
  }

  // If there were zero runs (edge case: empty md), still consume
  // a line so layout doesn't collapse.
  if (total === 0) {
    pdf.font('Helvetica').fontSize(opts.fontSize).fillColor('#000').text('')
  }
}

function writeBulletItem(pdf: PDFKitDoc, md: string): void {
  writeParagraph(pdf, md, { fontSize: 11, indent: 18, bulletPrefix: '• ' })
}

function applyRunStyle(pdf: PDFKitDoc, run: Run, baseSize: number): void {
  pdf.fontSize(baseSize)
  if (run.type === 'bold') {
    pdf.font('Helvetica-Bold').fillColor('#000')
  } else if (run.type === 'link') {
    pdf.font('Helvetica').fillColor('#1155CC')
  } else {
    pdf.font('Helvetica').fillColor('#000')
  }
}

function runText(run: Run): string {
  return run.text
}
