import type { LegalDoc } from '../types'

const doc: LegalDoc = {
  slug: 'cookies',
  title: 'Cookie Policy',
  lastUpdated: 'May 11, 2026',
  summary: 'Which cookies and storage technologies Creator Outreach uses and how to manage them.',
  isPublic: true,
  intro:
    'This Cookie Policy explains how Creator Outreach uses cookies and similar technologies on our website. Cookies are small text files that a website stores in your browser. They help us keep you signed in, remember your preferences, and understand how the Service is used.\n\nBy using the Service, you consent to our use of essential cookies. You can manage other categories via the cookie banner that appears on your first visit, or by clearing your browser’s storage.',
  blocks: [
    { type: 'h2', text: 'Categories of cookies we use' },

    { type: 'h3', text: 'Strictly necessary (always on)' },
    {
      type: 'p',
      md: "These cookies are required for the Service to function. Without them, you can't sign in, your session won't persist, and features like the bulk-job bar won't work. They cannot be disabled.",
    },
    {
      type: 'ul',
      items: [
        'Authentication tokens (Supabase) — keep you logged in.',
        'CSRF tokens — protect form submissions from cross-site attacks.',
        'Session state — short-lived identifiers for the current browsing session.',
      ],
    },

    { type: 'h3', text: 'Functional (preferences)' },
    {
      type: 'p',
      md: "These remember your settings between visits. Disabling them means you'll have to reconfigure on every visit.",
    },
    {
      type: 'ul',
      items: [
        'Theme (dark / light mode toggle).',
        'Active platform filter (YouTube, Instagram, etc.).',
        'Backdrop theme + visual settings (Rain / Drift / Fireworks / Tornado, fade duration).',
        'Hamburger menu collapsed/expanded state.',
      ],
    },
    {
      type: 'p',
      md: "These are stored in your browser's localStorage rather than as traditional cookies — they never leave your device.",
    },

    { type: 'h3', text: 'Analytics (optional)' },
    {
      type: 'p',
      md: 'If enabled, these help us understand which features are used and where errors occur, so we can improve the Service. We currently do not run third-party analytics on the application; if we add them in the future, this policy will be updated and the cookie banner will give you the option to opt in.',
    },

    { type: 'h3', text: 'Marketing' },
    {
      type: 'p',
      md: 'We do **not** use marketing or advertising cookies. We do not track you across other websites.',
    },

    { type: 'h2', text: 'Third-party cookies' },
    {
      type: 'p',
      md: 'Some pages may load resources from third parties (for example, Stripe checkout iframes when you upgrade). Those third parties may set their own cookies governed by their own policies:',
    },
    {
      type: 'ul',
      items: [
        '[Stripe Cookie Policy](https://stripe.com/cookies-policy/legal)',
        '[Supabase Privacy Policy](https://supabase.com/privacy)',
        '[Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)',
      ],
    },

    { type: 'h2', text: 'Managing cookies' },
    { type: 'p', md: 'You can manage cookies in several ways:' },
    {
      type: 'ul',
      items: [
        'Through the cookie banner shown on your first visit (Accept / Reject).',
        'Through your browser settings — every modern browser lets you block or delete cookies. See instructions for [Chrome](https://support.google.com/chrome/answer/95647), [Firefox](https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox), [Safari](https://support.apple.com/en-us/HT201265), or [Edge](https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09).',
        "By clearing your browser's storage — note that this will sign you out and reset your preferences.",
      ],
    },
    {
      type: 'p',
      md: 'Blocking strictly-necessary cookies will break sign-in and most app features.',
    },

    { type: 'h2', text: 'Do Not Track' },
    {
      type: 'p',
      md: 'Some browsers send a "Do Not Track" (DNT) signal. There is no industry consensus on how to respond to DNT, so we currently do not change behavior based on it. We do not track you across other sites regardless.',
    },

    { type: 'h2', text: 'Changes to this policy' },
    {
      type: 'p',
      md: 'We may update this Cookie Policy as we add or remove technologies. Material changes will be communicated in-app and via email.',
    },

    { type: 'h2', text: 'Contact' },
    {
      type: 'p',
      md: 'Questions about cookies? Email [dmeehanj@gmail.com](mailto:dmeehanj@gmail.com).',
    },
  ],
}

export default doc
export { doc }
