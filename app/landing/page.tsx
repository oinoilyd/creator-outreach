import { redirect } from 'next/navigation'

/**
 * /landing → /landing/v1.
 *
 * The redesign branch ships five visual concepts (V1 – V5) on the
 * same preview deployment, with a sticky version switcher at the
 * top of each variant. /landing is the entry point — defaults to
 * the first variant.
 */
export default function LandingIndex() {
  redirect('/landing/v1')
}
