import { TickMarkType, type Time } from 'lightweight-charts'

/** All chart clock labels use this IANA zone (US equity session context). */
export const CHART_TIME_ZONE = 'America/New_York'

function utcMsFromTime(time: Time): number | null {
  if (typeof time === 'number') return time * 1000
  if (typeof time === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(time)
    if (!m) return null
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  return Date.UTC(time.year, time.month - 1, time.day)
}

function formatNy(d: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CHART_TIME_ZONE,
    ...options,
  }).format(d)
}

/** Crosshair / time-scale hover label. */
export function nyTimeFormatter(time: Time): string {
  const ms = utcMsFromTime(time)
  if (ms == null) return ''
  const d = new Date(ms)
  return formatNy(d, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Bottom axis tick marks. */
export function nyTickMarkFormatter(
  time: Time,
  tickMarkType: TickMarkType,
): string | null {
  const ms = utcMsFromTime(time)
  if (ms == null) return null
  const d = new Date(ms)
  switch (tickMarkType) {
    case TickMarkType.Year:
      return formatNy(d, { year: 'numeric' })
    case TickMarkType.Month:
      return formatNy(d, { month: 'short', year: '2-digit' })
    case TickMarkType.DayOfMonth:
      return formatNy(d, { month: 'short', day: 'numeric' })
    case TickMarkType.Time:
      return formatNy(d, { hour: '2-digit', minute: '2-digit', hour12: false })
    case TickMarkType.TimeWithSeconds:
      return formatNy(d, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    default:
      return formatNy(d, { hour: '2-digit', minute: '2-digit', hour12: false })
  }
}
