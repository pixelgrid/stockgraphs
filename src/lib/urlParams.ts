import type { ChartSeriesKind } from '../types/chart'
import type { IntradayRange } from './intradayTypes'

const RANGES: IntradayRange[] = ['1d', '5d', '7d']

function isRange(s: string): s is IntradayRange {
  return RANGES.includes(s as IntradayRange)
}

/** Seconds since Unix epoch; values > 1e12 treated as milliseconds. */
export function normalizeTimestamp(raw: string): number | null {
  const n = Number(raw.trim())
  if (!Number.isFinite(n)) return null
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n)
}

export function parseLinesFromSearch(search: string): number[] {
  const params = new URLSearchParams(search)
  const raw =
    params.get('lines') ??
    params.get('at') ??
    params.get('timestamps') ??
    params.get('t')
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map(normalizeTimestamp)
    .filter((t): t is number => t != null && t > 0)
}

export function parseSymbolFromSearch(search: string): string {
  const params = new URLSearchParams(search)
  return (params.get('symbol') ?? params.get('ticker') ?? 'AAPL').trim() || 'AAPL'
}

export function parseRangeFromSearch(search: string): IntradayRange {
  const params = new URLSearchParams(search)
  const r = params.get('range') ?? '1d'
  return isRange(r) ? r : '1d'
}

export function parseChartSeriesKindFromSearch(search: string): ChartSeriesKind {
  const params = new URLSearchParams(search)
  const v = (
    params.get('view') ??
    params.get('chart') ??
    params.get('mode') ??
    ''
  ).toLowerCase()
  return v === 'baseline' ? 'baseline' : 'line'
}
