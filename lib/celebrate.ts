// celebrateSuccess — the "deal closed" moment.
//
// Design intent (2026-05-23 v5 per Dylan: "on web I feel like it
// could be better" — desktop has 5-10x the screen real estate of
// mobile, so the same burst size reads as small in proportion):
//
//   This is the single biggest dopamine moment in the whole app —
//   the user just turned a creator from a lead into a paying client.
//   Six distinct visual systems layered on top of each other:
//
//     1. Center flash      — radial gradient glow that punches in,
//                            blooms, and fades. Brand violet→teal,
//                            anchors the moment to a specific spot.
//     2. Main burst         — radial explosion of mixed-shape confetti
//                            from origin point (default screen
//                            center). Each piece has its own
//                            velocity, gravity, drag, rotation, life.
//     3. Secondary burst    — more pieces 100ms later for layered
//                            richness so the eye doesn't catch a
//                            single wave.
//     4. Streamers          — long thin ribbons shooting at higher
//                            velocity. Read as party streamers.
//     5. Sparkles           — bright white dots with violet+blue glow
//                            popping (scale 0→1.4→0) at random
//                            positions across the upper viewport,
//                            staggered 0-700ms. "Fireflies in the
//                            air" highlight that confetti can't give.
//     6. Rain wash          — additional confetti falling from above
//                            the top edge across the full viewport
//                            width with slight horizontal drift. Fills
//                            the whole screen so desktop celebrations
//                            feel proportional to viewport size, not
//                            stuck around the click point.
//
//   Particle counts scale with viewport width (sizeMultiplier 1×-2×)
//   so mobile gets the original densities and a 4K desktop gets ~2×
//   the pieces. The radial burst spreads further on desktop too.
//
// Physics:
//   requestAnimationFrame loop with real gravity, drag, and spin
//   decay. Frame-rate-aware so stutters don't teleport particles.
//
// Why no canvas-confetti library:
//   v2/v3 used it; v3 added a DOM fallback alongside; v4 dropped the
//   library entirely. Owning the whole render gives us tighter
//   control over layering, color, and physics, and eliminates the
//   mystery "fires on mobile but not desktop" behavior the library
//   exhibited in our app's z-index/overflow context.
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

  // Viewport-aware particle multiplier (v5 per Dylan: "on web I feel
  // like it could be better"). Desktop has roughly 5-10× the pixel
  // area of mobile — at fixed counts the burst gets visually thin on
  // big monitors. We scale linearly between 1× (under 900px wide,
  // i.e. mobile/tablet) and 2× (1800px+, i.e. desktop), capped at 2×
  // so a 4K monitor doesn't get a particle storm that tanks framerate.
  const sizeMultiplier = Math.min(2, Math.max(1, window.innerWidth / 900))

  // Container holds all spawned elements — single removal at the end.
  const container = makeContainer()

  // Layer 1 — center flash (always first, anchors the whole moment).
  // Scales with viewport too so it punches proportionally.
  spawnCenterFlash(container, ox, oy, sizeMultiplier)

  // Layer 5 — sparkles (staggered start, run independently of the
  // physics loop because their lifecycle is short + pop-based).
  spawnSparkles(container, sizeMultiplier)

  // Layer 6 — rain wash from above the top edge. Fills the screen
  // width on desktop so the celebration feels proportional to the
  // viewport, not stuck at the origin point. Independent of the
  // central physics loop (its own loop, own gravity tuning).
  spawnRainWash(sizeMultiplier)

  // Layers 2-4 — physics-driven particles from origin.
  const particles: Particle[] = []
  // Main burst — confetti count scales with viewport.
  const mainCount = Math.round(90 * sizeMultiplier)
  for (let i = 0; i < mainCount; i++) {
    particles.push(spawnConfetti(container, ox, oy, /* delayFrames */ 0, sizeMultiplier))
  }
  // Streamer ribbons.
  const streamerCount = Math.round(18 * sizeMultiplier)
  for (let i = 0; i < streamerCount; i++) {
    particles.push(spawnStreamer(container, ox, oy, sizeMultiplier))
  }
  // Secondary burst at +100ms.
  const secondaryCount = Math.round(35 * sizeMultiplier)
  window.setTimeout(() => {
    if (!container.isConnected) return
    for (let i = 0; i < secondaryCount; i++) {
      particles.push(spawnConfetti(container, ox, oy, 0, sizeMultiplier))
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
 *
 * Peak scale scales with the viewport multiplier so it covers a
 * proportional fraction of the screen on desktop.
 */
function spawnCenterFlash(container: HTMLDivElement, ox: number, oy: number, sizeMultiplier: number) {
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
  // Peak + final scale grow with viewport — on a desktop the flash
  // actually covers a meaningful chunk of the screen instead of being
  // a tiny pop in the center.
  const peakScale = 22 * sizeMultiplier
  const finalScale = peakScale * 1.3
  flash.animate(
    [
      { transform: 'scale(0)', opacity: 0 },
      { transform: `scale(${peakScale * 0.35})`, opacity: 1, offset: 0.18 },
      { transform: `scale(${peakScale})`, opacity: 0.55, offset: 0.55 },
      { transform: `scale(${finalScale})`, opacity: 0 },
    ],
    { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
  )
}

// ── Confetti pieces ────────────────────────────────────────────────

/**
 * Spawn one confetti particle. Mixed shape (rectangle / square /
 * circle), mixed size, mixed color. Radial launch direction with
 * randomized speed.
 *
 * `sizeMultiplier` boosts initial velocity so pieces travel further
 * on wider viewports — keeps the burst proportional to screen size.
 */
function spawnConfetti(
  container: HTMLDivElement,
  ox: number,
  oy: number,
  delayFrames: number,
  sizeMultiplier: number,
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
  // before gravity pulls it down. Speed scales with viewport size so
  // desktop pieces travel further (proportional to screen).
  const angle = Math.random() * Math.PI * 2
  const speed = (6 + Math.random() * 10) * sizeMultiplier // 6-16 px/frame, scaled
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
function spawnStreamer(container: HTMLDivElement, ox: number, oy: number, sizeMultiplier: number): Particle {
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
  // Faster than confetti — scaled by viewport so desktop streamers
  // travel proportionally further before gravity wins.
  const speed = (11 + Math.random() * 9) * sizeMultiplier // 11-20 px/frame, scaled
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
 *
 * Count scales with viewport so desktop gets more fireflies
 * (proportional to screen area).
 */
function spawnSparkles(container: HTMLDivElement, sizeMultiplier: number) {
  const count = Math.round(22 * sizeMultiplier)
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

// ── Rain wash (Layer 6 — added v5 for desktop) ─────────────────────

/**
 * Rain wash — additional confetti pieces falling from above the top
 * edge of the viewport across the full screen width, with a slight
 * side-to-side wobble. Fills the entire viewport area so desktop
 * celebrations feel proportional to screen size rather than stuck
 * near the click origin.
 *
 * Implementation choice:
 *   This layer runs in its own container + its own physics loop,
 *   independent of the central burst. Gravity is gentler (so pieces
 *   fall in a leisurely cascade) and pieces start above the viewport
 *   (negative y) so they enter from the top edge naturally instead
 *   of "popping in."
 *
 *   On mobile this adds 30-ish pieces falling across a narrow screen
 *   — still nice. On desktop the same code scales to ~60 pieces
 *   spread across a 1920px-wide screen — totally different visual
 *   weight, same code path.
 *
 *   The container is removed when the last piece falls off the
 *   bottom or reaches end of life.
 */
function spawnRainWash(sizeMultiplier: number) {
  const container = makeContainer()
  const count = Math.round(30 * sizeMultiplier)
  const RAIN_GRAVITY = 0.18 // gentler than the central burst — leisurely fall
  const PIECE_LIFE = 200 // ~3.3s @ 60fps, longer than central pieces

  interface RainPiece {
    el: HTMLDivElement
    x: number
    y: number
    vx: number
    vy: number
    /** Sine-wave amplitude for side-to-side flutter as it falls. */
    swayAmp: number
    /** Phase offset for the sway so pieces don't all flutter in sync. */
    swayPhase: number
    /** Frequency of the sway (radians/frame). */
    swayFreq: number
    rotation: number
    spin: number
    life: number
  }

  const pieces: RainPiece[] = []
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
    // Same shape mix as the central burst — keeps the visual language
    // consistent across both layers.
    const shapeRoll = Math.random()
    let width: number
    let height: number
    let borderRadius: string
    if (shapeRoll < 0.5) {
      width = 5 + Math.random() * 4 // 5-9px
      height = width * (1.6 + Math.random() * 0.6)
      borderRadius = '1.5px'
    } else if (shapeRoll < 0.85) {
      const s = 6 + Math.random() * 4
      width = s
      height = s
      borderRadius = '2px'
    } else {
      const s = 5 + Math.random() * 3
      width = s
      height = s
      borderRadius = '50%'
    }

    // Random x across full viewport width. Y starts ABOVE the
    // viewport (negative) so they enter naturally with stagger.
    const startX = Math.random() * window.innerWidth
    const startY = -50 - Math.random() * 200 // up to 250px above viewport

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
      boxShadow: `0 0 0 0.5px ${color}, 0 0 4px ${hexWithAlpha(color, 0.25)}`,
      zIndex: String(Z_INDEX),
    } satisfies Partial<CSSStyleDeclaration>)
    container.appendChild(el)

    pieces.push({
      el,
      x: startX,
      y: startY,
      // Slight initial vx for organic drift.
      vx: (Math.random() - 0.5) * 1.2,
      // Initial downward velocity so pieces start moving immediately.
      vy: 1.5 + Math.random() * 1.5,
      swayAmp: 0.3 + Math.random() * 0.5, // px peak swing per frame
      swayPhase: Math.random() * Math.PI * 2,
      swayFreq: 0.05 + Math.random() * 0.04, // radians/frame — slow wobble
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 8, // -4 to +4 deg/frame, slower than burst
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

      // Physics: gravity, drag, plus a sine-wave horizontal sway.
      p.vy += RAIN_GRAVITY * dt
      p.vx *= Math.pow(0.99, dt)
      const sway = Math.sin(frame * p.swayFreq + p.swayPhase) * p.swayAmp
      p.x += (p.vx + sway) * dt
      p.y += p.vy * dt
      p.rotation += p.spin * dt

      // Fade across last 30% of life or as it leaves bottom.
      const ageRatio = 1 - p.life / PIECE_LIFE
      let opacity = 1
      if (ageRatio > 0.7) {
        opacity = Math.max(0, 1 - (ageRatio - 0.7) / 0.3)
      }
      // Also fade if approaching viewport bottom — feels natural.
      const distFromBottom = window.innerHeight - p.y
      if (distFromBottom < 60) {
        opacity = Math.min(opacity, Math.max(0, distFromBottom / 60))
      }

      p.el.style.transform = `translate3d(${p.x - parseFloat(p.el.style.left)}px, ${p.y - parseFloat(p.el.style.top)}px, 0) rotate(${p.rotation}deg)`
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
