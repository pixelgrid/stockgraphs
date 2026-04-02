import { isValid, parse } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { CHART_TIME_ZONE_IANA } from './chartTimeZone'
import type {
  ChartInstrumentMeta,
  IntradayChartResult,
  IntradayRange,
} from './intradayTypes'

export type { IntradayRange, ChartInstrumentMeta, IntradayChartResult }

const EXPORT_BASE = 'https://elite.finviz.com/quote_export.ashx'

/** Finviz `p`: i1 = intraday (1-minute bars). */
const TIMEFRAME = 'i1'

/** Maps app range to Finviz `r` (e.g. d1 = 1 calendar day). */
function rangeToFinvizPeriod(range: IntradayRange): string {
  switch (range) {
    case '1d':
      return 'd1'
    case '5d':
      return 'd5'
    case '7d':
      return 'd7'
    default:
      return 'd1'
  }
}

function buildExportUrl(symbol: string, range: IntradayRange, auth: string): string {
  const qs = new URLSearchParams({
    t: symbol.trim(),
    p: TIMEFRAME,
    r: rangeToFinvizPeriod(range),
    auth,
    _: String(Date.now()),
  })
  return `${EXPORT_BASE}?${qs.toString()}`
}

function parseCsvRow(line: string): string[] {
  const result: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false
  while (i < line.length) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
    } else {
      if (c === '"') {
        inQuotes = true
        i++
        continue
      }
      if (c === ',') {
        result.push(field.trim())
        field = ''
        i++
        continue
      }
      field += c
      i++
    }
  }
  result.push(field.trim())
  return result
}

function normHeader(s: string): string {
  return s.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Finviz `quote_export` often uses 24h clock hours with a redundant AM/PM suffix
 * (e.g. `04/01/2026 13:00 PM`, `04/01/2026 17:04 PM`). That breaks `hh:mm a` (hours
 * 1–12 only) and `HH:mm` (no AM/PM token), so rows after noon were skipped.
 */
function normalizeFinvizHybridAmPmDateTime(cell: string): string {
  const m =
    /^(\d{1,2}\/\d{1,2}\/\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))? (AM|PM)$/i.exec(
      cell.trim(),
    )
  if (!m) return cell.trim()
  const hour = Number(m[2])
  if (hour >= 13) {
    const sec = m[4] != null ? `:${m[4]}` : ''
    return `${m[1]} ${m[2]}:${m[3]}${sec}`
  }
  return cell.trim()
}

/** Naive CSV datetimes are interpreted as wall time in {@link CHART_TIME_ZONE_IANA}. */
function parseFlexibleDateTime(cell: string): number | null {
  const c = normalizeFinvizHybridAmPmDateTime(cell.trim())
  if (!c) return null

  if (/^\d{10}$/.test(c)) return Number(c)
  if (/^\d{13}$/.test(c)) return Math.floor(Number(c) / 1000)

  if (/z|[+-]\d{2}:?\d{2}$/i.test(c)) {
    const ms = Date.parse(c)
    if (!Number.isNaN(ms)) return Math.floor(ms / 1000)
  }

  const formats = [
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd HH:mm',
    'yyyy-MM-dd',
    'MM/dd/yyyy HH:mm:ss',
    'MM/dd/yyyy H:mm:ss',
    'MM/dd/yyyy HH:mm',
    'MM/dd/yyyy H:mm',
    'MM/dd/yyyy hh:mm:ss a',
    'MM/dd/yyyy h:mm:ss a',
    'MM/dd/yyyy hh:mm a',
    'MM/dd/yyyy h:mm a',
    'MM/dd/yyyy',
    'MMM dd, yyyy HH:mm:ss',
    'MMM dd, yyyy HH:mm',
    'MMM dd, yyyy',
    'dd/MM/yyyy HH:mm:ss',
    'dd/MM/yyyy',
  ] as const

  for (const fmt of formats) {
    try {
      const d = parse(c, fmt, new Date(0))
      if (!isValid(d)) continue
      const u = fromZonedTime(d, CHART_TIME_ZONE_IANA)
      const ms = u.getTime()
      if (Number.isNaN(ms)) continue
      return Math.floor(ms / 1000)
    } catch {
      /* try next */
    }
  }

  try {
    const u = fromZonedTime(c, CHART_TIME_ZONE_IANA)
    const ms = u.getTime()
    if (!Number.isNaN(ms)) return Math.floor(ms / 1000)
  } catch {
    /* fall through */
  }

  const ms = Date.parse(c)
  if (!Number.isNaN(ms)) return Math.floor(ms / 1000)
  return null
}

function parsePrice(s: string): number | null {
  const t = s.replace(/,/g, '').replace(/^\$/, '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

type Cols = {
  timeStrategy:
    | { kind: 'unix'; idx: number }
    | { kind: 'single'; idx: number }
    | { kind: 'date_time'; dateIdx: number; timeIdx: number }
  closeIdx: number
  openIdx: number
}

function pickTimeAndValueCols(
  headers: string[],
  sampleRow: string[] | undefined,
): Cols | null {
  const h = headers.map(normHeader)
  const closeAliases = [
    'close',
    'adj close',
    'adj. close',
    'last',
    'price',
    'close price',
    'c',
  ]
  const openAliases = ['open', 'o']

  let closeIdx = -1
  for (let i = 0; i < h.length; i++) {
    if (closeAliases.includes(h[i])) {
      closeIdx = i
      break
    }
  }
  if (closeIdx < 0) {
    for (let i = 0; i < h.length; i++) {
      if (h[i] === 'close' || h[i].endsWith('close')) {
        closeIdx = i
        break
      }
    }
  }
  if (closeIdx < 0) return null

  let openIdx = -1
  for (let i = 0; i < h.length; i++) {
    if (openAliases.includes(h[i])) {
      openIdx = i
      break
    }
  }

  const unixHeader = (name: string) =>
    name === 'unix' || name === 'unix time' || name === 'epoch'

  for (let i = 0; i < h.length; i++) {
    if (unixHeader(h[i])) {
      return { timeStrategy: { kind: 'unix', idx: i }, closeIdx, openIdx }
    }
  }

  if (sampleRow) {
    for (let i = 0; i < h.length && i < sampleRow.length; i++) {
      if (i === closeIdx || i === openIdx) continue
      const cell = sampleRow[i]?.replace(/,/g, '').trim() ?? ''
      if (/^\d{10}$/.test(cell) || /^\d{13}$/.test(cell)) {
        const v = Number(cell)
        const sec = cell.length >= 13 ? Math.floor(v / 1000) : v
        const y = new Date(sec * 1000).getUTCFullYear()
        if (y >= 1990 && y <= 2100) {
          return { timeStrategy: { kind: 'unix', idx: i }, closeIdx, openIdx }
        }
      }
    }
  }

  const dateIdx = h.indexOf('date')
  const timeIdx = h.indexOf('time')
  if (
    dateIdx >= 0 &&
    timeIdx >= 0 &&
    dateIdx !== timeIdx &&
    dateIdx !== closeIdx &&
    timeIdx !== closeIdx
  ) {
    return {
      timeStrategy: { kind: 'date_time', dateIdx, timeIdx },
      closeIdx,
      openIdx,
    }
  }

  const singleNames = [
    'datetime',
    'date/time',
    'date time',
    'timestamp',
    'index',
    'date',
  ]
  for (const name of singleNames) {
    const idx = h.indexOf(name)
    if (idx >= 0 && idx !== closeIdx && idx !== openIdx) {
      return { timeStrategy: { kind: 'single', idx }, closeIdx, openIdx }
    }
  }

  if (h.length > 0 && closeIdx !== 0) {
    return { timeStrategy: { kind: 'single', idx: 0 }, closeIdx, openIdx }
  }

  return null
}

function rowUnixTime(row: string[], cols: Cols): number | null {
  const { timeStrategy } = cols
  if (timeStrategy.kind === 'unix') {
    const cell = row[timeStrategy.idx]?.replace(/,/g, '').trim() ?? ''
    const n = Number(cell)
    if (!Number.isFinite(n)) return null
    if (cell.length >= 13 || n > 1e12) return Math.floor(n / 1000)
    return Math.floor(n)
  }
  if (timeStrategy.kind === 'single') {
    const cell = row[timeStrategy.idx]?.trim() ?? ''
    return parseFlexibleDateTime(cell)
  }
  const d = row[timeStrategy.dateIdx]?.trim() ?? ''
  const t = row[timeStrategy.timeIdx]?.trim() ?? ''
  if (!d) return null
  const combined = t ? `${d} ${t}` : d
  return parseFlexibleDateTime(combined)
}

function parseQuoteExportCsv(text: string): { time: number; value: number }[] {
  const raw = text.replace(/^\uFEFF/, '').trim()
  if (!raw) {
    throw new Error('Empty CSV from Finviz')
  }
  if (
    raw.toLowerCase().includes('invalid export api token') ||
    (raw.length < 200 && !raw.includes(','))
  ) {
    throw new Error(
      raw.length < 120 ? raw : 'Invalid Finviz export API token or access denied.',
    )
  }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    throw new Error('Finviz CSV has no data rows')
  }

  const headers = parseCsvRow(lines[0])
  const sample = parseCsvRow(lines[1])
  const cols = pickTimeAndValueCols(headers, sample)
  if (!cols) {
    throw new Error(
      `Could not detect time/close columns. Headers: ${headers.join(', ')}`,
    )
  }

  const bars: { time: number; value: number }[] = []
  for (let li = 1; li < lines.length; li++) {
    const row = parseCsvRow(lines[li])
    if (row.length < Math.max(cols.closeIdx, cols.openIdx) + 1) continue

    const t = rowUnixTime(row, cols)
    if (t == null || !Number.isFinite(t)) continue

    const close = parsePrice(row[cols.closeIdx] ?? '')
    const open =
      cols.openIdx >= 0 ? parsePrice(row[cols.openIdx] ?? '') : null
    const value = close ?? open
    if (value == null) continue

    bars.push({ time: t, value })
  }

  if (!bars.length) {
    throw new Error('No valid price rows in Finviz CSV')
  }

  bars.sort((a, b) => a.time - b.time)
  const deduped: { time: number; value: number }[] = []
  for (const b of bars) {
    const prev = deduped[deduped.length - 1]
    if (prev && prev.time === b.time) {
      deduped[deduped.length - 1] = b
    } else {
      deduped.push(b)
    }
  }
  return deduped
}

function buildMeta(symbol: string): ChartInstrumentMeta {
  const sym = symbol.trim() || '—'
  return {
    symbol: sym,
    shortName: null,
    longName: null,
    currency: null,
    exchangeName: null,
    fullExchangeName: null,
    exchangeTimezoneName: CHART_TIME_ZONE_IANA,
    exchangeTimezoneShort: null,
  }
}

/**
 * 1-minute intraday bars from Finviz Elite `quote_export.ashx` (CSV).
 * Requests always go through `corsproxy.io` because Finviz does not send CORS headers.
 * `auth` is the `auth` query value from your Elite export URL.
 * Naive datetimes in the CSV are read as US Eastern ({@link CHART_TIME_ZONE_IANA}).
 */
export async function fetchFinvizEliteIntraday(
  symbol: string,
  range: IntradayRange,
  auth: string,
  signal?: AbortSignal,
): Promise<IntradayChartResult> {
  const token = auth.trim()
  if (!token) {
    throw new Error('Missing Finviz export API token.')
  }
  const finvizUrl = buildExportUrl(symbol, range, token)
  const fetchUrl = `https://corsproxy.io/?${encodeURIComponent(finvizUrl)}`

  try {
    const res = await fetch(fetchUrl, {
      headers: { Accept: 'text/csv,*/*' },
      cache: 'no-store',
      signal,
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const text = await res.text()
    if (text.trim().toLowerCase().startsWith('invalid export')) {
      throw new Error('Invalid Finviz export API token.')
    }
    const bars = parseQuoteExportCsv(text)
    return {
      bars,
      meta: buildMeta(symbol),
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw e
    }
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `${msg}. Data is fetched via corsproxy.io only; the relay may be down or rate-limited.`,
    )
  }
}
