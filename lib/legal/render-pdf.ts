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
 * Render a LegalDoc as a PDF using @react-pdf/renderer.
 *
 * Replaces the previous pdfkit implementation which produced blank
 * PDFs on Vercel because pdfkit needs runtime access to .afm font
 * files that aren't reliably bundled in serverless builds.
 *
 * @react-pdf/renderer ships fonts internally (Helvetica is the
 * default standard PDF font and needs no registration) and renders
 * via a declarative React tree.
 */
export async function renderPdf(doc: LegalDoc): Promise<Buffer> {
  // renderToBuffer wants a <Document> element directly, not a wrapping
  // functional component — so we build the tree inline here.
  // Casting through `any` is the documented escape hatch since the
  // react-pdf typings expect their own React tree shape.
  const element = buildPdfDocument(doc) as any
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
  // Header table (rendered as bordered flex rows)
  headerTable: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'solid',
    marginBottom: 24,
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

function buildPdfDocument(doc: LegalDoc): React.ReactElement {
  return React.createElement(
    Document as any,
    { title: doc.title },
    React.createElement(
      Page as any,
      { size: 'A4', style: styles.page },
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
    ),
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
  // link
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
