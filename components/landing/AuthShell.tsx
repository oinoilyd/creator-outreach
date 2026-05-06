'use client'

import Link from 'next/link'
import { ReactNode, createContext, useContext, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { Aurora } from './Aurora'

// Context lets the inner sign-in form trigger the dark→light reveal
// from outside the shell. The function returns a Promise that resolves
// when the View Transition animation has finished — callers can then
// navigate without a flash of the in-between state.
type AuthShellContextValue = {
  revealLight: (origin: { x: number; y: number } | null) => Promise<void>
}

const AuthShellContext = createContext<AuthShellContextValue>({
  revealLight: async () => {},
})

export function useAuthShell() {
  return useContext(AuthShellContext)
}

export function AuthShell({ children }: { children: ReactNode }) {
  const [isLight, setIsLight] = useState(false)

  const revealLight = useCallback<AuthShellContextValue['revealLight']>(async (origin) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (typeof document.startViewTransition !== 'function' || reduce) {
      setIsLight(true)
      return
    }

    const w = window.innerWidth
    const h = window.innerHeight
    const x = origin?.x ?? w / 2
    const y = origin?.y ?? h / 2
    const radius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y))

    document.documentElement.style.setProperty('--vt-x', `${x}px`)
    document.documentElement.style.setProperty('--vt-y', `${y}px`)
    document.documentElement.style.setProperty('--vt-radius', `${radius}px`)

    // flushSync is critical here — startViewTransition's callback must
    // mutate the DOM synchronously so the API can capture the "after"
    // snapshot. Without flushSync, React batches the setState until
    // after the callback resolves and the snapshot is taken too early.
    const transition = document.startViewTransition(() => {
      flushSync(() => setIsLight(true))
    })

    try {
      await transition.finished
    } catch {
      // Animation was skipped — state still updated, fine to continue.
    }
  }, [])

  return (
    <AuthShellContext.Provider value={{ revealLight }}>
      <main
        className={
          isLight
            ? 'relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden'
            : 'dark relative min-h-screen flex flex-col bg-gray-950 text-white overflow-hidden'
        }
      >
        {!isLight && <Aurora className="z-0" />}

        <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl w-full mx-auto">
          <Link href="/landing" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-bold text-white">C</div>
            <span className="font-semibold tracking-tight">Creator Outreach</span>
          </Link>
        </header>

        <div className="relative z-10 flex-1 flex items-center justify-center p-4">
          {children}
        </div>
      </main>
    </AuthShellContext.Provider>
  )
}
