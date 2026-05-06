'use client'

import { motion, stagger, useAnimate } from 'motion/react'
import { useEffect } from 'react'

// Word-by-word fade-in for the hero headline.
export function TextGenerateEffect({ words, className = '' }: { words: string; className?: string }) {
  const [scope, animate] = useAnimate()
  const wordsArr = words.split(' ')

  useEffect(() => {
    animate('span', { opacity: 1, filter: 'blur(0px)', y: 0 }, { duration: 0.7, delay: stagger(0.12) })
  }, [animate])

  return (
    <h1 ref={scope} className={className}>
      {wordsArr.map((word, idx) => (
        <motion.span
          key={`${word}-${idx}`}
          className="inline-block opacity-0 mr-[0.25em]"
          initial={{ opacity: 0, filter: 'blur(8px)', y: 8 }}
        >
          {word}
        </motion.span>
      ))}
    </h1>
  )
}
