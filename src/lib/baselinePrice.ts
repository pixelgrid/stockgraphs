function nearestBar(
  bars: { time: number; value: number }[],
  targetSec: number,
): { time: number; value: number } | null {
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
  return best
}

/** Unix time of the bar closest to `targetSec` (ties: earlier bar in the series wins). */
export function nearestBarTime(
  bars: { time: number; value: number }[],
  targetSec: number,
): number | null {
  const b = nearestBar(bars, targetSec)
  return b?.time ?? null
}

/** Close at the bar whose time is closest to `targetSec`. */
export function valueAtNearestTime(
  bars: { time: number; value: number }[],
  targetSec: number,
): number | null {
  const b = nearestBar(bars, targetSec)
  return b?.value ?? null
}
