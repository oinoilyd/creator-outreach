import Link from 'next/link'
import { ContactForm } from '@/components/landing/ContactForm'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 / About — About + Contact + final CTA strip.
 */

export const metadata = {
  title: 'Creator Outreach — About + Contact',
  description: 'Built by one operator who got sick of running creator outreach in spreadsheets. Tell me what is missing.',
}

export default async function V3About() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <>
      {/* Page header */}
      <section className="relative px-6 pt-12 md:pt-16 pb-10 z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3">About</div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Built by someone who needed it.
          </h1>
        </div>
      </section>

      {/* About body */}
      <section className="relative px-6 pb-20 md:pb-28 z-10">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl bg-background/60 backdrop-blur-md p-6 md:p-8 border border-border/50 dark:border-white/10">
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Creator Outreach started as a tool I built for myself. I was running outreach to creators across YouTube, Instagram, and TikTok with a spreadsheet, three browser tabs, and a Notion page that was always out of date. The pricier tools cost more than my rent and still couldn&apos;t tell me what made a good lead — so I built this. It searches every major platform directly, scores creators against criteria you describe in plain English, and runs the whole pipeline — pitch, status, follow-up cadence, analytics — without copy-pasting between five tabs. It&apos;s still early, run by one person, and growing every week from feedback by the people using it. If you&apos;re using it and something&apos;s off, tell me — that&apos;s how it gets better.
            </p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative px-6 pb-20 md:pb-28 z-10 scroll-mt-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3 text-center">Contact</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-center">
            Get in touch.
          </h2>
          <p className="text-muted-foreground mb-8 text-center">
            Feedback, bugs, feature ideas, partnership questions — all land in the same inbox.
          </p>
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm dark:bg-white/5 dark:backdrop-blur-md dark:border-white/10 dark:shadow-none">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* CTA strip */}
      {!isAuthed && (
        <section className="relative px-6 pb-20 z-10">
          <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-gradient-to-br from-brand/10 via-card to-brand-2/10 p-8 md:p-10 text-center shadow-sm dark:bg-gradient-to-br dark:from-brand/10 dark:via-transparent dark:to-brand-2/10 dark:backdrop-blur-md dark:border-white/10 dark:shadow-none">
            <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
              Stop emailing the wrong creators.
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              Free to start. No card required.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block bg-primary text-primary-foreground hover:opacity-90 px-5 py-2.5 rounded-lg font-semibold text-sm transition-opacity"
            >
              Get started
            </Link>
          </div>
        </section>
      )}
    </>
  )
}
