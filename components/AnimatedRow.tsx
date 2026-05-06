'use client'

import { motion } from 'motion/react'
import { ReactNode, ComponentProps } from 'react'

// Drop-in replacement for <tr> that fades up on first mount with a small
// staggered delay (idx * 0.03s capped at 1s). Use for table rows so the
// list appears alive on initial load without overwhelming the user.
export function AnimatedRow({
  index = 0,
  children,
  ...rest
}: { index?: number; children: ReactNode } & ComponentProps<typeof motion.tr>) {
  const delay = Math.min(index * 0.025, 1)
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      {...rest}
    >
      {children}
    </motion.tr>
  )
}
