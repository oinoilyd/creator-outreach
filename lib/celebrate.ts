// celebrateSuccess — the "deal closed" moment.
//
// Design intent (2026-05-23 v6 per Dylan: "less ai feel on confetti"):
//
//   Earlier versions had stylized "designed" layers — radial center
//   flash, white sparkle pops, uniform glow halos on every piece, all
//   particles ejecting in the same frame. Each of those reads as
//   "effect engineered by a designer" rather than "someone fired a
//   confetti cannon." v6 strips out the designed layers and leans
//   into messy, irregular, paper-only realism:
//
//     • No center flash. Real confetti doesn't ship with a radial
//       gradient bloom — that was the loudest "designed effect" tell.
//     • No white sparkles. Same reason.
//     • No diffuse glow halo on individual pieces. Just a 0.5px
//       edge stroke so each piece has a defined boundary against the
//       background. Paper doesn't glow.
//     • Staggered release: main burst spawns over 250ms instead of a
//       single frame. Feels like a continuous cannon, not a single
//       perfectly-timed explosion.
//     • Per-piece gravity variation (0.75×–1.30×). Heavy pieces drop
//       fast; light pieces glide. Adds the asymmetric drift real
//       confetti has — some land within a second, some float for
//       three.
//     • Wider size variation (3-16px) for more visual irregularity.
//     • Palette includes a few muted/cream tones (gold, peach, sage)
//       alongside the brand colors. Real party confetti isn't 100%
//       brand-saturated.
//     • Rain wash kept (desktop-scale fill from above) but count
//       reduced — less "scripted."
//     • Streamers kept but reduced — they're a real party element
//       but a small number reads as more organic.
//
// Physics:
//   requestAnimationFrame loop with real gravity, drag, spin decay,
//   and per-particle gravity multiplier. Frame-rate-aware (dt clamped
//   to 3 frames) so stutters don't teleport particles.
//
// Accessibility:
//   prefers-reduced-motion users skip the particle storm and get a
//   single subdued radial flash that fades. Still a visual signal, no
//   movement. (The flash is reserved for this case only — full-motion
//   users get no flash, just confetti.)
//
// Why no canvas-confetti library:
//   v2/v3 used it; v4 dropped it after the "fires on mobile not
//   desktop" mystery. Owning the whole render gives tighter control
//   and eliminates library quirks in our app's z-index/overflow
//   context.

const CONFETTI_COLORS = [
  // Brand colors (~60% of pieces)
  '#a855f7', // brand violet
  '#3b82f6', // brand blue
  '#10b981', // emerald
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f59e0b', // amber
  // Muted "real party" tones (~40% — these de-AI the palette)
  '#fde68a', // soft cream
  '#fbcfe8', // pale pink
  '#fed7aa', // peach
  '#bbf7d0', // sage mint
  '#fef08a', // butter yellow
] as const

const STREAMER_COLORS = [
  '#a855f7',
  '#3b82f6',
  '#06b6d4',
  '#ec4899',
  '#fde68a',
  '#fbcfe8',
] as const

// Tuned constants. Each one affects physics feel — tweak with care.
const GRAVITY = 0.36              // pixels/frame² (60fps normalized) — base
const DRAG = 0.985                // horizontal velocity decay per frame
const SPIN_DRAG = 0.97            // rotation decay per frame
const PARTICLE_LIFE_FRAMES = 140  // ~2.3s @ 60fps before forced removal
const FADE_START_RATIO = 0.55     // start fading at 55% of life
const Z_INDEX = 99999             // above everything in the app

interface Particle {
  el: HTMLDivElement
  x: number          // px offset from spawn origin
  y: number
  vx: number         // px/frame
  vy: number
  rotation: number   // deg
  spin: number       // deg/frame
  life: number       // frames remaining
  maxLife: number
  /** Per-piece gravity multiplier — adds drift variation across the
   *  burst (light pieces float, heavy pieces fall fast). 0.75–1.30. */
  gravityMul: number
}

/**
 * Public entrypoint. Fires the celebration. Optional `originX`/`originY`
 * (viewport pixels) anchor the burst to a specific point — e.g. button
 * coordinates from `event.clientX/Y`. Defaults to dead-center.
 */
export function celebrateSuccess(originX?: number, originY?: number) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const ox = originX ?? window.innerWidth / 2
  const oy = originY ?? window.innerHeight / 2

  // Reduced-motion: subdued flash, no movement.
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion) {
    spawnReducedMotionFlash(ox, oy)
    return
  }

  // Viewport-aware particle multiplier. 1× under 900px (mobile), up
  // to 2× at 1800px+ (large desktop), linear in between.
  const sizeMultiplier = Math.min(2, Math.max(1, window.innerWidth / 900))

  const container = makeContainer()

  // Rain wash from above — separate container, independent physics
  // loop. Adds full-viewport-width fill so desktop celebrations
  // aren't stuck around the click point. Count dialed back from v5
  // to lean less "scripted."
  spawnRainWash(sizeMultiplier)

  // Physics-driven particles from origin.
  const particles: Particle[] = []

  // Main burst — staggered release over 250ms. Splitting the spawn
  // into ~8 micro-waves makes the cannon feel continuous instead of
  // "all 90 particles ejected on frame 0." The eye reads this as
  // organic chaos rather than algorithmic synchronization.
  const mainCount = Math.round(90 * sizeMultiplier)
  const waves = 8
  const perWave = Math.ceil(mainCount / waves)
  for (let w = 0; w < waves; w++) {
    window.setTimeout(() => {
      if (!container.isConnected) return
      for (let i = 0; i < perWave && particles.length < mainCount; i++) {
        particles.push(spawnConfetti(container, ox, oy, sizeMultiplier))
      }
    }, w * 30) // 0, 30, 60, ... 210ms — total spread ~210ms
  }

  // Streamer ribbons — fewer now (was 18, → 12 at 1×). Plenty of
  // confetti carries the moment; over-many streamers read as
  // "designed."
  const streamerCount = Math.round(12 * sizeMultiplier)
  for (let i = 0; i < streamerCount; i++) {
    particles.push(spawnStreamer(container, ox, oy, sizeMultiplier))
  }

  // Physics loop.
  let lastTime = performance.now()
  const startTime = performance.now()
  function tick(now: number) {
    const dt = Math.min(3, (now - lastTime) / 16.67)
    lastTime = now

    let alive = 0
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life -= dt
      if (p.life <= 0) {
        p.el.remove()
        particles.splice(i, 1)
        continue
      }
      alive++

      // Per-piece gravity gives the cloud realistic depth — heavy
      // pieces fall fast, light pieces glide.
      p.vy += GRAVITY * p.gravityMul * dt
      p.vx *= Math.pow(DRAG, dt)
      p.spin *= Math.pow(SPIN_DRAG, dt)
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rotation += p.spin * dt

      const ageRatio = 1 - p.life / p.maxLife
      const opacity = ageRatio < FADE_START_RATIO
        ? 1
        : Math.max(0, 1 - (ageRatio - FADE_START_RATIO) / (1 - FADE_START_RATIO))

      p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}deg)`
      p.el.style.opacity = String(opacity)
    }

    // Keep ticking while particles are alive, or while we're still
    // in the spawn window (the staggered waves keep spawning up to
    // ~210ms after start).
    if (alive > 0 || performance.now() - startTime < 350) {
      requestAnimationFrame(tick)
    } else {
      container.remove()
    }
  }
  requestAnimationFrame(tick)
}

// ── Container ──────────────────────────────────────────────────────

function makeContainer(): HTMLDivElement {
  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'visible',
    zIndex: String(Z_INDEX),
  } satisfies Partial<CSSStyleDeclaration>)
  document.body.appendChild(container)
  return container
}

// ── Confetti pieces ────────────────────────────────────────────────

/**
 * Spawn one confetti particle. Mixed shape (rectangle / square /
 * circle / pill), wide size variation, mixed colors including
 * muted/cream tones. Radial launch direction with randomized speed
 * and per-piece gravity.
 *
 * No glow shadow on individual pieces — real paper doesn't glow.
 * Just a 0.5px solid edge for definition.
 */
function spawnConfetti(
  container: HTMLDivElement,
  ox: number,
  oy: number,
  sizeMultiplier: number,
): Particle {
  const el = document.createElement('div')
  const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]

  // Wider size variation than v5 (was 6-12) — real confetti has
  // some big pieces and some tiny ones, not uniform.
  const shapeRoll = Math.random()
  let width: number
  let height: number
  let borderRadius: string
  if (shapeRoll < 0.45) {
    // Tall rectangle — classic confetti slip
    width = 4 + Math.random() * 6 // 4-10px
    height = width * (1.5 + Math.random() * 0.8) // varied aspect
    borderRadius = '1px'
  } else if (shapeRoll < 0.7) {
    // Square — chunky piece
    const s = 5 + Math.random() * 7 // 5-12px (wider range)
    width = s
    height = s
    borderRadius = '1.5px'
  } else if (shapeRoll < 0.88) {
    // Circle
    const s = 4 + Math.random() * 5 // 4-9px
    width = s
    height = s
    borderRadius = '50%'
  } else if (shapeRoll < 0.97) {
    // Flat pill — thin ribbon-ish
    width = 8 + Math.random() * 8 // 8-16px (some big ones)
    height = 3 + Math.random() * 1.5
    borderRadius = '999px'
  } else {
    // Tiny dot — adds dust-of-confetti feel
    const s = 3 + Math.random() * 2 // 3-5px
    width = s
    height = s
    borderRadius = '50%'
  }

  Object.assign(el.style, {
    position: 'fixed',
    left: `${ox}px`,
    top: `${oy}px`,
    width: `${width}px`,
    height: `${height}px`,
    marginLeft: `${-width / 2}px`,
    marginTop: `${-height / 2}px`,
    backgroundColor: color,
    borderRadius,
    pointerEvents: 'none',
    willChange: 'transform, opacity',
    // 0.5px solid edge — gives the piece a boundary. NO diffuse glow
    // (that was the "designed effect" tell in v5).
    boxShadow: `0 0 0 0.5px ${hexWithAlpha(color, 0.4)}`,
    zIndex: String(Z_INDEX),
  } satisfies Partial<CSSStyleDeclaration>)
  container.appendChild(el)

  // Radial launch with varied speed.
  const angle = Math.random() * Math.PI * 2
  // Wider speed range so some pieces drift while others rocket — adds
  // clumping illusion (slow pieces stay near origin, fast ones travel
  // far). 2-16 px/frame range, with desktop velocity boost.
  const speed = (2 + Math.random() * 14) * sizeMultiplier
  const vx = Math.cos(angle) * speed
  // Slight upward bias so the burst feels like an upward explosion
  // before gravity wins. Smaller bias than v5 — too much upward bias
  // made every piece arc the same way.
  const vy = Math.sin(angle) * speed - 1.5 - Math.random() * 3

  // Per-piece gravity: 0.75x to 1.30x. Heavy pieces (>1.0) plummet,
  // light ones (<1.0) glide. This is the biggest organic-feel
  // contributor — same launch angle + different gravity = different
  // trajectory, just like real paper of different weights.
  const gravityMul = 0.75 + Math.random() * 0.55

  const maxLife = PARTICLE_LIFE_FRAMES * (0.6 + Math.random() * 0.8) // 0.6x to 1.4x base
  return {
    el,
    x: 0,
    y: 0,
    vx,
    vy,
    rotation: Math.random() * 360,
    // Spin variation: some pieces tumble fast, some spin slow.
    spin: (Math.random() - 0.5) * 22,
    life: maxLife,
    maxLife,
    gravityMul,
  }
}

// ── Streamers ──────────────────────────────────────────────────────

/**
 * Long thin colored ribbon — reads as a party streamer mixed in with
 * the confetti. Higher initial velocity. Fewer of these in v6 — they
 * were starting to dominate the visual.
 */
function spawnStreamer(container: HTMLDivElement, ox: number, oy: number, sizeMultiplier: number): Particle {
  const el = document.createElement('div')
  const color = STREAMER_COLORS[Math.floor(Math.random() * STREAMER_COLORS.length)]

  const length = 16 + Math.random() * 14 // 16-30px
  Object.assign(el.style, {
    position: 'fixed',
    left: `${ox}px`,
    top: `${oy}px`,
    width: `${length}px`,
    height: '2.5px',
    marginLeft: `${-length / 2}px`,
    marginTop: '-1.25px',
    backgroundColor: color,
    borderRadius: '999px',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
    // Soft edge — no diffuse glow halo.
    boxShadow: `0 0 0 0.5px ${hexWithAlpha(color, 0.45)}`,
    zIndex: String(Z_INDEX),
  } satisfies Partial<CSSStyleDeclaration>)
  container.appendChild(el)

  const angle = Math.random() * Math.PI * 2
  const speed = (9 + Math.random() * 10) * sizeMultiplier
  const vx = Math.cos(angle) * speed
  const vy = Math.sin(angle) * speed - 2 - Math.random() * 3

  // Streamers are light/long — lower gravity multiplier so they
  // hang in the air briefly before falling.
  const gravityMul = 0.6 + Math.random() * 0.4

  const maxLife = PARTICLE_LIFE_FRAMES * (0.9 + Math.random() * 0.5)
  return {
    el,
    x: 0,
    y: 0,
    vx,
    vy,
    rotation: (angle * 180) / Math.PI + 90,
    spin: (Math.random() - 0.5) * 6,
    life: maxLife,
    maxLife,
    gravityMul,
  }
}

// ── Rain wash (additional pieces falling from above) ───────────────

/**
 * Rain wash — extra confetti falling from above the top edge across
 * the full viewport width with a sine-wave horizontal sway. Fills the
 * whole screen so desktop celebrations feel proportional to viewport
 * size. Count reduced from v5 — less "scripted."
 *
 * Runs in its own container + own physics loop, independent of the
 * central burst (gentler gravity, longer lifespan, side-to-side
 * wobble).
 */
function spawnRainWash(sizeMultiplier: number) {
  const container = makeContainer()
  // Lighter than v5 (was 30 × multiplier, now 18). Lets the central
  // burst stay the focal point.
  const count = Math.round(18 * sizeMultiplier)
  const RAIN_GRAVITY = 0.18
  const PIECE_LIFE = 200

  interface RainPiece {
    el: HTMLDivElement
    x: number
    y: number
    vx: number
    vy: number
    swayAmp: number
    swayPhase: number
    swayFreq: number
    rotation: number
    spin: number
    life: number
    startLeft: number
    startTop: number
  }

  const pieces: RainPiece[] = []
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
    const shapeRoll = Math.random()
    let width: number
    let height: number
    let borderRadius: string
    if (shapeRoll < 0.5) {
      width = 4 + Math.random() * 4
      height = width * (1.5 + Math.random() * 0.7)
      borderRadius = '1px'
    } else if (shapeRoll < 0.85) {
      const s = 5 + Math.random() * 4
      width = s
      height = s
      borderRadius = '1.5px'
    } else {
      const s = 4 + Math.random() * 3
      width = s
      height = s
      borderRadius = '50%'
    }

    const startX = Math.random() * window.innerWidth
    const startY = -50 - Math.random() * 250

    Object.assign(el.style, {
      position: 'fixed',
      left: `${startX}px`,
      top: `${startY}px`,
      width: `${width}px`,
      height: `${height}px`,
      marginLeft: `${-width / 2}px`,
      marginTop: `${-height / 2}px`,
      backgroundColor: color,
      borderRadius,
      pointerEvents: 'none',
      willChange: 'transform, opacity',
      boxShadow: `0 0 0 0.5px ${hexWithAlpha(color, 0.4)}`,
      zIndex: String(Z_INDEX),
    } satisfies Partial<CSSStyleDeclaration>)
    container.appendChild(el)

    pieces.push({
      el,
      x: startX,
      y: startY,
      startLeft: startX,
      startTop: startY,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 1.5 + Math.random() * 1.5,
      swayAmp: 0.3 + Math.random() * 0.5,
      swayPhase: Math.random() * Math.PI * 2,
      swayFreq: 0.05 + Math.random() * 0.04,
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 8,
      life: PIECE_LIFE,
    })
  }

  let lastTime = performance.now()
  let frame = 0
  function tick(now: number) {
    const dt = Math.min(3, (now - lastTime) / 16.67)
    lastTime = now
    frame += dt

    let alive = 0
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i]
      p.life -= dt
      if (p.life <= 0 || p.y > window.innerHeight + 100) {
        p.el.remove()
        pieces.splice(i, 1)
        continue
      }
      alive++

      p.vy += RAIN_GRAVITY * dt
      p.vx *= Math.pow(0.99, dt)
      const sway = Math.sin(frame * p.swayFreq + p.swayPhase) * p.swayAmp
      p.x += (p.vx + sway) * dt
      p.y += p.vy * dt
      p.rotation += p.spin * dt

      const ageRatio = 1 - p.life / PIECE_LIFE
      let opacity = 1
      if (ageRatio > 0.7) {
        opacity = Math.max(0, 1 - (ageRatio - 0.7) / 0.3)
      }
      const distFromBottom = window.innerHeight - p.y
      if (distFromBottom < 60) {
        opacity = Math.min(opacity, Math.max(0, distFromBottom / 60))
      }

      p.el.style.transform = `translate3d(${p.x - p.startLeft}px, ${p.y - p.startTop}px, 0) rotate(${p.rotation}deg)`
      p.el.style.opacity = String(opacity)
    }

    if (alive > 0) {
      requestAnimationFrame(tick)
    } else {
      container.remove()
    }
  }
  requestAnimationFrame(tick)
}

// ── Reduced-motion variant ─────────────────────────────────────────

/**
 * Reduced-motion fallback. No movement — just a single subdued
 * radial flash so the user still sees that something succeeded.
 */
function spawnReducedMotionFlash(ox: number, oy: number) {
  const container = makeContainer()
  const flash = document.createElement('div')
  Object.assign(flash.style, {
    position: 'fixed',
    left: `${ox}px`,
    top: `${oy}px`,
    width: '420px',
    height: '420px',
    marginLeft: '-210px',
    marginTop: '-210px',
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(168,85,247,0.35) 0%, rgba(59,130,246,0.20) 50%, transparent 75%)',
    pointerEvents: 'none',
    zIndex: String(Z_INDEX),
  } satisfies Partial<CSSStyleDeclaration>)
  container.appendChild(flash)
  flash.animate(
    [
      { opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { opacity: 0 },
    ],
    { duration: 700, easing: 'ease-in-out', fill: 'forwards' },
  ).finished.then(() => container.remove())
}

// ── Helpers ────────────────────────────────────────────────────────

/** Convert #RRGGBB to rgba(R,G,B,A) for box-shadow alpha layering. */
function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
