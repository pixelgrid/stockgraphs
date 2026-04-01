import type { Time } from 'lightweight-charts'

const FALLBACK_TZ = 'America/New_York'

const testedTz = new Set<string>()

function isValidIanaTimeZone(tz: string): boolean {
  if (testedTz.has(tz)) return true
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    testedTz.add(tz)
    return true
  } catch {
    return false
  }
}

export function resolveChartTimeZone(
  ianaTimeZone: string | null | undefined,
): string {
  const raw = ianaTimeZone?.trim()
  if (raw && isValidIanaTimeZone(raw)) return raw
  return FALLBACK_TZ
}

function utcMsFromTime(time: Time): number | null {
  if (typeof time === 'number') return time * 1000
  if (typeof time === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(time)
    if (!m) return null
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  return Date.UTC(time.year, time.month - 1, time.day)
}

function formatInZone(
  d: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const tz = isValidIanaTimeZone(timeZone) ? timeZone : FALLBACK_TZ
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      ...options,
    }).format(d)
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: FALLBACK_TZ,
      hourCycle: 'h23',
      ...options,
    }).format(d)
  }
}

/** Format absolute Unix seconds (e.g. vertical line times) in a chart zone. */
export function formatUnixSecondsForDisplay(
  unixSec: number,
  timeZone: string,
): string {
  const d = new Date(unixSec * 1000)
  return formatInZone(d, timeZone, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Crosshair / time-scale hover label. */
export function exchangeTimeFormatter(timeZone: string, time: Time): string {
  const ms = utcMsFromTime(time)
  if (ms == null) return ''
  const d = new Date(ms)
  return formatInZone(d, timeZone, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Bottom axis tick marks. `tickMarkType` is {@link TickMarkType} (0–4) from lightweight-charts.
 */
export function exchangeTickMarkFormatter(
  timeZone: string,
  time: Time,
  tickMarkType: number,
): string | null {
  const ms = utcMsFromTime(time)
  if (ms == null) return null
  const d = new Date(ms)
  switch (tickMarkType) {
    case 0: // Year
      return formatInZone(d, timeZone, { year: 'numeric' })
    case 1: // Month
      return formatInZone(d, timeZone, { month: 'short', year: '2-digit' })
    case 2: // DayOfMonth
      return formatInZone(d, timeZone, { month: 'short', day: 'numeric' })
    case 3: // Time
      return formatInZone(d, timeZone, { hour: '2-digit', minute: '2-digit' })
    case 4: // TimeWithSeconds
      return formatInZone(d, timeZone, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    default:
      return formatInZone(d, timeZone, { hour: '2-digit', minute: '2-digit' })
  }
}
