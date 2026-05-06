'use client'

import { motion } from 'motion/react'
import { ReactNode } from 'react'

export function BentoGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {children}
    </div>
  )
}

export function BentoCard({
  title,
  description,
  icon,
  className = '',
  visual,
  delay = 0,
}: {
  title: string
  description: string
  icon: ReactNode
  className?: string
  visual?: ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className={`group relative overflow-hidden rounded-2xl bg-gray-900/40 border border-gray-800 hover:border-gray-700 transition-colors p-6 flex flex-col ${className}`}
    >
      {/* Subtle hover gradient */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />

      {visual && <div className="relative -mx-6 -mt-6 mb-5">{visual}</div>}

      <div className="relative">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/5 flex items-center justify-center mb-4 text-purple-300">
          {icon}
        </div>
        <h3 className="text-base font-semibold text-white mb-1.5 tracking-tight">{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}
