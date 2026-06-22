'use client'

// Catastrophic fallback: catches errors thrown in the ROOT layout
// itself. It REPLACES the root layout, so it must render its own
// <html>/<body> and cannot rely on globals.css or ThemeProvider —
// everything here is inline-styled and self-contained. Kept dark +
// minimal on purpose; this only ever shows if the whole app shell
// failed to render.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  // `reset` is intentionally unused: it re-renders the SAME crashed root
  // layout, which almost always re-throws. A hard reload is what actually
  // recovers here, so the button below calls window.location.reload().
  reset: () => void
}) {
  const gradient = 'linear-gradient(135deg, #5b21b6, #2563eb)'
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          padding: '1.5rem',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: '#0d0a14',
          color: '#f5f3fa',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 800,
            color: '#fff',
            background: gradient,
          }}
        >
          C
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: 360, fontSize: '0.875rem', opacity: 0.7, margin: 0, lineHeight: 1.5 }}>
          Creator Outreach hit an unexpected error. Reloading usually fixes it. If it persists, email support@creatoroutreach.net.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '0.5rem',
            padding: '0.625rem 1.25rem',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#fff',
            background: gradient,
          }}
        >
          Reload
        </button>
        {error?.digest && (
          <p style={{ fontSize: 11, opacity: 0.4, fontFamily: 'ui-monospace, monospace', margin: 0 }}>
            Reference: {error.digest}
          </p>
        )}
      </body>
    </html>
  )
}
