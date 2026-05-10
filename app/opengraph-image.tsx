import { ImageResponse } from 'next/og'

/**
 * Dynamically-generated Open Graph image (1200×630 PNG) served at
 * /opengraph-image. Next.js auto-detects the file location and wires
 * it into the page's <meta property="og:image"> so any URL share
 * (iMessage, Slack, Twitter, LinkedIn, Discord, etc.) gets a branded
 * preview card instead of nothing.
 *
 * Generated at build/request time using next/og's ImageResponse —
 * pure JSX, no design tool needed. Easy to iterate on the copy or
 * gradient by editing this file.
 */

export const alt = 'Creator Outreach — Find & email creators worth reaching'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          background:
            'linear-gradient(135deg, #0A0E15 0%, #1a1530 50%, #0A0E15 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Subtle radial glow behind the headline */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            right: -200,
            width: 700,
            height: 700,
            background:
              'radial-gradient(circle, rgba(124,58,237,0.35) 0%, rgba(124,58,237,0) 60%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -200,
            left: -200,
            width: 700,
            height: 700,
            background:
              'radial-gradient(circle, rgba(37,99,235,0.30) 0%, rgba(37,99,235,0) 60%)',
            display: 'flex',
          }}
        />

        {/* Logo block */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            marginBottom: 60,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: -1,
              color: 'white',
            }}
          >
            CO
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: -0.5,
              color: 'rgba(255,255,255,0.95)',
            }}
          >
            Creator Outreach
          </div>
        </div>

        {/* Headline — multi-line, big and confident */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1.05,
            marginBottom: 28,
            display: 'flex',
            flexDirection: 'column',
            color: 'white',
          }}
        >
          <span>Find &amp; email creators</span>
          <span style={{ color: '#A78BFA' }}>worth reaching.</span>
        </div>

        {/* Subhead */}
        <div
          style={{
            fontSize: 30,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.35,
            maxWidth: 950,
          }}
        >
          Search YouTube · IG · TikTok · X · LinkedIn in parallel. Score
          every result. Reach out from one queue.
        </div>

        {/* Footer URL chip */}
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            right: 80,
            fontSize: 22,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.55)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          creatoroutreach.net
        </div>
      </div>
    ),
    { ...size },
  )
}
