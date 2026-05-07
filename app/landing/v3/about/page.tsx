import Link from 'next/link'
import { ContactForm } from '@/components/landing/ContactForm'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 / About — About + Customers + Contact, corporate B2B style.
 */

export const metadata = {
  title: 'Creator Outreach — About + Customers',
  description: 'Built by one operator who got sick of running creator outreach in spreadsheets. Customer outcomes and how to reach us.',
}

export default async function V3About() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <>
      {/* About hero */}
      <section className="px-6 pt-20 md:pt-28 pb-16">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#1FBC9C] mb-4 font-bold">About</div>
          <h1 className="font-bold tracking-[-0.025em]" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
            Built by an operator. <span className="text-[#1FBC9C]">For operators.</span>
          </h1>
        </div>
      </section>

      {/* Founder note */}
      <section className="px-6 pb-20">
        <div className="max-w-[820px] mx-auto rounded-2xl border border-[#162032]/10 bg-white p-8 md:p-10" style={{ boxShadow: '0 30px 60px -30px rgba(31,188,156,0.15)' }}>
          <p className="text-[17px] md:text-[18px] text-[#162032]/85 leading-[1.7]">
            Creator Outreach started as a tool I built for myself. I was running outreach to creators across YouTube, Instagram, and TikTok with a spreadsheet, three browser tabs, and a Notion page that was always out of date. The pricier tools cost more than my rent and still couldn&apos;t tell me what made a good lead — so I built this. It searches every major platform directly, scores creators against criteria you describe in plain English, and runs the whole pipeline — pitch, status, follow-up cadence, analytics — without copy-pasting between five tabs. It&apos;s still early, run by one person, and growing every week from feedback by the people using it. If you&apos;re using it and something&apos;s off, tell me — that&apos;s how it gets better.
          </p>
          <div className="mt-7 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1FBC9C] flex items-center justify-center text-[#162032] font-bold text-[14px]">D</div>
            <div>
              <div className="text-[14px] font-bold">Dylan Meehan</div>
              <div className="text-[12px] text-[#162032]/55">Founder & sole operator</div>
            </div>
          </div>
        </div>
      </section>

      {/* Customers */}
      <section id="customers" className="px-6 py-20 md:py-28 bg-[#F7FAFC] border-y border-[#162032]/10 scroll-mt-32">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-14">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#1FBC9C] mb-4 font-bold">Customers</div>
            <h2 className="font-bold tracking-[-0.025em] mx-auto max-w-[24ch]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Operators running their own outreach.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <CustomerCard
              metric="3 tabs + Notion replaced"
              quote="The spreadsheet was a graveyard. The CRM was a museum. This is the only thing I&apos;ve used that didn&apos;t make me wish I was using something else."
              persona="Indie operator"
              context="Solo GTM · fishing-conditions product"
            />
            <CustomerCard
              metric="$0 vs. $400/mo"
              quote="Two CRMs were too expensive for one person and didn&apos;t know what an Instagram handle was. This does."
              persona="Solo founder"
              context="Content-led GTM · DTC"
            />
            <CustomerCard
              metric="3× more follow-ups"
              quote="The auto-cadence alone is worth it. I stopped forgetting follow-ups that were sitting on day-7."
              persona="Growth lead"
              context="Pre-seed B2B · two-person team"
            />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="px-6 py-20 md:py-28 scroll-mt-32">
        <div className="max-w-[1100px] mx-auto grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#1FBC9C] mb-4 font-bold">Contact</div>
            <h2 className="font-bold tracking-[-0.025em] leading-[1.05] mb-5" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              Tell me what&apos;s missing.
            </h2>
            <p className="text-[16px] text-[#162032]/65 leading-[1.6] mb-7">
              Feedback, bugs, feature ideas, partnership questions — all land in the same inbox. I read every message.
            </p>
            <div className="space-y-3 text-[14px] text-[#162032]/75">
              <div className="flex items-center gap-2">
                <span className="text-[#1FBC9C] font-bold">●</span>
                <a href="mailto:dmeehanj@gmail.com" className="font-semibold hover:text-[#1FBC9C] transition-colors">dmeehanj@gmail.com</a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#1FBC9C] font-bold">●</span>
                <a href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo" className="font-semibold hover:text-[#1FBC9C] transition-colors">Schedule a demo</a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#1FBC9C] font-bold">●</span>
                <span>Typically reply within 24 hours</span>
              </div>
            </div>
          </div>
          <div className="md:col-span-7">
            <div className="rounded-2xl border border-[#162032]/10 bg-white p-7 md:p-8">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-[1100px] mx-auto rounded-3xl bg-[#162032] text-white px-8 py-14 md:py-16 text-center">
          <h2 className="font-bold tracking-[-0.025em] mb-5 mx-auto max-w-[24ch]" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
            Ready to stop running outreach in spreadsheets?
          </h2>
          <p className="max-w-[52ch] mx-auto text-[16px] text-white/70 leading-[1.55] mb-8">
            Free during beta. No card. Built by one operator.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-2 bg-[#1FBC9C] text-[#162032] hover:bg-white px-7 py-3.5 rounded-md font-bold text-[15px] transition-colors"
            >
              {isAuthed ? 'Open the app' : 'Try it free'} →
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function CustomerCard({ metric, quote, persona, context }: { metric: string; quote: string; persona: string; context: string }) {
  return (
    <figure className="rounded-xl border border-[#162032]/10 bg-white p-7 flex flex-col">
      <div className="inline-flex items-center self-start gap-1.5 px-3 py-1 rounded-full bg-[#1FBC9C]/15 text-[#0E6E55] text-[11px] uppercase tracking-[0.16em] font-bold mb-5">
        ↑ {metric}
      </div>
      <blockquote className="text-[15px] md:text-[16px] text-[#162032]/85 leading-[1.55] mb-6 flex-1" dangerouslySetInnerHTML={{ __html: quote }} />
      <div className="border-t border-[#162032]/10 pt-4">
        <div className="text-[14px] font-bold mb-1">{persona}</div>
        <div className="text-[12px] text-[#162032]/55">{context}</div>
      </div>
    </figure>
  )
}
