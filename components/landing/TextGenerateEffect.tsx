'use client'

import { motion } from 'motion/react'

/**
 * Word-by-word fade-in for the hero headline. Each word animates
 * blur+y+opacity independently, but the GRADIENT is applied to each
 * span individually (not the parent) — so `bg-clip-text` works
 * correctly. Previously the gradient was on the parent <h1> and the
 * children inherited `text-transparent` without `bg-clip-text`,
 * rendering them invisible.
 *
 * If `accentWord` is provided (e.g. "spreadsheets"), that word renders
 * solid in the brand color instead of the foreground gradient — gives
 * the headline a punch word.
 */
export function TextGenerateEffect({
  words,
  className = '',
  accentWord,
}: {
  words: string
  className?: string
  accentWord?: string
}) {
  const wordsArr = words.split(' ')

  return (
    <h1 className={className}>
      {wordsArr.map((word, idx) => {
        // Strip trailing punctuation when matching the accent word so
        // "spreadsheets." still matches accentWord="spreadsheets".
        const bareWord = word.replace(/[.,!?;:]$/, '')
        const isAccent = accentWord && bareWord.toLowerCase() === accentWord.toLowerCase()

        return (
          <motion.span
            key={`${word}-${idx}`}
            initial={{ opacity: 0, filter: 'blur(8px)', y: 10 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 + idx * 0.08, ease: 'easeOut' }}
            className={
              'inline-block mr-[0.25em] ' +
              (isAccent
                ? 'bg-gradient-to-br from-brand to-brand-2 bg-clip-text text-transparent'
                : 'bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent')
            }
          >
            {word}
          </motion.span>
        )
      })}
    </h1>
  )
}
