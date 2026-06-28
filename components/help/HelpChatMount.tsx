'use client'

/**
 * Route-aware mount for the HelpChat widget. One place to decide which
 * persona (if any) shows on the current route, instead of threading the
 * widget through app/page.tsx + every marketing page.
 *
 *   /landing, /pricing  → public SALES bot (dormant unless Turnstile keys set)
 *   /                    → in-app HELP bot (this route is auth-gated by
 *                          middleware, so anyone here is a logged-in user)
 *   everything else      → nothing (auth pages, legal, /admin, etc.)
 */
import { usePathname } from 'next/navigation'
import { HelpChat } from './HelpChat'

export function HelpChatMount() {
  const path = usePathname() || ''
  if (path === '/landing' || path === '/pricing') return <HelpChat mode="sales" />
  if (path === '/') return <HelpChat mode="help" />
  return null
}
