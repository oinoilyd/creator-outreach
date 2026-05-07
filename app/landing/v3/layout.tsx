import Link from 'next/link'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { V3Nav } from '@/components/landing/V3Nav'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 — PIPEDRIVE MULTI-PAGE CRM SHELL
 *
 * Per Dylan: "professional CRM/Lead identifying website" feel +
 * multi-page structure rather than one continuous scroll.
 *
 * Reference shape: pipedrive.com — clean B2B sales-CRM marketing
 * site with multiple proper pages (Home / Product / Pricing /
 * Customers). White substrate, slate-navy text, single lime-green
 * accent (#1FBC9C — Pipedrive's signature). Big sitemap footer.
 *
 * Same content as V2 but split across pages for navigation. The
 * Aurora lava-lamp from the prior V3 is GONE — that was webapp-y.
 * Clean white substrate now matches the corporate-CRM feel.
 *
 * Pages:
 *   /landing/v3              → Home (hero + persona tiles + CTA)
 *   /landing/v3/product      → Product modules + features deep-dive
 *   /landing/v3/pricing      → Pricing tiers + FAQ
 *   /landing/v3/about        → About + Customers + Contact
 */

export default async function V3Layout({ children }: { children: React.ReactNode }) {
  const { isAuthed } = await getLandingAuthState()
  return (
    <main className="min-h-screen flex flex-col font-[family-name:var(--font-geist-sans)]" style={{ backgroundColor: '#FFFFFF', color: '#162032' }}>
      <VersionSwitcher />

      <V3Nav isAuthed={isAuthed} />

      <div className="flex-1">
        {children}
      </div>

      {/* Big sitemap footer — shared across all V3 pages */}
      <footer className="bg-[#162032] text-white px-6 py-14 mt-auto">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-6 gap-8">
          <div className="md:col-span-2">
            <Link href="/landing/v3" className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#1FBC9C] text-[#162032] text-[14px] font-bold">C</span>
              <span className="font-bold tracking-tight text-[16px]">Creator Outreach</span>
            </Link>
            <p className="text-[13px] text-white/60 leading-[1.55] max-w-[36ch]">
              Modern creator-prospecting CRM. Source, score, pitch, and track creator partnerships across five platforms.
            </p>
            <div className="mt-6 text-[12px] text-white/50">
              © 2026 Creator Outreach
            </div>
          </div>
          <FooterCol heading="Product" links={[
            ['Overview',     '/landing/v3/product'],
            ['Sourcing',     '/landing/v3/product#sourcing'],
            ['Outreach',     '/landing/v3/product#outreach'],
            ['Analytics',    '/landing/v3/product#analytics'],
          ]} />
          <FooterCol heading="Pricing" links={[
            ['Plans',        '/landing/v3/pricing'],
            ['FAQ',          '/landing/v3/pricing#faq'],
            ['Compare',      '/landing/v3/pricing'],
          ]} />
          <FooterCol heading="Company" links={[
            ['About',        '/landing/v3/about'],
            ['Customers',    '/landing/v3/about#customers'],
            ['Contact',      '/landing/v3/about#contact'],
          ]} />
          <FooterCol heading="Legal" links={[
            ['Privacy',      '/privacy'],
            ['Terms',        '/terms'],
          ]} />
        </div>
      </footer>
    </main>
  )
}

function FooterCol({ heading, links }: { heading: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-4 font-semibold">{heading}</div>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-[13px] text-white/75 hover:text-[#1FBC9C] transition-colors">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
