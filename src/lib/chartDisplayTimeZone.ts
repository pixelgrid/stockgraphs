export const CHART_DISPLAY_TIMEZONES = [
  { iana: 'America/New_York', label: 'New York' },
  { iana: 'Europe/Amsterdam', label: 'Amsterdam' },
] as const

export type ChartDisplayTimeZoneIana =
  (typeof CHART_DISPLAY_TIMEZONES)[number]['iana']

export const CHART_DISPLAY_TIMEZONE_STORAGE_KEY = 'chartDisplayTimeZone'

export function isChartDisplayTimeZoneIana(
  v: string,
): v is ChartDisplayTimeZoneIana {
  return CHART_DISPLAY_TIMEZONES.some((z) => z.iana === v)
}

export function readStoredChartDisplayTimeZoneIana(): ChartDisplayTimeZoneIana {
  try {
    const v = localStorage.getItem(CHART_DISPLAY_TIMEZONE_STORAGE_KEY)?.trim()
    if (v && isChartDisplayTimeZoneIana(v)) return v
  } catch {
    /* private mode */
  }
  return 'America/New_York'
}

export function labelForChartDisplayTimeZone(
  iana: ChartDisplayTimeZoneIana,
): string {
  const z = CHART_DISPLAY_TIMEZONES.find((x) => x.iana === iana)
  return z?.label ?? iana
}
