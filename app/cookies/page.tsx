import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'How Creator Outreach uses cookies and similar technologies.',
  robots: { index: true, follow: true },
}

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="May 11, 2026">
      <p>
        This Cookie Policy explains how Creator Outreach uses cookies and similar technologies
        on our website. Cookies are small text files that a website stores in your browser. They
        help us keep you signed in, remember your preferences, and understand how the Service is
        used.
      </p>
      <p>
        By using the Service, you consent to our use of essential cookies. You can manage other
        categories via the cookie banner that appears on your first visit, or by clearing your
        browser&rsquo;s storage.
      </p>

      <h2>Categories of cookies we use</h2>

      <h3>Strictly necessary (always on)</h3>
      <p>
        These cookies are required for the Service to function. Without them, you can&rsquo;t
        sign in, your session won&rsquo;t persist, and features like the bulk-job bar
        won&rsquo;t work. They cannot be disabled.
      </p>
      <ul>
        <li>Authentication tokens (Supabase) — keep you logged in.</li>
        <li>CSRF tokens — protect form submissions from cross-site attacks.</li>
        <li>Session state — short-lived identifiers for the current browsing session.</li>
      </ul>

      <h3>Functional (preferences)</h3>
      <p>
        These remember your settings between visits. Disabling them means you&rsquo;ll have to
        reconfigure on every visit.
      </p>
      <ul>
        <li>Theme (dark / light mode toggle).</li>
        <li>Active platform filter (YouTube, Instagram, etc.).</li>
        <li>Backdrop theme + visual settings (Rain / Drift / Fireworks / Tornado, fade duration).</li>
        <li>Hamburger menu collapsed/expanded state.</li>
      </ul>
      <p>
        These are stored in your browser&rsquo;s localStorage rather than as traditional cookies
        — they never leave your device.
      </p>

      <h3>Analytics (optional)</h3>
      <p>
        If enabled, these help us understand which features are used and where errors occur, so
        we can improve the Service. We currently do not run third-party analytics on the
        application; if we add them in the future, this policy will be updated and the cookie
        banner will give you the option to opt in.
      </p>

      <h3>Marketing</h3>
      <p>
        We do <strong>not</strong> use marketing or advertising cookies. We do not track you
        across other websites.
      </p>

      <h2>Third-party cookies</h2>
      <p>
        Some pages may load resources from third parties (for example, Stripe checkout iframes
        when you upgrade). Those third parties may set their own cookies governed by their own
        policies:
      </p>
      <ul>
        <li><a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener noreferrer">Stripe Cookie Policy</a></li>
        <li><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a></li>
        <li><a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel Privacy Policy</a></li>
      </ul>

      <h2>Managing cookies</h2>
      <p>You can manage cookies in several ways:</p>
      <ul>
        <li>Through the cookie banner shown on your first visit (Accept / Reject).</li>
        <li>Through your browser settings — every modern browser lets you block or delete cookies. See instructions for{' '}
          <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Chrome</a>,{' '}
          <a href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox" target="_blank" rel="noopener noreferrer">Firefox</a>,{' '}
          <a href="https://support.apple.com/en-us/HT201265" target="_blank" rel="noopener noreferrer">Safari</a>, or{' '}
          <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">Edge</a>.
        </li>
        <li>By clearing your browser&rsquo;s storage — note that this will sign you out and reset your preferences.</li>
      </ul>
      <p>
        Blocking strictly-necessary cookies will break sign-in and most app features.
      </p>

      <h2>Do Not Track</h2>
      <p>
        Some browsers send a &ldquo;Do Not Track&rdquo; (DNT) signal. There is no industry
        consensus on how to respond to DNT, so we currently do not change behavior based on
        it. We do not track you across other sites regardless.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this Cookie Policy as we add or remove technologies. Material changes
        will be communicated in-app and via email.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about cookies? Email{' '}
        <a href="mailto:dmeehanj@gmail.com">dmeehanj@gmail.com</a>.
      </p>
    </LegalLayout>
  )
}
