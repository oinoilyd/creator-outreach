import Link from 'next/link'
import { AuthShell } from '@/components/landing/AuthShell'

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

  return (
    <AuthShell>
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-xl shadow-purple-200/20 dark:bg-card/80 dark:backdrop-blur-md dark:border-white/10 dark:shadow-black/40">
        {/* Mail-icon SVG (replaces 📬 emoji per anti-emoji house rule) */}
        <div className="flex items-center justify-center mb-5">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/10 text-brand">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2 text-center">Check your email</h1>
        <p className="text-muted-foreground text-sm mb-5 text-center">
          We sent a sign-in link to{' '}
          {email
            ? <span className="text-foreground font-medium break-all">{email}</span>
            : 'your inbox'}.
        </p>

        {/* Spam-folder warning — make this VERY visible. The default
            Supabase mail sender (noreply@mail.supabase.io) has weak
            deliverability and Gmail / Outlook regularly land it in
            spam, sometimes with a "dangerous" warning. Surfacing
            this up front kills the dropoff. */}
        <div className="rounded-lg bg-amber-50 border border-amber-200/70 px-4 py-3 mb-4 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:border-amber-400/30 dark:text-amber-200">
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" />
              <path d="M10.36 3.5L2.13 17.85a2 2 0 0 0 1.74 3h16.26a2 2 0 0 0 1.74-3l-8.23-14.35a2 2 0 0 0-3.48 0z" />
              <path d="M12 17h.01" />
            </svg>
            Don&apos;t see the email?
          </div>
          <ul className="list-none space-y-0.5 text-[12.5px] leading-snug">
            <li>· Check your spam / junk folder</li>
            <li>· Wait ~30 seconds — it can lag</li>
            <li>· If it&apos;s flagged as &quot;dangerous,&quot; mark as not spam — it&apos;s safe</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground/80 text-center">
          Used a typo?{' '}
          <Link href="/auth/signup" className="text-brand hover:text-brand/80 transition-colors font-medium">Try again</Link>
          {' '}·{' '}
          <Link href="/auth/signin" className="text-brand hover:text-brand/80 transition-colors font-medium">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  )
}
