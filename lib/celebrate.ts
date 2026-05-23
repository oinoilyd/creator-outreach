// Celebration animation for "deal closed" moments.
//
// 2026-05-23 v3 per Dylan: confetti still wasn't firing reliably on
// desktop after the canvas-confetti tweaks (v2 bumped zIndex + spread
// + particle count). Suspected root cause: something in the desktop
// render path (z-index conflict with the spotlight overlay, a parent
// overflow:hidden clipping the canvas, or canvas-confetti's
// auto-created canvas being stripped by a CSS rule). Mobile happened
// to dodge whatever the issue was.
//
// Solution: fire BOTH a canvas-confetti burst AND a DOM-based
// confetti burst at the same time. DOM-based is built from
// absolutely-positioned divs appended to document.body with inline
// styles — no library, no canvas, no z-index inheritance, immune to
// whatever was tripping canvas-confetti up. Whichever one renders
// (likely both) the user sees a celebration.
import confetti from 'canvas-confetti'

const CONFETTI_COLORS = [
  '#a855f7', // brand violet
  '#3b82f6', // brand blue
  '#10b981', // emerald (success)
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
] as const

export function celebrateSuccess(originX?: number, originY?: number) {
  // Always fire the DOM-based burst — guaranteed to render regardless
  // of canvas-confetti behavior.
  fireDomBurst()

  // Then attempt canvas-confetti as a bonus layer. Wrapped in
  // try/catch so a library failure can't break the celebration —
  // the DOM burst above has already kicked off.
  try {
    if (originX != null && originY != null) {
      confetti({
        particleCount: 80,
        spread: 75,
        startVelocity: 38,
        origin: { x: originX / window.innerWidth, y: originY / window.innerHeight },
        colors: [...CONFETTI_COLORS],
        scalar: 0.9,
        ticks: 150,
        zIndex: 9999,
      })
      return
    }

    const base = {
      particleCount: 70,
      spread: 70,
      startVelocity: 38,
      colors: [...CONFETTI_COLORS],
      scalar: 0.95,
      ticks: 150,
      zIndex: 9999,
    }
    confetti({ ...base, origin: { x: 0.35, y: 0.65 }, angle: 75 })
    setTimeout(() => {
      confetti({ ...base, origin: { x: 0.65, y: 0.65 }, angle: 105 })
    }, 60)
  } catch (err) {
    // Canvas-confetti choked. DOM burst already covers us; just
    // log so we can debug if it becomes a pattern.
    console.warn('[celebrate] canvas-confetti threw:', err)
  }
}

/**
 * DOM-based confetti burst — guaranteed-to-render fallback.
 *
 * Creates ~80 absolutely-positioned divs with random colors / sizes /
 * horizontal positions, appends them to document.body, animates them
 * via the Web Animations API (no CSS keyframes needed — they get
 * inlined per-element), and auto-removes them when the animation
 * settles.
 *
 * Why this is reliable where canvas-confetti might fail:
 *   • No <canvas> element — bypasses any canvas-clipping CSS, GPU
 *     compositor issues, or library-side rendering bugs.
 *   • Each div is appended directly to <body> so no ancestor's
 *     overflow:hidden can clip them.
 *   • Inline z-index: 99999 beats any spotlight/backdrop overlay.
 *   • Pointer-events:none so they don't intercept clicks during the
 *     ~1.4s animation.
 *   • Auto-cleanup via animation finished promise — no DOM leaks even
 *     if the user fires it 50 times in a row.
 */
function fireDomBurst() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const count = 80
  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  // The container itself is fixed-positioned + non-clipping; it just
  // provides a single DOM node we can clean up at the end if any
  // individual animation listeners fail.
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'visible',
    zIndex: '99999',
  } satisfies Partial<CSSStyleDeclaration>)
  document.body.appendChild(container)

  const finishPromises: Promise<unknown>[] = []
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div')
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
    // Mix circles + rectangles for variety, like real confetti.
    const isCircle = Math.random() < 0.35
    const size = 6 + Math.random() * 6 // 6-12px
    const startLeft = 20 + Math.random() * 60 // 20-80% — middle band
    // Diagonal explosion: half go left-up, half right-up. Then gravity
    // takes them down. Spread accounts for left/right bias.
    const angleSpread = (Math.random() - 0.5) * 1.2 // -0.6 to +0.6
    const xDistance = angleSpread * (window.innerWidth * 0.5)
    const yDistance = window.innerHeight * (0.5 + Math.random() * 0.4)
    const rotateStart = Math.random() * 360
    const rotateEnd = rotateStart + (Math.random() - 0.5) * 720 // up to ±360°

    Object.assign(piece.style, {
      position: 'fixed',
      left: `${startLeft}%`,
      top: '60%',
      width: `${size}px`,
      height: `${isCircle ? size : size * 1.4}px`,
      backgroundColor: color,
      borderRadius: isCircle ? '50%' : '1px',
      pointerEvents: 'none',
      willChange: 'transform, opacity',
      // Sit ABOVE the container's z-index just in case the container
      // itself gets stuck in a stacking context the body has.
      zIndex: '99999',
      opacity: '1',
    } satisfies Partial<CSSStyleDeclaration>)

    container.appendChild(piece)

    // Web Animations API — runs on the compositor, doesn't depend on
    // any external CSS rules. Each piece gets a unique trajectory.
    const animation = piece.animate(
      [
        { transform: `translate(0, 0) rotate(${rotateStart}deg)`, opacity: 1 },
        { transform: `translate(${xDistance * 0.4}px, ${-yDistance * 0.3}px) rotate(${(rotateStart + rotateEnd) / 2}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${xDistance}px, ${yDistance}px) rotate(${rotateEnd}deg)`, opacity: 0 },
      ],
      {
        duration: 1100 + Math.random() * 500, // 1.1-1.6s
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        delay: Math.random() * 80, // tiny stagger so they don't all sync
        fill: 'forwards',
      },
    )

    finishPromises.push(animation.finished.catch(() => undefined))
  }

  // Once every piece has settled (or errored), clean up the container.
  Promise.allSettled(finishPromises).then(() => {
    container.remove()
  })
}
