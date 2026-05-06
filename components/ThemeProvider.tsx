'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

// next-themes wrapper: sets `dark` or `light` class on <html>, persists to
// localStorage. The app interior defaults to LIGHT — the marketing/auth
// pages force dark via a wrapper className regardless of this setting,
// so the landing→app moment is a dark→light reveal.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
