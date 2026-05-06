// Helper that wraps a navigation in the View Transitions API to render
// a circle-reveal animation from a click origin. Used on the auth pages
// when the user signs in / signs up — the dark auth shell is "wiped"
// open by an expanding circle that reveals the light app underneath.
//
// Falls back to a plain navigation in browsers without support
// (Firefox, older Safari) so the flow is never blocked.

type Origin = { x: number; y: number } | null

export async function revealToLight(
  origin: Origin,
  performNavigation: () => void,
): Promise<void> {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // No support or user prefers reduced motion → just navigate.
  if (typeof document.startViewTransition !== 'function' || reduce) {
    performNavigation()
    return
  }

  // Compute the radius needed to cover the viewport from the origin so
  // the circle expands fully past every corner.
  const w = window.innerWidth
  const h = window.innerHeight
  const x = origin?.x ?? w / 2
  const y = origin?.y ?? h / 2
  const radius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y))

  document.documentElement.style.setProperty('--vt-x', `${x}px`)
  document.documentElement.style.setProperty('--vt-y', `${y}px`)
  document.documentElement.style.setProperty('--vt-radius', `${radius}px`)

  const transition = document.startViewTransition(() => {
    performNavigation()
  })

  // Don't block on .finished — keep the navigation snappy. The animation
  // will play out on top while the new page hydrates.
  transition.ready.catch(() => {
    // Browser refused to start (e.g. concurrent transition) — already
    // fell back inside the callback.
  })
}
