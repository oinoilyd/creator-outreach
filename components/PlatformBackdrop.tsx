'use client'

/**
 * PlatformBackdrop — animated theme layer (Rain / Drift / Fireworks).
 *
 * 2026-05-10 v5 per Dylan:
 *   • Fireworks is now spotlight-only — a phased ONE-SHOT 15-second
 *     show that auto-triggers when the user picks the theme. Phases:
 *       0–9s   scattered bursts at random points
 *       9–12s  ramp-up — bursts come faster and bigger
 *       12–15s GRAND FINALE — simultaneous mega-bursts ending with
 *              a "Creator Outreach" text easter-egg pop-up.
 *     If theme === 'fireworks' but spotlight is off, the whole layer
 *     returns null (no continuous loop). Re-trigger via the spotlight
 *     button or by re-selecting Fireworks.
 *
 * Earlier (v4):
 *   • Re-key INNER layer on platform change so icons restart with the
 *     new color/shape (dark-mode reads needed the fresh wave).
 *   • Icon counts boosted (rain 22→36, drift 12→20).
 *   • New `spotlight` prop. Renders the layer at high opacity ABOVE
 *     all content for 15 seconds, then parent flips back. Pointer
 *     events stay none so the spotlight doesn't block clicks.
 */

import { useMemo } from 'react'
import { motion } from 'motion/react'
import type { PlatformId } from '@/lib/types'
import {
  type BackdropTheme,
  PLATFORM_HUES,
  PLATFORM_ICON_PATH,
} from '@/lib/backdrop-themes'

interface Props {
  theme: BackdropTheme
  platform: PlatformId
  visible?: boolean
  /** Momentary burst — render IN FRONT of content (z-50) at full
   *  saturation. Parent times the window and flips back. This is
   *  also the gate for one-shot themes (Fireworks/Tornado) — they
   *  only mount + animate when this is true. */
  spotlight?: boolean
  /** Persistent visual intensity boost. When true (without `spotlight`),
   *  Rain/Drift render at boosted opacity but stay BEHIND content
   *  (z-0). Doesn't affect one-shot themes' play behavior. Default
   *  enabled via the theme settings popover. */
  intense?: boolean
}

// Opacity multipliers — spotlight cranks every icon's visibility
// way up so the effect reads at 'full color' as Dylan requested.
const SPOTLIGHT_OPACITY_MULT = 6
const SPOTLIGHT_SCALE = 1.15

export function PlatformBackdrop({ theme, platform, visible = true, spotlight = false, intense = false }: Props) {
  if (theme === 'off') return null
  // Fireworks + Tornado are one-shot spotlight-only shows. Gate ONLY
  // on `spotlight` (momentary burst), not `intense` — so the always-on
  // visual boost doesn't auto-mount the show on every render.
  if ((theme === 'fireworks' || theme === 'tornado') && !spotlight) return null
  const hue = PLATFORM_HUES[platform]
  const iconPath = PLATFORM_ICON_PATH[platform]
  // Effective visual intensity — burst OR persistent always-on.
  const boosted = spotlight || intense

  return (
    <div
      key={theme}
      aria-hidden
      className="fixed inset-0 pointer-events-none overflow-hidden transition-opacity ease-out"
      style={{
        // Spotlight pushes the layer above content (z-50). Otherwise
        // stays at z-0 in the background.
        zIndex: spotlight ? 50 : 0,
        opacity: visible ? 1 : 0,
        transitionDuration: visible ? '300ms' : '1500ms',
      }}
    >
      {/* Inner layer keyed on platform — forces a clean restart of
          icons with the new color/shape when user switches platforms.
          Otherwise existing icons stay mid-flight and the color
          change is subtle (especially in dark mode where the brand
          hues read more similar). */}
      <div key={platform}>
        {theme === 'rain' && <RainLayer color={hue.color} iconPath={iconPath} boosted={boosted} />}
        {theme === 'drift' && <DriftLayer color={hue.color} iconPath={iconPath} boosted={boosted} />}
        {theme === 'fireworks' && <FireworksShow color={hue.color} iconPath={iconPath} />}
        {theme === 'tornado' && <TornadoShow color={hue.color} iconPath={iconPath} />}
      </div>
    </div>
  )
}

// ── Rain ─────────────────────────────────────────────────────────────

function RainLayer({ color, iconPath, boosted }: { color: string; iconPath: string; boosted: boolean }) {
  const drops = useMemo(() => {
    const N = 36 // bumped from 22 — denser feel per Dylan
    return Array.from({ length: N }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      size: 14 + Math.floor(Math.random() * 18),
      delay: Math.random() * 14,
      duration: 11 + Math.random() * 16,
      opacity: 0.05 + Math.random() * 0.07,
    }))
  }, [])

  return (
    <>
      {drops.map(d => {
        const op = Math.min(1, d.opacity * (boosted ? SPOTLIGHT_OPACITY_MULT : 1))
        const size = d.size * (boosted ? SPOTLIGHT_SCALE : 1)
        return (
          <motion.svg
            key={d.key}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill={color}
            initial={{ y: '-15vh', opacity: 0 }}
            animate={{ y: '115vh', opacity: [0, op, op, 0] }}
            transition={{
              duration: d.duration,
              delay: d.delay,
              repeat: Infinity,
              ease: 'linear',
              times: [0, 0.1, 0.9, 1],
            }}
            style={{ position: 'absolute', left: `${d.left}%`, willChange: 'transform, opacity' }}
          >
            <path d={iconPath} />
          </motion.svg>
        )
      })}
    </>
  )
}

// ── Drift ────────────────────────────────────────────────────────────

function DriftLayer({ color, iconPath, boosted }: { color: string; iconPath: string; boosted: boolean }) {
  const bubbles = useMemo(() => {
    const N = 20 // bumped from 12 — denser feel
    return Array.from({ length: N }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      size: 24 + Math.floor(Math.random() * 22),
      delay: Math.random() * 22,
      duration: 22 + Math.random() * 18,
      sway: 30 + Math.random() * 50,
      opacity: 0.04 + Math.random() * 0.06,
    }))
  }, [])

  return (
    <>
      {bubbles.map(b => {
        const op = Math.min(1, b.opacity * (boosted ? SPOTLIGHT_OPACITY_MULT : 1))
        const size = b.size * (boosted ? SPOTLIGHT_SCALE : 1)
        return (
          <motion.svg
            key={b.key}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill={color}
            initial={{ y: '115vh', x: 0, opacity: 0 }}
            animate={{
              y: '-15vh',
              x: [0, b.sway / 2, -b.sway / 2, b.sway / 2, 0],
              opacity: [0, op, op, 0],
            }}
            transition={{
              duration: b.duration,
              delay: b.delay,
              repeat: Infinity,
              ease: 'linear',
              times: [0, 0.2, 0.5, 0.8, 1],
            }}
            style={{ position: 'absolute', left: `${b.left}%`, willChange: 'transform, opacity' }}
          >
            <path d={iconPath} />
          </motion.svg>
        )
      })}
    </>
  )
}

// ── Fireworks (one-shot 15s phased show) ────────────────────────────

/**
 * Phased fireworks show with three acts.
 *
 *   Act 1 (0–9s):    scattered bursts at random points — sparse so
 *                    the user can take it in and see the icons clearly.
 *   Act 2 (9–12s):   ramp — bursts come faster, scaled up slightly,
 *                    building pressure into the finale.
 *   Act 3 (12–14s):  GRAND FINALE — six near-simultaneous bursts
 *                    spread across the screen + one mega-burst dead
 *                    center.
 *   Easter egg (13–15s): "Creator Outreach" text drops in, peaks at
 *                    ~14s with platform-color glow, fades by 15s.
 *
 * No `repeat: Infinity` — every motion element plays exactly once,
 * so the layer goes idle after 15s. Parent clears spotlight at that
 * point and the whole layer returns null (gate at top of component).
 */
function FireworksShow({ color, iconPath }: { color: string; iconPath: string }) {
  // 2026-05-10 v3 per Dylan: another 3s off the build-up. Scattered
  // tightened from 4s → 1.5s, ramp from 3s → 1.5s. Finale shape +
  // easter-egg ending unchanged — same 6 bursts at the same relative
  // spacing, just sliding earlier again. Total now 8.5s (was 11.5,
  // originally 16.5).
  const bursts = useMemo(
    () => [
      // Act 1 — scattered (0.2–1.7s)
      { id: 's1', cx: 25, cy: 30, delay: 0.2, scale: 1.0 },
      { id: 's2', cx: 70, cy: 45, delay: 0.5, scale: 1.0 },
      { id: 's3', cx: 45, cy: 22, delay: 0.8, scale: 1.0 },
      { id: 's4', cx: 80, cy: 60, delay: 1.1, scale: 1.0 },
      { id: 's5', cx: 20, cy: 65, delay: 1.4, scale: 1.0 },
      { id: 's6', cx: 55, cy: 50, delay: 1.7, scale: 1.05 },
      // Act 2 — ramp (2.0–3.5s)
      { id: 'r1', cx: 35, cy: 35, delay: 2.0, scale: 1.15 },
      { id: 'r2', cx: 65, cy: 38, delay: 2.5, scale: 1.15 },
      { id: 'r3', cx: 50, cy: 60, delay: 3.0, scale: 1.2  },
      { id: 'r4', cx: 28, cy: 50, delay: 3.5, scale: 1.2  },
      // Act 3 — grand finale (4.5–5.4s) — UNCHANGED RELATIVE SPACING,
      // just shifted earlier. Same climactic feel.
      { id: 'f1', cx: 25, cy: 40, delay: 4.5, scale: 1.5  },
      { id: 'f2', cx: 75, cy: 40, delay: 4.6, scale: 1.5  },
      { id: 'f3', cx: 35, cy: 70, delay: 4.8, scale: 1.45 },
      { id: 'f4', cx: 65, cy: 70, delay: 4.9, scale: 1.45 },
      { id: 'f5', cx: 50, cy: 22, delay: 5.1, scale: 1.5  },
      { id: 'f6', cx: 50, cy: 50, delay: 5.4, scale: 1.85 }, // dead-center capper
    ],
    [],
  )

  const particles = useMemo(() => {
    return bursts.flatMap(burst =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.35
        const distance = 14 + Math.random() * 18
        return {
          key: `${burst.id}-${i}`,
          burst,
          dx: Math.cos(angle) * distance * burst.scale,
          dy: Math.sin(angle) * distance * burst.scale,
          size: (16 + Math.floor(Math.random() * 10)) * burst.scale,
        }
      }),
    )
  }, [bursts])

  return (
    <>
      {particles.map(p => (
        <motion.svg
          key={p.key}
          viewBox="0 0 24 24"
          width={p.size}
          height={p.size}
          fill={color}
          initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
          animate={{
            x: `${p.dx}vmin`,
            y: `${p.dy}vmin`,
            scale: [0, 1.2, 0.9, 0],
            opacity: [0, 0.95, 0.6, 0],
          }}
          transition={{
            duration: 1.5,
            delay: p.burst.delay,
            ease: 'easeOut',
            times: [0, 0.18, 0.55, 1],
          }}
          style={{
            position: 'absolute',
            left: `${p.burst.cx}%`,
            top: `${p.burst.cy}%`,
            transformOrigin: 'center',
            willChange: 'transform, opacity',
          }}
        >
          <path d={iconPath} />
        </motion.svg>
      ))}

      {/* Easter-egg text — drops in during the finale, gentle spring
          rise, holds visible for ~1.8s, then fades. x/y translate
          stays at -50% throughout so framer's `scale` keyframes don't
          clobber the centering. Per Dylan 2026-05-10 v2: gentler
          overshoot (1.08 vs 1.18) + long hold for readability. v4:
          delay slid 8.0 → 5.0 to match the further-trimmed timeline;
          ends at 8.5s just as spotlight clears. */}
      <CreatorOutreachEasterEgg color={color} delay={5.0} />
    </>
  )
}

// ── Easter-egg text component (shared by Fireworks + Tornado) ───────

function CreatorOutreachEasterEgg({ color, delay }: { color: string; delay: number }) {
  return (
    <motion.div
      aria-hidden
      initial={{ x: '-50%', y: '-50%', scale: 0.35, opacity: 0 }}
      animate={{
        x: '-50%',
        y: '-50%',
        scale: [0.35, 1.08, 1.0, 1.0, 0.98],
        opacity: [0, 1, 1, 1, 0],
      }}
      transition={{
        duration: 3.5,
        delay,
        // Per-segment easing — soft overshoot, gentle settle, linear
        // hold (no drift), easeIn for the fade so it 'closes' rather
        // than evaporates.
        ease: ['easeOut', 'easeInOut', 'linear', 'easeIn'],
        times: [0, 0.18, 0.32, 0.85, 1],
      }}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        willChange: 'transform, opacity',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color,
          textShadow: `0 0 24px ${color}, 0 0 56px ${color}, 0 0 96px ${color}`,
          whiteSpace: 'nowrap',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Creator Outreach
      </div>
    </motion.div>
  )
}

// ── Tornado (one-shot two-pass funnel, NO easter egg) ───────────────

/**
 * Iconic tornado: WIDE funnel cloud at the top, taper down to a
 * narrow tail at the bottom. Sweeps the page L→R, pause, R→L, fade.
 * No easter-egg text — that's Fireworks-only.
 *
 * Timeline (~11.5s):
 *   0.0–4.5s   pass 1 (L→R)
 *   4.5–5.5s   pause at the right edge
 *   5.5–10.5s  pass 2 (R→L)
 *   10.5–11.5s fade out at the left
 *
 * Shape (per Dylan 2026-05-10 v3 — flipped from v2):
 *   • Top (5vh):  orbit radius ~110px → wide funnel cloud
 *   • Middle:     tapers steeply via power curve
 *   • Bottom (83vh): orbit radius ~10px → narrow tail
 *   • Density bias toward the top so the cloud has visual weight.
 *
 * Effects:
 *   • Rotating cloud blob at the top (radial gradient, scales)
 *   • TWO vertical wind-streak layers at different blurs for depth
 *   • Per-icon drop-shadow + 0.3px blur → motion smear / depth
 *   • Orbital sweep (cos + sin) → real circular motion, not wobble
 *   • Pulsing ground shadow ellipse + dust cloud
 *   • Debris streaming out + upward from the spine
 */
function TornadoShow({ color, iconPath }: { color: string; iconPath: string }) {
  const icons = useMemo(() => {
    const N = 62
    return Array.from({ length: N }, (_, i) => {
      // Cubic bias toward the top — funnel cloud volume sits up top.
      const r = Math.random()
      const yT = r * r * r // small → small (concentrated at top)
      const y = 5 + yT * 78 // 5–83vh
      // Taper: 0 at top (WIDE), 1 at bottom (NARROW). Power curve for
      // dramatic flare in the upper portion (the funnel cloud).
      const taper = (y - 5) / 78
      const orbitRadius = 10 + Math.pow(1 - taper, 1.3) * 105 // 10–115px
      // Vertical wobble — small fraction of orbit radius so swirl
      // reads as 3-D orbital, not just horizontal.
      const yWobble = orbitRadius * 0.28
      // Size taper — bigger at the wide top.
      const size = 12 + (1 - taper) * 20 + Math.floor(Math.random() * 5)
      // Swirl period — top sweeps slower (majestic cloud roll), bottom
      // spins faster (tight tail whip).
      const period = 0.5 + taper * 0.5 + Math.random() * 0.25
      const phase = Math.random() * Math.PI * 2
      // Opacity — top more solid (visible cloud), bottom ghostier.
      const op = 0.55 + (1 - taper) * 0.4
      return { key: i, y, orbitRadius, yWobble, size, period, phase, op }
    })
  }, [])

  // Debris — small icons flung from the spine + drifting upward,
  // distributed across the mid-section where the tornado interacts
  // with its surroundings.
  const debris = useMemo(() => {
    return Array.from({ length: 22 }, (_, i) => ({
      key: `d${i}`,
      y: 25 + Math.random() * 58, // mid-to-bottom of the column
      offsetX: -60 + Math.random() * 120,
      size: 8 + Math.random() * 7,
      period: 0.9 + Math.random() * 0.8,
      verticalDrift: 35 + Math.random() * 75,
      delay: Math.random() * 1.5,
      op: 0.28 + Math.random() * 0.3,
    }))
  }, [])

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: '100vh',
        willChange: 'transform, opacity',
      }}
      // Two-pass back-and-forth on a unified 6-keyframe timeline.
      //   0      fade in, still at left (off-screen)
      //   0.04   visible, beginning pass 1
      //   0.42   arrived at right edge
      //   0.50   pause at right
      //   0.92   arrived back at left
      //   1.0    faded out
      animate={{
        x: ['-16vw', '-16vw', '108vw', '108vw', '-16vw', '-16vw'],
        opacity: [0, 1, 1, 1, 1, 0],
      }}
      transition={{
        duration: 11.5,
        times: [0, 0.04, 0.42, 0.50, 0.92, 1],
        ease: ['linear', 'easeInOut', 'linear', 'easeInOut', 'easeOut'],
      }}
    >
      {/* Funnel cloud — rotating ellipsoidal blob at the top, blurred
          heavily so it reads as a cloud. Scales with the gust pulse. */}
      <motion.div
        animate={{ rotate: [0, 360], scale: [1, 1.08, 1] }}
        transition={{
          rotate: { duration: 2.4, repeat: Infinity, ease: 'linear' },
          scale: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
        }}
        style={{
          position: 'absolute',
          left: '-120px',
          top: '0vh',
          width: '240px',
          height: '18vh',
          background: `radial-gradient(ellipse at 50% 70%, ${color}55 0%, ${color}28 35%, ${color}12 60%, transparent 85%)`,
          filter: 'blur(18px)',
          transformOrigin: 'center 80%',
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      />

      {/* Wide soft streak — outer layer, very blurred, low opacity,
          gives depth behind the column. */}
      <motion.div
        animate={{ opacity: [0.12, 0.22, 0.14, 0.20, 0.12] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: '-18px',
          top: '8vh',
          width: '36px',
          height: '78vh',
          background: `linear-gradient(to bottom, ${color}80 0%, ${color}60 50%, transparent 100%)`,
          filter: 'blur(22px)',
          willChange: 'opacity',
          pointerEvents: 'none',
        }}
      />

      {/* Tight inner streak — sharper line down the spine. */}
      <motion.div
        animate={{ opacity: [0.25, 0.45, 0.28, 0.42, 0.25] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: '-3px',
          top: '12vh',
          width: '6px',
          height: '72vh',
          background: `linear-gradient(to bottom, transparent 0%, ${color} 30%, ${color} 70%, transparent 100%)`,
          filter: 'blur(8px)',
          willChange: 'opacity',
          pointerEvents: 'none',
        }}
      />

      {/* Ground shadow — wide ellipse at the base. Scales horizontally
          on a loop so the base looks like it's pulsing with the gust. */}
      <motion.div
        animate={{ scaleX: [1, 1.22, 0.88, 1.22, 1] }}
        transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: '-100px',
          top: '83vh',
          width: '200px',
          height: '28px',
          background: `radial-gradient(ellipse at center, ${color}66 0%, ${color}30 40%, transparent 75%)`,
          filter: 'blur(8px)',
          transformOrigin: 'center',
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      />

      {/* Dust cloud at base — rises slowly, fades to transparent. */}
      <motion.div
        animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.18, 0.32, 0.18] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: '-70px',
          top: '78vh',
          width: '140px',
          height: '10vh',
          background: `radial-gradient(ellipse at 50% 90%, ${color}40 0%, ${color}18 50%, transparent 80%)`,
          filter: 'blur(14px)',
          transformOrigin: 'center bottom',
          willChange: 'transform, opacity',
          pointerEvents: 'none',
        }}
      />

      {/* Core swirl — 62 icons orbiting the spine. */}
      {icons.map(ic => {
        // Start positions on the orbit (cos/sin of phase).
        const sx = Math.cos(ic.phase) * ic.orbitRadius
        const sy = Math.sin(ic.phase) * ic.yWobble
        return (
          <motion.svg
            key={ic.key}
            viewBox="0 0 24 24"
            width={ic.size}
            height={ic.size}
            fill={color}
            // 4-step orbital cycle: cos & sin together → real circular
            // sweep instead of just a horizontal wobble.
            animate={{
              x: [sx, ic.orbitRadius, -sx, -ic.orbitRadius, sx],
              y: [sy, ic.yWobble, -sy, -ic.yWobble, sy],
              rotate: [0, 360],
            }}
            transition={{
              duration: ic.period,
              repeat: Infinity,
              ease: 'linear', // linear keeps the orbit smooth (no pulsing)
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: `${ic.y}vh`,
              opacity: ic.op,
              transformOrigin: 'center',
              filter: `drop-shadow(0 2px 6px ${color}aa) blur(0.3px)`,
              willChange: 'transform, opacity',
            }}
          >
            <path d={iconPath} />
          </motion.svg>
        )
      })}

      {/* Debris — small icons shedding off the tornado, drifting up
          and outward. Each one fades as it rises. */}
      {debris.map(d => (
        <motion.svg
          key={d.key}
          viewBox="0 0 24 24"
          width={d.size}
          height={d.size}
          fill={color}
          animate={{
            x: [0, d.offsetX, d.offsetX * 1.4],
            y: [0, -d.verticalDrift * 0.5, -d.verticalDrift],
            rotate: [0, 540],
            opacity: [0, d.op, 0],
          }}
          transition={{
            duration: d.period,
            delay: d.delay,
            repeat: Infinity,
            ease: 'easeOut',
            times: [0, 0.5, 1],
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: `${d.y}vh`,
            filter: 'blur(0.6px)',
            willChange: 'transform, opacity',
          }}
        >
          <path d={iconPath} />
        </motion.svg>
      ))}
    </motion.div>
  )
}
