import Link from 'next/link'

export const metadata = {
  title: 'Creator Outreach — find creators worth pitching, fast',
  description: 'Search YouTube creators, score them by fit, and run your outreach pipeline in one place.',
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* nav */}
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-bold">C</div>
          <span className="font-semibold tracking-tight">Creator Outreach</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/signin" className="text-sm text-gray-300 hover:text-white">Sign in</Link>
          <Link href="/auth/signup" className="text-sm bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors">Get started</Link>
        </div>
      </header>

      {/* hero */}
      <section className="flex-1 flex items-center px-6 py-16">
        <div className="max-w-5xl w-full mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">
            Find creators worth pitching, fast.
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Search YouTube, score creators by fit to your offer, and run your whole outreach pipeline — all in one place.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/auth/signup" className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors">
              Get started — free
            </Link>
            <Link href="/auth/signin" className="px-6 py-3 rounded-lg font-medium text-gray-300 hover:text-white border border-gray-800 hover:border-gray-600 transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* features */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          <Feature
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            }
            title="Smart search"
            body="Find creators by keyword, audience size, region, and last-posted date — across YouTube."
          />
          <Feature
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            }
            title="AI-tuned scoring"
            body="Tell the tool what makes a good lead in plain English. It tunes the fit-score weights for you."
          />
          <Feature
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            }
            title="Built-in CRM"
            body="Track outreach status, response, follow-ups, and notes. Import your past list from Excel."
          />
        </div>
      </section>

      <footer className="px-6 py-6 border-t border-gray-900 text-center text-xs text-gray-600">
        © {new Date().getFullYear()} Creator Outreach. <a href="mailto:dmeehanj@gmail.com" className="hover:text-gray-400">Contact</a>
      </footer>
    </main>
  )
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          {icon}
        </svg>
      </div>
      <h3 className="font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
    </div>
  )
}
