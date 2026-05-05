import Link from 'next/link'

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

  return (
    <div className="flex-1 min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl text-center">
        <div className="text-5xl mb-4">📬</div>
        <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
        <p className="text-gray-400 text-sm mb-6">
          We sent a confirmation link to{' '}
          {email ? <span className="text-white font-medium break-all">{email}</span> : 'your inbox'}.
          Click the link to finish setting up your account.
        </p>
        <p className="text-xs text-gray-600">
          Didn&apos;t get it? Check your spam folder, or{' '}
          <Link href="/auth/signup" className="text-blue-400 hover:text-blue-300">try again</Link>.
        </p>
      </div>
    </div>
  )
}
