import type { MetadataRoute } from 'next'

/**
 * robots.txt — keep crawlers out of the app shell, auth flow, admin,
 * and API routes. Points at the sitemap so Google discovers public
 * pages without having to follow links.
 *
 *   - "/"" is allowed because middleware rewrites the marketing
 *     landing page to it; that's the page we want indexed.
 *   - The "/" prefix in `disallow` does not block "/" itself —
 *     Google interprets `Disallow: /admin` as "/admin/*". Confirmed
 *     by spot-checking the rendered /robots.txt at deploy time.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/auth'],
      },
    ],
    sitemap: 'https://creatoroutreach.net/sitemap.xml',
    host: 'https://creatoroutreach.net',
  }
}
