'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

// next-themes wrapper: sets `dark` or `light` class on <html>, persists to
// localStorage, supports system preference. Default = dark to match the
// existing app feel.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
