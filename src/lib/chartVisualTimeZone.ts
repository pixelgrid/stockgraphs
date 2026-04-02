/** Display-only zones for axis / crosshair / labels (bar data stays Unix UTC). */
export const CHART_VISUAL_TIME_ZONES = [
  { iana: 'America/New_York' as const, shortLabel: 'NY', fullLabel: 'New York' },
  { iana: 'Europe/Amsterdam' as const, shortLabel: 'AMS', fullLabel: 'Amsterdam' },
] as const

export type ChartVisualTimeZoneIana =
  (typeof CHART_VISUAL_TIME_ZONES)[number]['iana']

export const CHART_VISUAL_TZ_STORAGE_KEY = 'chartVisualTimeZone'

export function isChartVisualTimeZoneIana(
  v: string,
): v is ChartVisualTimeZoneIana {
  return CHART_VISUAL_TIME_ZONES.some((z) => z.iana === v)
}

export function readStoredChartVisualTimeZone(): ChartVisualTimeZoneIana {
  try {
    const raw = localStorage.getItem(CHART_VISUAL_TZ_STORAGE_KEY)?.trim()
    if (raw && isChartVisualTimeZoneIana(raw)) return raw
  } catch {
    /* private mode */
  }
  return 'America/New_York'
}

export function fullLabelForVisualZone(
  iana: ChartVisualTimeZoneIana,
): string {
  const z = CHART_VISUAL_TIME_ZONES.find((x) => x.iana === iana)
  return z?.fullLabel ?? iana
}
