// Tiny wrapper around canvas-confetti for celebration moments.
// Used when a status flips to "Successful" so closing a deal feels good.
//
// 2026-05-23 per Dylan: desktop wasn't getting the same celebratory
// punch as mobile (same code path, different viewport — 60 particles
// from a single origin gets lost on a 1920px desktop). Rebalanced to
// hit at desktop scale:
//   • Particle count bumped 60 → 140 across two side-by-side bursts
//     so the spread covers more of the viewport.
//   • zIndex pinned to 9999 so the confetti canvas renders above any
//     spotlight/Tornado backdrop layers (which sit around z-40–60).
//   • Mobile still gets the same impact because the bursts overlap
//     into one visually-united shower at small widths.
import confetti from 'canvas-confetti'

export function celebrateSuccess(originX?: number, originY?: number) {
  // When a specific origin is passed (e.g. button-click coordinates),
  // fire a focused single burst from that point. Otherwise fan two
  // side-by-side bursts across the lower-middle of the viewport so
  // desktop users actually see the celebration.
  if (originX != null && originY != null) {
    confetti({
      particleCount: 80,
      spread: 75,
      startVelocity: 38,
      origin: { x: originX / window.innerWidth, y: originY / window.innerHeight },
      colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
      scalar: 0.9,
      ticks: 150,
      zIndex: 9999,
    })
    return
  }

  // Default twin-burst pattern — covers desktop screen real estate
  // while still reading as one shower on mobile (the two cones
  // overlap when the viewport is narrow).
  const base = {
    particleCount: 70,
    spread: 70,
    startVelocity: 38,
    colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
    scalar: 0.95,
    ticks: 150,
    zIndex: 9999,
  }
  // Left burst — angled slightly to the right.
  confetti({ ...base, origin: { x: 0.35, y: 0.65 }, angle: 75 })
  // Right burst — angled slightly to the left, fired 60ms later so
  // they don't perfectly sync. Reads as one continuous celebration.
  setTimeout(() => {
    confetti({ ...base, origin: { x: 0.65, y: 0.65 }, angle: 105 })
  }, 60)
}
