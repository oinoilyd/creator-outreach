import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Dynamically-generated Open Graph image (1200×630 PNG) served at
 * /opengraph-image. Auto-attached by Next.js as the page's
 * <meta property="og:image"> so URL shares (Slack / iMessage /
 * Twitter / LinkedIn / Discord / Notion / etc.) get a branded
 * preview card instead of the default browser-bot fallback.
 *
 * Design intent: mirror the actual landing page so the share preview
 * feels like creatoroutreach.net rather than a generic gradient
 * placeholder. Cream background, navy editorial typography, the
 * exact headline from the landing hero, and an inset of the real
 * product (the Results table screenshot) as the supporting visual.
 *
 * Build/cache: ImageResponse runs at request time. The screenshot
 * is read from disk on first request (cached in Vercel's edge
 * after that). To swap the visual, replace the screenshot path
 * below — re-deploy auto-invalidates the cache.
 */

export const alt =
  'Creator Outreach — the modern way to source and pitch creators.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Read a public file from disk and return a data URL string.
 *  ImageResponse accepts `<img src>` with data URLs cleanly; using
 *  a remote URL would require an extra fetch hop at request time. */
function publicAsDataUrl(relativePath: string, mime: string): string {
  const buf = readFileSync(join(process.cwd(), 'public', relativePath))
  return `data:${mime};base64,${buf.toString('base64')}`
}

export default async function Image() {
  let screenshotDataUrl: string | null = null
  try {
    screenshotDataUrl = publicAsDataUrl('screenshots/results.png', 'image/png')
  } catch {
    // If the screenshot file is missing for any reason (renamed,
    // pruned), the layout falls back to a clean text-only card.
    screenshotDataUrl = null
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          background: '#FCFAF6',
          color: '#0F1733',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* LEFT — copy column */}
        <div
          style={{
            width: 620,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px 56px',
          }}
        >
          {/* Logo block */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 11,
                background:
                  'linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: -1,
                color: 'white',
              }}
            >
              CO
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: -0.4,
                color: '#0F1733',
              }}
            >
              Creator Outreach
            </div>
          </div>

          {/* Headline + subhead — matches the actual landing hero */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                fontSize: 56,
                fontWeight: 600,
                letterSpacing: -2,
                lineHeight: 1.0,
                color: '#0F1733',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span>The modern way</span>
              <span>to source and pitch</span>
              <span style={{ color: '#5B3CC4' }}>creators.</span>
            </div>
            <div
              style={{
                marginTop: 24,
                fontSize: 19,
                fontWeight: 400,
                color: 'rgba(15, 23, 51, 0.62)',
                lineHeight: 1.4,
                maxWidth: 460,
              }}
            >
              Lead sourcing by occupation with an AI fit score. Email
              + social handles inline. Templated outreach + follow-up
              reminders.
            </div>
          </div>

          {/* Footer URL chip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 16,
              fontWeight: 600,
              color: 'rgba(15, 23, 51, 0.55)',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: '#10B981',
                display: 'flex',
              }}
            />
            creatoroutreach.net
            <span
              style={{
                marginLeft: 6,
                color: 'rgba(15, 23, 51, 0.40)',
              }}
            >
              ·
            </span>
            <span style={{ color: 'rgba(15, 23, 51, 0.55)' }}>
              free during beta
            </span>
          </div>
        </div>

        {/* RIGHT — product visual.
            Either a real screenshot of the Results table or, if the
            screenshot is missing, a clean dark panel with the brand
            colors so the card still feels intentional. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 48px 48px 0',
            position: 'relative',
          }}
        >
          {screenshotDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={screenshotDataUrl}
              alt=""
              width={520}
              height={420}
              style={{
                width: 520,
                height: 420,
                objectFit: 'cover',
                objectPosition: 'left top',
                borderRadius: 14,
                border: '1px solid rgba(15, 23, 51, 0.08)',
                boxShadow: '0 24px 60px rgba(15, 23, 51, 0.18)',
              }}
            />
          ) : (
            <div
              style={{
                width: 520,
                height: 420,
                borderRadius: 14,
                background:
                  'linear-gradient(135deg, #1a1530 0%, #0F1733 60%, #1a1530 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 28,
                fontWeight: 600,
                boxShadow: '0 24px 60px rgba(15, 23, 51, 0.20)',
              }}
            >
              creatoroutreach.net
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  )
}
