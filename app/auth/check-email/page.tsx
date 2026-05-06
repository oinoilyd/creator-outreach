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
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/10 dark:shadow-black/40 text-center">
        <div className="text-5xl mb-4">📬</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
        <p className="text-muted-foreground text-sm mb-6">
          We sent a confirmation link to{' '}
          {email ? <span className="text-foreground font-medium break-all">{email}</span> : 'your inbox'}.
          Click the link to finish setting up your account.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Didn&apos;t get it? Check your spam folder, or{' '}
          <Link href="/auth/signup" className="text-blue-400 hover:text-blue-300">try again</Link>.
        </p>
      </div>
    </AuthShell>
  )
}
