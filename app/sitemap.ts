import type { MetadataRoute } from 'next'

/**
 * Sitemap — submitted to Google via robots.txt + Search Console.
 * Only public marketing pages belong here; the app shell (/), admin
 * routes, and auth pages are excluded via app/robots.ts and per-page
 * `metadata.robots = { index: false }`.
 *
 * lastModified is set to the deploy time on each build so Google sees
 * a fresh sitemap whenever we ship.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://creatoroutreach.net'
  const now = new Date()
  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/roadmap`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ]
}
