'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

/**
 * Sun/moon theme swap. Mounted-state guard avoids the SSR/CSR text
 * mismatch warning from next-themes.
 *
 * Uses theme tokens (border-border, text-muted-foreground, etc.) so
 * the button itself looks intentional in both modes — earlier version
 * was hardcoded to dark-mode colors and disappeared in light.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className={`w-9 h-9 ${className}`} />
  }

  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`w-9 h-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground border border-border hover:border-border/80 hover:bg-muted/40 transition-colors ${className}`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
