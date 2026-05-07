'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * V3 navigation bar — multi-page version. Sits below the
 * VersionSwitcher and routes between /landing/v3, /landing/v3/product,
 * /landing/v3/pricing, /landing/v3/about. Highlights the active page.
 *
 * Visual feel matches the production LandingNav (gradient logo, same
 * type, same CTA pill). What's new: a row of nav links in the middle
 * for actual page-to-page navigation, instead of a hamburger that
 * scrolls to anchors.
 */

const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'Home',     href: '/landing/v3' },
  { label: 'Product',  href: '/landing/v3/product' },
  { label: 'Pricing',  href: '/landing/v3/pricing' },
  { label: 'About',    href: '/landing/v3/about' },
]

function isActive(pathname: string, href: string): boolean {
  // Exact match for home; prefix-match for sub-pages.
  if (href === '/landing/v3') return pathname === '/landing/v3' || pathname === '/landing/v3/'
  return pathname.startsWith(href)
}

export function V3Nav({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname() ?? ''

  return (
    <header className="relative z-30 px-6 py-5">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-6">
        <Link href="/landing/v3" className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 text-white text-sm font-bold">C</span>
          <span className="font-semibold tracking-tight">Creator Outreach</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(link => {
            const active = isActive(pathname, link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  'px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ' +
                  (active
                    ? 'text-foreground bg-muted/70 dark:bg-white/[0.06]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-white/[0.04]')
                }
                aria-current={active ? 'page' : undefined}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {!isAuthed && (
            <Link
              href="/auth/signin"
              className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors"
            >
              Sign in
            </Link>
          )}
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="text-sm bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] px-4 py-2 rounded-lg font-medium transition-[opacity,transform] duration-150"
          >
            {isAuthed ? 'Open app' : 'Get started'}
          </Link>
        </div>
      </div>

      {/* Mobile nav row — visible below md, links wrap if needed. */}
      <nav className="md:hidden mt-4 flex items-center gap-1 overflow-x-auto -mx-2 px-2 scrollbar-none">
        {NAV_LINKS.map(link => {
          const active = isActive(pathname, link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                'px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors shrink-0 ' +
                (active
                  ? 'text-foreground bg-muted/70 dark:bg-white/[0.06]'
                  : 'text-muted-foreground hover:text-foreground')
              }
              aria-current={active ? 'page' : undefined}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
