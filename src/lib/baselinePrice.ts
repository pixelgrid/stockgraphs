/** Close price at the 1m bar whose time is closest to `targetSec` (Unix seconds). */
export function valueAtNearestTime(
  bars: { time: number; value: number }[],
  targetSec: number,
): number | null {
  if (!bars.length || !Number.isFinite(targetSec)) return null
  let best = bars[0]
  let bestDist = Math.abs(best.time - targetSec)
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i]
    const d = Math.abs(b.time - targetSec)
    if (d < bestDist) {
      bestDist = d
      best = b
    }
  }
  return best.value
}
