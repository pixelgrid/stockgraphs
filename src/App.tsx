import { useCallback, useEffect, useMemo, useState } from 'react'
import { StockChart } from './components/StockChart'
import {
  fetchFinvizEliteIntraday,
  type ChartInstrumentMeta,
  type IntradayChartResult,
  type IntradayRange,
} from './lib/finvizElite'
import { nearestBarTime, valueAtNearestTime } from './lib/baselinePrice'
import {
  CHART_VISUAL_TIME_ZONES,
  CHART_VISUAL_TZ_STORAGE_KEY,
  fullLabelForVisualZone,
  readStoredChartVisualTimeZone,
  type ChartVisualTimeZoneIana,
} from './lib/chartVisualTimeZone'
import { formatUnixSecondsForDisplay } from './lib/exchangeTimeFormat'
import {
  parseChartSeriesKindFromSearch,
  parseLinesFromSearch,
  parseRangeFromSearch,
  parseSymbolFromSearch,
} from './lib/urlParams'
import type { ChartSeriesKind } from './types/chart'

type ThemeMode = 'light' | 'dark'

const FINVIZ_AUTH_STORAGE_KEY = 'finvizQuoteExportAuth'

function readStoredFinvizAuth(): string {
  try {
    return localStorage.getItem(FINVIZ_AUTH_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function readStoredTheme(): ThemeMode | null {
  const v = localStorage.getItem('theme')
  if (v === 'light' || v === 'dark') return v
  return null
}

function applyDomTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === 'AbortError') ||
    (e instanceof Error && e.name === 'AbortError')
  )
}

const CHART_LIGHT = {
  bg: '#fafafa',
  text: '#6b7280',
  grid: '#e8e8e8',
  border: '#e5e5e5',
  line: '#2563eb',
  crosshair: '#9ca3af',
  vline: 'rgba(22, 163, 74, 0.65)',
  baselineTopFill1: 'rgba(37, 99, 235, 0.28)',
  baselineTopFill2: 'rgba(37, 99, 235, 0.05)',
  baselineBottomFill1: 'rgba(220, 38, 38, 0.06)',
  baselineBottomFill2: 'rgba(220, 38, 38, 0.26)',
  baselineBelowLine: '#dc2626',
}

const CHART_DARK = {
  bg: '#13141a',
  text: '#9ca3af',
  grid: '#2a2d36',
  border: '#2e303a',
  line: '#60a5fa',
  crosshair: '#6b7280',
  vline: 'rgba(74, 222, 128, 0.7)',
  baselineTopFill1: 'rgba(96, 165, 250, 0.28)',
  baselineTopFill2: 'rgba(96, 165, 250, 0.05)',
  baselineBottomFill1: 'rgba(248, 113, 113, 0.08)',
  baselineBottomFill2: 'rgba(248, 113, 113, 0.28)',
  baselineBelowLine: '#f87171',
}

function formatLinesForUrl(lines: number[]): string {
  return lines.join(',')
}

/** Company / short title next to the ticker; null if only the symbol is known. */
function companyNameBesideSymbol(meta: ChartInstrumentMeta): string | null {
  const name = meta.shortName?.trim() || meta.longName?.trim() || null
  if (!name || name.toUpperCase() === meta.symbol.toUpperCase()) return null
  return name
}

function ChartInstrumentHeader({
  meta,
  visualTimeZoneIana,
}: {
  meta: ChartInstrumentMeta
  visualTimeZoneIana: ChartVisualTimeZoneIana
}) {
  const company = companyNameBesideSymbol(meta)
  const venue = meta.fullExchangeName ?? meta.exchangeName
  const sub = [venue, meta.currency].filter(Boolean).join(' · ')
  const viz = fullLabelForVisualZone(visualTimeZoneIana)

  return (
    <div className="chart-instrument">
      <div className="chart-instrument-main">
        <span className="chart-symbol">{meta.symbol}</span>
        {company != null ? <span className="chart-name">{company}</span> : null}
      </div>
      {sub ? <div className="chart-instrument-sub muted">{sub}</div> : null}
      <div className="chart-instrument-sub muted">
        Chart time · {viz} ({visualTimeZoneIana})
      </div>
    </div>
  )
}

function App() {
  const initialSymbol = parseSymbolFromSearch(window.location.search)
  const [symbolInput, setSymbolInput] = useState(initialSymbol)
  const [querySymbol, setQuerySymbol] = useState(initialSymbol)
  const [range, setRange] = useState<IntradayRange>(() =>
    parseRangeFromSearch(window.location.search),
  )
  const [lines, setLines] = useState<number[]>(() =>
    parseLinesFromSearch(window.location.search),
  )
  const [linesInput, setLinesInput] = useState(() =>
    formatLinesForUrl(parseLinesFromSearch(window.location.search)),
  )

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return readStoredTheme() ?? 'dark'
  })

  const [chartData, setChartData] = useState<IntradayChartResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chartKind, setChartKind] = useState<ChartSeriesKind>(() =>
    parseChartSeriesKindFromSearch(window.location.search),
  )

  const [finvizAuthToken, setFinvizAuthToken] = useState(readStoredFinvizAuth)
  const [debouncedAuthTrim, setDebouncedAuthTrim] = useState(() =>
    readStoredFinvizAuth().trim(),
  )

  const [visualTimeZone, setVisualTimeZone] =
    useState<ChartVisualTimeZoneIana>(readStoredChartVisualTimeZone)

  useEffect(() => {
    try {
      localStorage.setItem(CHART_VISUAL_TZ_STORAGE_KEY, visualTimeZone)
    } catch {
      /* quota / private mode */
    }
  }, [visualTimeZone])

  useEffect(() => {
    try {
      localStorage.setItem(FINVIZ_AUTH_STORAGE_KEY, finvizAuthToken)
    } catch {
      /* quota / private mode */
    }
  }, [finvizAuthToken])

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedAuthTrim(finvizAuthToken.trim())
    }, 400)
    return () => window.clearTimeout(id)
  }, [finvizAuthToken])

  useEffect(() => {
    applyDomTheme(themeMode)
    localStorage.setItem('theme', themeMode)
  }, [themeMode])

  const syncUrl = useCallback(
    (
      sym: string,
      rng: IntradayRange,
      lineList: number[],
      kind: ChartSeriesKind,
    ) => {
      const p = new URLSearchParams()
      p.set('symbol', sym)
      p.set('range', rng)
      if (lineList.length) {
        p.set('lines', formatLinesForUrl(lineList))
      }
      if (kind === 'baseline') {
        p.set('view', 'baseline')
      }
      const next = `${window.location.pathname}?${p.toString()}`
      window.history.replaceState(null, '', next)
    },
    [],
  )

  useEffect(() => {
    syncUrl(querySymbol, range, lines, chartKind)
  }, [querySymbol, range, lines, chartKind, syncUrl])

  useEffect(() => {
    if (!debouncedAuthTrim) {
      setChartData(null)
      setError(null)
      setLoading(false)
      return
    }

    const ac = new AbortController()
    let stale = false

    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const next = await fetchFinvizEliteIntraday(
          querySymbol,
          range,
          debouncedAuthTrim,
          ac.signal,
        )
        if (stale) return
        setChartData(next)
      } catch (e) {
        if (stale || isAbortError(e)) return
        setChartData(null)
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        if (!stale) {
          setLoading(false)
        }
      }
    })()

    return () => {
      stale = true
      ac.abort()
    }
  }, [querySymbol, range, debouncedAuthTrim])

  const chartTheme = useMemo(
    () => (themeMode === 'dark' ? CHART_DARK : CHART_LIGHT),
    [themeMode],
  )

  const baselinePrice = useMemo(() => {
    const bars = chartData?.bars
    if (!bars?.length) return 0
    const t0 = lines[0]
    if (t0 != null) {
      const v = valueAtNearestTime(bars, t0)
      if (v != null) return v
    }
    return bars[0].value
  }, [chartData?.bars, lines])

  const lineTimesSnappedToBars = useMemo(() => {
    const bars = chartData?.bars
    if (!bars?.length || !lines.length) return []
    return lines
      .map((t) => nearestBarTime(bars, t))
      .filter((x): x is number => x != null)
  }, [chartData?.bars, lines])

  const commitSymbol = () => {
    const s = symbolInput.trim() || 'AAPL'
    setSymbolInput(s)
    setQuerySymbol(s)
  }

  const refresh = () => {
    commitSymbol()
  }

  const applyLinesFromInput = () => {
    const parts = linesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const parsed: number[] = []
    for (const p of parts) {
      const n = Number(p)
      if (!Number.isFinite(n)) continue
      parsed.push(n > 1e12 ? Math.floor(n / 1000) : Math.floor(n))
    }
    setLines(parsed)
    setLinesInput(formatLinesForUrl(parsed))
  }

  const toggleTheme = () => {
    setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Stockgraphs</h1>
        <div className="header-actions">
          <button
            type="button"
            className="header-btn"
            aria-expanded={settingsOpen}
            aria-controls="settings-panel"
            onClick={() => setSettingsOpen((o) => !o)}
          >
            Settings
          </button>
          <button
            type="button"
            className="header-btn"
            onClick={toggleTheme}
            aria-label={themeMode === 'dark' ? 'Use light mode' : 'Use dark mode'}
          >
            {themeMode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      {settingsOpen ? (
        <div id="settings-panel" className="settings-panel">
          <section className="lines-section">
            <label className="field field-grow">
              <span className="label">
                Finviz Elite export token (<code className="code-inline">auth</code>{' '}
                from quote export URL; stored in this browser only)
              </span>
              <input
                className="input"
                type="password"
                value={finvizAuthToken}
                onChange={(e) => setFinvizAuthToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="paste UUID from elite.finviz.com/quote_export.ashx?…&auth=…"
              />
            </label>
          </section>

          <section className="controls">
            <label className="field">
              <span className="label">Symbol</span>
              <input
                className="input"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                onBlur={commitSymbol}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitSymbol()
                }}
                spellCheck={false}
                maxLength={16}
              />
            </label>
            <label className="field">
              <span className="label">Range</span>
              <select
                className="input select"
                value={range}
                onChange={(e) => setRange(e.target.value as IntradayRange)}
              >
                <option value="1d">1 day (1m)</option>
                <option value="5d">5 days (1m)</option>
                <option value="7d">7 days (1m)</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Chart</span>
              <select
                className="input select"
                value={chartKind}
                onChange={(e) =>
                  setChartKind(e.target.value as ChartSeriesKind)
                }
              >
                <option value="line">Line</option>
                <option value="baseline">Baseline</option>
              </select>
            </label>
            <button
              type="button"
              className="btn"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </section>

          <section className="lines-section">
            <label className="field field-grow">
              <span className="label">
                Vertical lines (Unix seconds UTC, comma-separated; ms ok)
              </span>
              <input
                className="input"
                value={linesInput}
                onChange={(e) => setLinesInput(e.target.value)}
                onBlur={applyLinesFromInput}
                placeholder="e.g. 1711963200,1711966800"
                spellCheck={false}
              />
            </label>
            <button type="button" className="btn btn-secondary" onClick={applyLinesFromInput}>
              Apply lines
            </button>
          </section>
        </div>
      ) : null}

      {error ? <p className="error" role="alert">{error}</p> : null}

      <div className="chart-wrap">
        {chartData?.bars.length ? (
          <>
            <div className="chart-toolbar">
              <ChartInstrumentHeader
                meta={chartData.meta}
                visualTimeZoneIana={visualTimeZone}
              />
              <div
                className="chart-tz-toggle"
                role="group"
                aria-label="Clock shown on chart (display only)"
              >
                <span className="chart-tz-toggle-label muted">Axis</span>
                {CHART_VISUAL_TIME_ZONES.map((z) => (
                  <button
                    key={z.iana}
                    type="button"
                    className={
                      visualTimeZone === z.iana
                        ? 'chart-tz-btn chart-tz-btn-active'
                        : 'chart-tz-btn'
                    }
                    aria-pressed={visualTimeZone === z.iana}
                    onClick={() => setVisualTimeZone(z.iana)}
                  >
                    {z.shortLabel}
                  </button>
                ))}
              </div>
            </div>
            <StockChart
              data={chartData.bars}
              lineTimes={lines}
              theme={chartTheme}
              seriesKind={chartKind}
              baselinePrice={baselinePrice}
              chartTimeZone={visualTimeZone}
            />
            {lines.length > 0 ? (
              <p className="chart-lines-note muted" role="status">
                Vertical lines (snapped to nearest bar, shown in{' '}
                {fullLabelForVisualZone(visualTimeZone)}):{' '}
                {lineTimesSnappedToBars
                  .map((t) =>
                    formatUnixSecondsForDisplay(t, visualTimeZone),
                  )
                  .join(' · ')}
              </p>
            ) : null}
          </>
        ) : !loading && !error ? (
          <p className="muted">
            {debouncedAuthTrim
              ? 'No data'
              : 'Open Settings and paste your Finviz Elite export token (saved in this browser).'}
          </p>
        ) : null}
      </div>

      <footer className="footer muted">
        Data: Finviz Elite CSV export. URL params:{' '}
        <code className="code-inline">symbol</code>,{' '}
        <code className="code-inline">range</code>,{' '}
        <code className="code-inline">lines</code>,{' '}
        <code className="code-inline">view=baseline</code>
      </footer>
    </div>
  )
}

export default App
