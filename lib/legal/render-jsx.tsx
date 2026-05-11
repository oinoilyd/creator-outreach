import Link from 'next/link'
import type React from 'react'
import type { Block, LegalDoc } from './types'
import { parseInline, type Run } from './parse-inline'

/**
 * Server-side JSX renderer for a LegalDoc.
 *
 * The parent provides typography (see components/legal/LegalLayout.tsx)
 * via descendant selectors — we just emit semantic <h2>, <h3>, <p>,
 * <ul>, <li> with parsed inline runs.
 */
export function renderJsx(doc: LegalDoc): React.ReactNode {
  return (
    <>
      {doc.intro && <p key="__intro">{renderInline(doc.intro, 'intro')}</p>}
      {doc.blocks.map((block, i) => renderBlock(block, i))}
    </>
  )
}

function renderBlock(block: Block, idx: number): React.ReactNode {
  switch (block.type) {
    case 'h2':
      return <h2 key={idx}>{block.text}</h2>
    case 'h3':
      return <h3 key={idx}>{block.text}</h3>
    case 'p':
      return <p key={idx}>{renderInline(block.md, `p-${idx}`)}</p>
    case 'ul':
      return (
        <ul key={idx}>
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item, `li-${idx}-${j}`)}</li>
          ))}
        </ul>
      )
  }
}

function renderInline(md: string, keyBase: string): React.ReactNode[] {
  const runs = parseInline(md)
  return runs.map((run, i) => renderRun(run, `${keyBase}-${i}`))
}

function renderRun(run: Run, key: string): React.ReactNode {
  if (run.type === 'text') return <span key={key}>{run.text}</span>
  if (run.type === 'bold') return <strong key={key}>{run.text}</strong>
  // run.type === 'link'
  const { href, text } = run
  if (href.startsWith('/')) {
    return (
      <Link key={key} href={href}>
        {text}
      </Link>
    )
  }
  if (href.startsWith('mailto:')) {
    return (
      <a key={key} href={href}>
        {text}
      </a>
    )
  }
  // http(s) — external
  return (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  )
}
