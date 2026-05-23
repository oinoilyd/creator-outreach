// celebrateSuccess — the "deal closed" moment.
//
// Design intent (2026-05-23 v4 per Dylan: "horrible, do a full
// visual and design remodel — details man details"):
//
//   This is the single biggest dopamine moment in the whole app —
//   the user just turned a creator from a lead into a paying client.
//   Three earlier iterations all looked like a stock confetti dump.
//   This rewrite layers FIVE distinct visual systems on top of each
//   other to make the moment feel earned, not algorithmic:
//
//     1. Center flash      — radial gradient glow that punches in,
//                            blooms, and fades. Brand violet→teal,
//                            scales from 0 to 480px over 700ms. Sets
//                            the "something just happened HERE" anchor.
//     2. Main burst         — 90 particles erupting radially from
//                            center. Mixed shapes (rectangles,
//                            squares, circles), mixed sizes (6-14px),
//                            mixed colors (6-tone brand palette),
//                            each with unique velocity, gravity-
//                            affected, drag-decayed, rotating
//                            independently.
//     3. Secondary burst    — 35 more pieces 100ms later, off-center,
//                            for layered richness.
//     4. Streamers          — 18 long thin ribbons (3×22px) shooting
//                            at higher initial velocity. Read as
//                            "party streamers" mixed in with the
//                            confetti.
//     5. Sparkles           — 22 bright white dots with box-shadow
//                            glow that POP (scale 0→1.4→0) at random
//                            positions across the screen, staggered
//                            0-700ms, each lasting 400ms. Adds the
//                            "fireflies in the air" feel that pure
//                            confetti can't give you.
//
//   Everything runs on requestAnimationFrame physics — not Web
//   Animations API keyframes — so each particle gets real gravity,
//   real drag, real spin. No baked-in trajectory; the result feels
//   organic instead of "all 80 pieces follow the same curve."
//
// Why no canvas-confetti library:
//   v2/v3 used it; v3 added a DOM fallback alongside; v4 drops the
//   library entirely. Owning the whole render gives us tighter
//   control over layering, color, and physics, and eliminates the
//   mystery "fires on mobile but not desktop" behavior that the
//   library exhibited in our app's z-index/overflow context.
//
// Accessibility:
//   prefers-reduced-motion users skip the particle storm and get a
//   single subdued center flash + auto-clear. Still a visual signal,
//   no movement.

const CONFETTI_COLORS = [
  '#a855f7', // brand violet
  '#3b82f6', // brand blue
  '#10b981', // emerald (success)
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
] as const

const STREAMER_COLORS = [
  '#a855f7',
  '#3b82f6',
  '#06b6d4',
  '#ec4899',
] as const

// Tuned constants. Each one affects physics feel — tweak with care.
const GRAVITY = 0.38              // pixels/frame² (60fps normalized)
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

  // Reduced-motion: just a flash. No movement, no flying particles.
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion) {
    spawnReducedMotionFlash(ox, oy)
    return
  }

  // Container holds all spawned elements — single removal at the end.
  const container = makeContainer()

  // Layer 1 — center flash (always first, anchors the whole moment).
  spawnCenterFlash(container, ox, oy)

  // Layer 5 — sparkles (staggered start, run independently of the
  // physics loop because their lifecycle is short + pop-based).
  spawnSparkles(container)

  // Layers 2-4 — physics-driven particles.
  const particles: Particle[] = []
  // Main burst (90 mixed-shape confetti).
  for (let i = 0; i < 90; i++) {
    particles.push(spawnConfetti(container, ox, oy, /* delayFrames */ 0))
  }
  // Streamer ribbons (18, higher velocity, longer life).
  for (let i = 0; i < 18; i++) {
    particles.push(spawnStreamer(container, ox, oy))
  }
  // Secondary burst at +100ms (35 more for layering).
  window.setTimeout(() => {
    if (!container.isConnected) return
    for (let i = 0; i < 35; i++) {
      particles.push(spawnConfetti(container, ox, oy, 0))
    }
  }, 100)

  // Physics loop.
  let lastTime = performance.now()
  function tick(now: number) {
    const dt = Math.min(3, (now - lastTime) / 16.67) // frames since last (cap to skip stutters)
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

      // Integrate physics.
      p.vy += GRAVITY * dt
      p.vx *= Math.pow(DRAG, dt)
      p.spin *= Math.pow(SPIN_DRAG, dt)
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rotation += p.spin * dt

      // Fade out across last 45% of life.
      const ageRatio = 1 - p.life / p.maxLife
      const opacity = ageRatio < FADE_START_RATIO
        ? 1
        : Math.max(0, 1 - (ageRatio - FADE_START_RATIO) / (1 - FADE_START_RATIO))

      p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}deg)`
      p.el.style.opacity = String(opacity)
    }

    if (alive > 0 || performance.now() - startTime < 250 /* hold for late secondary burst */) {
      requestAnimationFrame(tick)
    } else {
      container.remove()
    }
  }
  const startTime = performance.now()
  requestAnimationFrame(tick)
}

// ── Container + flash ──────────────────────────────────────────────

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

/**
 * Center flash — a radial gradient bloom that punches in, peaks, and
 * fades. Anchors the celebration to a specific point on screen.
 * Brand violet→teal so it ties to the in-app brand mark.
 */
function spawnCenterFlash(container: HTMLDivElement, ox: number, oy: number) {
  const flash = document.createElement('div')
  Object.assign(flash.style, {
    position: 'fixed',
    left: `${ox}px`,
    top: `${oy}px`,
    width: '20px',
    height: '20px',
    marginLeft: '-10px',
    marginTop: '-10px',
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(168,85,247,0.55) 0%, rgba(59,130,246,0.35) 35%, rgba(6,182,212,0.15) 65%, transparent 80%)',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
    filter: 'blur(2px)',
    zIndex: String(Z_INDEX),
  } satisfies Partial<CSSStyleDeclaration>)
  container.appendChild(flash)
  flash.animate(
    [
      { transform: 'scale(0)', opacity: 0 },
      { transform: 'scale(8)', opacity: 1, offset: 0.18 },
      { transform: 'scale(22)', opacity: 0.55, offset: 0.55 },
      { transform: 'scale(28)', opacity: 0 },
    ],
    { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
  )
}

// ── Confetti pieces ────────────────────────────────────────────────

/**
 * Spawn one confetti particle. Mixed shape (rectangle / square /
 * circle), mixed size, mixed color. Radial launch direction with
 * randomized speed.
 */
function spawnConfetti(
  container: HTMLDivElement,
  ox: number,
  oy: number,
  delayFrames: number,
): Particle {
  const el = document.createElement('div')
  const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]

  // Shape mix: 45% rectangle, 30% square, 20% circle, 5% rounded pill.
  const shapeRoll = Math.random()
  let width: number
  let height: number
  let borderRadius: string
  if (shapeRoll < 0.45) {
    // Rectangle — classic confetti slip
    width = 6 + Math.random() * 4 // 6-10px
    height = width * (1.6 + Math.random() * 0.6) // taller than wide
    borderRadius = '1.5px'
  } else if (shapeRoll < 0.75) {
    // Square — chunkier piece
    const s = 7 + Math.random() * 5 // 7-12px
    width = s
    height = s
    borderRadius = '2px'
  } else if (shapeRoll < 0.95) {
    // Circle — round dot
    const s = 6 + Math.random() * 4
    width = s
    height = s
    borderRadius = '50%'
  } else {
    // Pill — flat oval
    width = 10 + Math.random() * 4
    height = 4
    borderRadius = '999px'
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
    // Slight box-shadow gives the piece depth + edge — reads less
    // flat than a pure-fill div.
    boxShadow: `0 0 0 0.5px ${color}, 0 0 6px ${hexWithAlpha(color, 0.25)}`,
    zIndex: String(Z_INDEX),
  } satisfies Partial<CSSStyleDeclaration>)
  container.appendChild(el)

  // Radial launch. Angle anywhere 0-360°; speed varied so the cloud
  // doesn't look uniform. Bias slightly upward (subtract a small
  // amount from vy) so the burst feels like an upward explosion
  // before gravity pulls it down.
  const angle = Math.random() * Math.PI * 2
  const speed = 6 + Math.random() * 10 // 6-16 px/frame
  const vx = Math.cos(angle) * speed
  // Bias initial vy upward — gravity will overcome it. Mix of upward
  // and downward launches feels more organic than "all pieces shoot up."
  const vy = Math.sin(angle) * speed - 2 - Math.random() * 4

  const maxLife = PARTICLE_LIFE_FRAMES * (0.7 + Math.random() * 0.6)
  return {
    el,
    x: 0,
    y: 0,
    vx,
    vy,
    rotation: Math.random() * 360,
    spin: (Math.random() - 0.5) * 25, // -12 to +12 deg/frame
    life: maxLife - delayFrames,
    maxLife,
  }
}

// ── Streamers (long thin ribbons) ──────────────────────────────────

/**
 * Long thin colored ribbon — reads as a party streamer mixed in with
 * the confetti. Higher initial velocity than confetti pieces so they
 * shoot further before gravity takes them.
 */
function spawnStreamer(container: HTMLDivElement, ox: number, oy: number): Particle {
  const el = document.createElement('div')
  const color = STREAMER_COLORS[Math.floor(Math.random() * STREAMER_COLORS.length)]

  const length = 18 + Math.random() * 12 // 18-30px
  Object.assign(el.style, {
    position: 'fixed',
    left: `${ox}px`,
    top: `${oy}px`,
    width: `${length}px`,
    height: '3px',
    marginLeft: `${-length / 2}px`,
    marginTop: '-1.5px',
    backgroundColor: color,
    borderRadius: '999px',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
    boxShadow: `0 0 8px ${hexWithAlpha(color, 0.5)}`,
    zIndex: String(Z_INDEX),
  } satisfies Partial<CSSStyleDeclaration>)
  container.appendChild(el)

  const angle = Math.random() * Math.PI * 2
  // Faster than confetti.
  const speed = 11 + Math.random() * 9 // 11-20 px/frame
  const vx = Math.cos(angle) * speed
  const vy = Math.sin(angle) * speed - 3 - Math.random() * 4 // upward bias

  const maxLife = PARTICLE_LIFE_FRAMES * (0.9 + Math.random() * 0.4)
  return {
    el,
    x: 0,
    y: 0,
    vx,
    vy,
    rotation: (angle * 180) / Math.PI + 90, // align streamer to travel direction
    spin: (Math.random() - 0.5) * 8,
    life: maxLife,
    maxLife,
  }
}

// ── Sparkles ───────────────────────────────────────────────────────

/**
 * Bright white pops scattered across the screen — adds "fireflies"
 * to the celebration. Each sparkle pops in, holds briefly, and pops
 * out. Independent of the physics loop because they don't move.
 */
function spawnSparkles(container: HTMLDivElement) {
  const count = 22
  for (let i = 0; i < count; i++) {
    const sparkle = document.createElement('div')
    const size = 5 + Math.random() * 4 // 5-9px
    // Spread across most of the viewport with mild center bias.
    const x = window.innerWidth * (0.15 + Math.random() * 0.7)
    const y = window.innerHeight * (0.2 + Math.random() * 0.55)
    Object.assign(sparkle.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      marginLeft: `${-size / 2}px`,
      marginTop: `${-size / 2}px`,
      borderRadius: '50%',
      backgroundColor: '#ffffff',
      boxShadow:
        '0 0 6px rgba(255,255,255,0.95), 0 0 12px rgba(168,85,247,0.6), 0 0 22px rgba(59,130,246,0.4)',
      pointerEvents: 'none',
      willChange: 'transform, opacity',
      zIndex: String(Z_INDEX),
      opacity: '0',
    } satisfies Partial<CSSStyleDeclaration>)
    container.appendChild(sparkle)

    const delay = Math.random() * 700 // stagger across 0-700ms
    sparkle.animate(
      [
        { transform: 'scale(0)', opacity: 0 },
        { transform: 'scale(1.4)', opacity: 1, offset: 0.3 },
        { transform: 'scale(1.1)', opacity: 1, offset: 0.6 },
        { transform: 'scale(0)', opacity: 0 },
      ],
      { duration: 480, delay, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
    )
  }
}

// ── Reduced-motion variant ─────────────────────────────────────────

/**
 * Reduced-motion fallback. No particles, no movement — just a single
 * subdued radial flash so the user still sees that something
 * succeeded. Cleans itself up after 700ms.
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
