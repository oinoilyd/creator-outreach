/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { Block, LegalDoc } from './types'
import { parseInline, type Run } from './parse-inline'

/**
 * Render the comprehensive P&P manual as a single PDF — cover
 * page + table of contents + every LegalDoc in `LEGAL_DOCS`,
 * each starting on its own page.
 *
 * Built fresh per request, so any new P&P added to the registry
 * automatically lands in the next download — zero manual step.
 *
 * Mirrors `render-pdf.ts` (per-doc renderer) by design; kept
 * separate so the per-doc download path stays untouched.
 */
export async function renderComprehensivePdf(docs: LegalDoc[]): Promise<Buffer> {
  const element = buildComprehensiveDocument(docs) as any
  return renderToBuffer(element) as Promise<Buffer>
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 72,
    paddingBottom: 72,
    paddingLeft: 72,
    paddingRight: 72,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#000000',
    lineHeight: 1.45,
  },
  coverPage: {
    paddingTop: 72,
    paddingBottom: 72,
    paddingLeft: 72,
    paddingRight: 72,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#000000',
    lineHeight: 1.45,
    justifyContent: 'center',
  },
  coverTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 36,
    color: '#111111',
    textAlign: 'center',
    marginBottom: 6,
  },
  coverSubtitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 22,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 24,
  },
  coverMeta: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 11,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 4,
  },
  coverFootnote: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 10,
    color: '#888888',
    textAlign: 'center',
    marginTop: 36,
    paddingHorizontal: 36,
  },
  tocTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 22,
    color: '#000000',
    marginBottom: 18,
  },
  tocRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  tocNum: {
    width: 28,
    fontSize: 11,
    color: '#666666',
  },
  tocBody: {
    flex: 1,
    fontSize: 11,
  },
  tocMain: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  tocFlag: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 9,
    color: '#888888',
  },
  sectionMarker: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 9,
    color: '#888888',
    marginBottom: 4,
  },
  // Header table (mirrors per-doc renderer)
  headerTable: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'solid',
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  headerRowLast: {
    flexDirection: 'row',
  },
  headerLabelCell: {
    width: '35%',
    backgroundColor: '#F3F4F6',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    borderRightStyle: 'solid',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  headerValueCell: {
    width: '65%',
    padding: 6,
    backgroundColor: '#FFFFFF',
    fontSize: 10,
  },
  title: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 24,
    color: '#000000',
    marginBottom: 4,
  },
  lastUpdated: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#666666',
    marginBottom: 20,
  },
  intro: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#000000',
    marginBottom: 10,
  },
  h2: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: '#000000',
    marginTop: 14,
    marginBottom: 6,
  },
  h3: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: '#000000',
    marginTop: 10,
    marginBottom: 4,
  },
  p: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#000000',
    marginBottom: 8,
  },
  ulWrap: {
    marginBottom: 8,
  },
  li: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 6,
  },
  bullet: {
    width: 12,
    fontSize: 11,
  },
  liText: {
    flex: 1,
    fontSize: 11,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  link: {
    color: '#1155CC',
    textDecoration: 'underline',
  },
})

function buildComprehensiveDocument(docs: LegalDoc[]): React.ReactElement {
  const today = new Date().toISOString().slice(0, 10)
  return React.createElement(
    Document as any,
    { title: 'Creator Outreach — Policies & Procedures Manual' },
    buildCoverPage(docs, today),
    buildTableOfContentsPage(docs),
    ...docs.map((doc, idx) => buildDocPage(doc, idx, docs.length)),
  )
}

function buildCoverPage(
  docs: LegalDoc[],
  today: string,
): React.ReactElement {
  const publicCount = docs.filter((d) => d.isPublic).length
  const internalCount = docs.length - publicCount
  return React.createElement(
    Page as any,
    { size: 'A4', style: styles.coverPage },
    React.createElement(View, null,
      React.createElement(Text, { style: styles.coverTitle }, 'Creator Outreach'),
      React.createElement(Text, { style: styles.coverSubtitle }, 'Policies & Procedures Manual'),
      React.createElement(Text, { style: styles.coverMeta }, `Compiled ${today}`),
      React.createElement(
        Text,
        { style: styles.coverMeta },
        `${docs.length} document${docs.length === 1 ? '' : 's'} · ${publicCount} public · ${internalCount} internal`,
      ),
      React.createElement(
        Text,
        { style: styles.coverFootnote },
        'This manual is auto-generated from the structured P&P registry. The list of included documents updates automatically whenever a new P&P is added to the system.',
      ),
    ),
  )
}

function buildTableOfContentsPage(docs: LegalDoc[]): React.ReactElement {
  return React.createElement(
    Page as any,
    { size: 'A4', style: styles.page },
    React.createElement(Text, { style: styles.tocTitle }, 'Table of Contents'),
    ...docs.map((doc, idx) =>
      React.createElement(
        View,
        { key: doc.slug, style: styles.tocRow },
        React.createElement(
          Text,
          { style: styles.tocNum },
          `${String(idx + 1).padStart(2, '0')}.`,
        ),
        React.createElement(
          View,
          { style: styles.tocBody },
          React.createElement(
            Text,
            { style: styles.tocMain },
            `${doc.docNumber} — ${doc.title}`,
          ),
          React.createElement(
            Text,
            { style: styles.tocFlag },
            `${doc.docType} · ${doc.isPublic ? 'public' : 'internal'}`,
          ),
        ),
      ),
    ),
  )
}

function buildDocPage(
  doc: LegalDoc,
  idx: number,
  total: number,
): React.ReactElement {
  return React.createElement(
    Page as any,
    { key: doc.slug, size: 'A4', style: styles.page },
    React.createElement(
      Text,
      { style: styles.sectionMarker },
      `Section ${idx + 1} of ${total}`,
    ),
    buildHeaderTable(doc),
    React.createElement(Text, { style: styles.title }, doc.title),
    React.createElement(
      Text,
      { style: styles.lastUpdated },
      `Last updated: ${doc.lastUpdated}`,
    ),
    doc.intro
      ? React.createElement(
          Text,
          { style: styles.intro },
          ...renderRuns(parseInline(doc.intro)),
        )
      : null,
    ...doc.blocks.map((block, i) => renderBlock(block, i)),
  )
}

interface HeaderRowSpec {
  label: string
  value: string
}

function buildHeaderTable(doc: LegalDoc): React.ReactElement {
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
  return React.createElement(
    View,
    { style: styles.headerTable },
    ...rows.map((row, i) =>
      React.createElement(
        View,
        {
          key: row.label,
          style: i === rows.length - 1 ? styles.headerRowLast : styles.headerRow,
        },
        React.createElement(Text, { style: styles.headerLabelCell }, row.label),
        React.createElement(Text, { style: styles.headerValueCell }, row.value),
      ),
    ),
  )
}

function renderBlock(block: Block, idx: number): React.ReactElement {
  switch (block.type) {
    case 'h2':
      return React.createElement(Text, { key: idx, style: styles.h2 }, block.text)
    case 'h3':
      return React.createElement(Text, { key: idx, style: styles.h3 }, block.text)
    case 'p':
      return React.createElement(
        Text,
        { key: idx, style: styles.p },
        ...renderRuns(parseInline(block.md)),
      )
    case 'ul':
      return React.createElement(
        View,
        { key: idx, style: styles.ulWrap },
        ...block.items.map((item, j) =>
          React.createElement(
            View,
            { key: j, style: styles.li },
            React.createElement(Text, { style: styles.bullet }, '• '),
            React.createElement(
              Text,
              { style: styles.liText },
              ...renderRuns(parseInline(item)),
            ),
          ),
        ),
      )
  }
}

function renderRuns(runs: Run[]): React.ReactNode[] {
  return runs.map((run, i) => renderRun(run, i))
}

function renderRun(run: Run, key: number): React.ReactNode {
  if (run.type === 'text') {
    return React.createElement(Text, { key }, run.text)
  }
  if (run.type === 'bold') {
    return React.createElement(Text, { key, style: styles.bold }, run.text)
  }
  return React.createElement(
    Link as any,
    { key, src: absolutizeHref(run.href), style: styles.link },
    run.text,
  )
}

function absolutizeHref(href: string): string {
  if (href.startsWith('/')) return `https://creatoroutreach.net${href}`
  return href
}
