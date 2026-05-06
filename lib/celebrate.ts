// Tiny wrapper around canvas-confetti for celebration moments.
// Used when a status flips to "Successful" so closing a deal feels good.
import confetti from 'canvas-confetti'

export function celebrateSuccess(originX?: number, originY?: number) {
  const x = originX != null ? originX / window.innerWidth : 0.5
  const y = originY != null ? originY / window.innerHeight : 0.6
  confetti({
    particleCount: 60,
    spread: 65,
    startVelocity: 35,
    origin: { x, y },
    colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
    scalar: 0.8,
    ticks: 120,
  })
}
