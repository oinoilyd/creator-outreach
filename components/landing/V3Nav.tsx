'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * V3 navigation bar — corporate-CRM site multi-page nav.
 *
 * Reference: pipedrive.com top nav. Logo left, primary nav links
 * center (Home / Product / Pricing / Customers / Contact), dual
 * CTA on right (Sign in + Try free / Get demo). Active page
 * highlighted with subtle bottom border (lime-green).
 */

const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'Home',     href: '/landing/v3' },
  { label: 'Product',  href: '/landing/v3/product' },
  { label: 'Pricing',  href: '/landing/v3/pricing' },
  { label: 'Customers',href: '/landing/v3/about#customers' },
  { label: 'About',    href: '/landing/v3/about' },
]

function isActive(pathname: string, href: string): boolean {
  // Strip hash for matching
  const path = href.split('#')[0]
  if (path === '/landing/v3') return pathname === '/landing/v3' || pathname === '/landing/v3/'
  return pathname.startsWith(path)
}

export function V3Nav({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname() ?? ''

  return (
    <header className="sticky top-[40px] z-40 bg-white/95 backdrop-blur-md border-b border-[#162032]/10">
      <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
        <Link href="/landing/v3" className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#1FBC9C] text-[#162032] text-[14px] font-bold">C</span>
          <span className="font-bold tracking-[-0.01em] text-[16px] text-[#162032]">Creator Outreach</span>
        </Link>

        <nav className="hidden md:flex items-center h-full">
          {NAV_LINKS.map(link => {
            const active = isActive(pathname, link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  'h-full inline-flex items-center px-4 text-[14px] font-semibold transition-colors border-b-2 ' +
                  (active
                    ? 'text-[#162032] border-[#1FBC9C]'
                    : 'text-[#162032]/65 hover:text-[#162032] border-transparent')
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
              className="hidden sm:inline-flex text-[14px] text-[#162032]/70 hover:text-[#162032] px-3 py-2 font-semibold transition-colors"
            >
              Sign in
            </Link>
          )}
          <a
            href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
            className="hidden lg:inline-flex items-center bg-white text-[#162032] hover:bg-[#162032] hover:text-white border border-[#162032]/15 hover:border-[#162032] px-4 py-2 rounded-md text-[14px] font-semibold transition-colors"
          >
            Get a demo
          </a>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="inline-flex items-center bg-[#1FBC9C] text-[#162032] hover:bg-[#19A688] px-4 py-2 rounded-md text-[14px] font-bold transition-colors"
          >
            {isAuthed ? 'Open app' : 'Try it free'}
          </Link>
        </div>
      </div>

      {/* Mobile sub-row */}
      <nav className="md:hidden border-t border-[#162032]/8 bg-[#F7FAFC] flex items-center gap-1 overflow-x-auto px-2 py-2 scrollbar-none">
        {NAV_LINKS.map(link => {
          const active = isActive(pathname, link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                'shrink-0 px-3 py-1.5 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors ' +
                (active
                  ? 'bg-[#1FBC9C]/15 text-[#0E6E55]'
                  : 'text-[#162032]/70 hover:text-[#162032]')
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
