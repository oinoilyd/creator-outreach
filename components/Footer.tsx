import Link from 'next/link'

/**
 * Minimal footer with legal links — surfaces on every authenticated
 * page so users can always reach Terms / Privacy / Refund / Cookie
 * Policy. The landing page has its own richer footer; this one is
 * for everything else.
 *
 * Designed to sit unobtrusively at the bottom of any layout. Use
 * `min-h-full flex flex-col` on the parent so the footer sticks
 * below the content even on short pages.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="w-full px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground/80">Creator Outreach</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/refunds" className="hover:text-foreground transition-colors">
            Refunds
          </Link>
          <Link href="/security" className="hover:text-foreground transition-colors">
            Security
          </Link>
          <Link href="/subprocessors" className="hover:text-foreground transition-colors">
            Subprocessors
          </Link>
          <Link href="/support" className="hover:text-foreground transition-colors">
            Support
          </Link>
          <Link href="/cookies" className="hover:text-foreground transition-colors">
            Cookies
          </Link>
          <a
            href="mailto:dmeehanj@gmail.com"
            className="hover:text-foreground transition-colors"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  )
}
