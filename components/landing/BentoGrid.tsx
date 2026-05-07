'use client'

import { motion } from 'motion/react'
import { ReactNode } from 'react'

/**
 * Bento layout for the "Everything you need" feature grid. Cards are
 * intentionally tall enough to fit a meaningful chunk of a real
 * product screenshot — Dylan's feedback was that stylized SVG mocks
 * felt inaccurate, so each visual now points at a specific REGION of
 * a real screenshot in /public/screenshots/. Crops are tuned with
 * background-size + background-position so the most-relevant feature
 * of each page lands center-card.
 */
export function BentoGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 ${className}`}>
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
      whileHover={{ y: -4, boxShadow: '0 24px 48px -16px rgba(120, 80, 200, 0.22)' }}
      className={`group relative overflow-hidden rounded-2xl bg-white border border-gray-200 hover:border-purple-300 transition-colors flex flex-col shadow-sm shadow-gray-900/5 ${className}`}
    >
      {/* Soft hover wash */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />

      {visual && <div className="relative px-5 pt-5 pb-3">{visual}</div>}

      <div className="relative px-5 pb-5 pt-3 flex-1">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-7 h-7 rounded-md bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 tracking-tight">{title}</h3>
        </div>
        <p className="text-[13px] text-gray-600 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}

// ─────────────── visuals — real screenshot crops ───────────────

/**
 * Reusable crop frame. Renders a region of a screenshot inside a
 * bordered, rounded container that mimics the look of a mini app
 * window. Use `bgSize` to scale the screenshot (e.g. '200%' zooms
 * 2x), `bgPos` to position which part is visible.
 */
function CropFrame({
  src,
  bgSize,
  bgPos,
  aspect = 'aspect-[5/3]',
  className = '',
}: {
  src: string
  bgSize: string
  bgPos: string
  aspect?: string
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`${aspect} rounded-xl border border-gray-200 overflow-hidden relative shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_24px_-12px_rgba(76,29,149,0.18)] ${className}`}
      style={{
        backgroundImage: `url(${src})`,
        backgroundSize: bgSize,
        backgroundPosition: bgPos,
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#0a0a0a', // matches dark app bg if image fails
      }}
    >
      {/* subtle inner highlight */}
      <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-xl pointer-events-none" />
    </motion.div>
  )
}

// 1 — Smart search · top of Results page (search bar + first 3 result rows)
export function SearchVisual() {
  return <CropFrame src="/screenshots/results.png" bgSize="cover" bgPos="center top" />
}

// 2 — AI fit scoring · zoom on the Fit Score column with the colored chips
export function ScoringVisual() {
  return (
    <CropFrame
      src="/screenshots/results.png"
      // zoom 1.7x and shift right+down to land on the Fit Score column
      bgSize="170%"
      bgPos="28% 60%"
    />
  )
}

// 3 — Built-in CRM · the Status pills column on the Outreach table
export function CrmVisual() {
  return (
    <CropFrame
      src="/screenshots/outreach.png"
      // zoom and shift right to land on Status column
      bgSize="180%"
      bgPos="78% 55%"
    />
  )
}

// 4 — Smart follow-up cadence · priority cards + first leads on Follow-ups
export function CadenceVisual() {
  return (
    <CropFrame
      src="/screenshots/followups.png"
      bgSize="cover"
      bgPos="center top"
    />
  )
}

// 5 — Analytics + custom metrics · the full analytics dashboard
export function AnalyticsVisual() {
  return (
    <CropFrame
      src="/screenshots/analytics.png"
      bgSize="cover"
      bgPos="center top"
      // wider card — keep ratio looser
      aspect="aspect-[16/7]"
    />
  )
}
