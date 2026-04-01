import { useCallback, useEffect, useMemo, useState } from 'react'
import { StockChart } from './components/StockChart'
import {
  fetchYahooIntraday,
  type IntradayRange,
  type YahooInstrumentMeta,
  type YahooIntradayResult,
} from './lib/yahoo'
import {
  parseLinesFromSearch,
  parseRangeFromSearch,
  parseSymbolFromSearch,
} from './lib/urlParams'

type ThemeMode = 'light' | 'dark'

function readStoredTheme(): ThemeMode | null {
  const v = localStorage.getItem('theme')
  if (v === 'light' || v === 'dark') return v
  return null
}

function applyDomTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
}

const CHART_LIGHT = {
  bg: '#fafafa',
  text: '#6b7280',
  grid: '#e8e8e8',
  border: '#e5e5e5',
  line: '#2563eb',
  crosshair: '#9ca3af',
  vline: 'rgba(22, 163, 74, 0.65)',
}

const CHART_DARK = {
  bg: '#13141a',
  text: '#9ca3af',
  grid: '#2a2d36',
  border: '#2e303a',
  line: '#60a5fa',
  crosshair: '#6b7280',
  vline: 'rgba(74, 222, 128, 0.7)',
}

function formatLinesForUrl(lines: number[]): string {
  return lines.join(',')
}

/** Company / short title next to the ticker; null if Yahoo only repeats the symbol. */
function companyNameBesideSymbol(meta: YahooInstrumentMeta): string | null {
  const name = meta.shortName?.trim() || meta.longName?.trim() || null
  if (!name || name.toUpperCase() === meta.symbol.toUpperCase()) return null
  return name
}

function ChartInstrumentHeader({ meta }: { meta: YahooInstrumentMeta }) {
  const company = companyNameBesideSymbol(meta)
  const venue = meta.fullExchangeName ?? meta.exchangeName
  const sub = [venue, meta.currency].filter(Boolean).join(' · ')

  return (
    <div className="chart-instrument">
      <div className="chart-instrument-main">
        <span className="chart-symbol">{meta.symbol}</span>
        {company != null ? <span className="chart-name">{company}</span> : null}
      </div>
      {sub ? <div className="chart-instrument-sub muted">{sub}</div> : null}
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

  const [chartData, setChartData] = useState<YahooIntradayResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    applyDomTheme(themeMode)
    localStorage.setItem('theme', themeMode)
  }, [themeMode])

  const syncUrl = useCallback(
    (sym: string, rng: IntradayRange, lineList: number[]) => {
      const p = new URLSearchParams()
      p.set('symbol', sym)
      p.set('range', rng)
      if (lineList.length) {
        p.set('lines', formatLinesForUrl(lineList))
      }
      const next = `${window.location.pathname}?${p.toString()}`
      window.history.replaceState(null, '', next)
    },
    [],
  )

  useEffect(() => {
    syncUrl(querySymbol, range, lines)
  }, [querySymbol, range, lines, syncUrl])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const next = await fetchYahooIntraday(querySymbol, range)
        if (!cancelled) {
          setChartData(next)
        }
      } catch (e) {
        if (!cancelled) {
          setChartData(null)
          setError(e instanceof Error ? e.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [querySymbol, range])

  const chartTheme = useMemo(
    () => (themeMode === 'dark' ? CHART_DARK : CHART_LIGHT),
    [themeMode],
  )

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
                Vertical lines (Unix times, comma-separated; ms ok)
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
            <ChartInstrumentHeader meta={chartData.meta} />
            <StockChart
              data={chartData.bars}
              lineTimes={lines}
              theme={chartTheme}
            />
          </>
        ) : !loading && !error ? (
          <p className="muted">No data</p>
        ) : null}
      </div>

      <footer className="footer muted">
        Data: Yahoo Finance (unofficial). URL params:{' '}
        <code className="code-inline">symbol</code>,{' '}
        <code className="code-inline">range</code>,{' '}
        <code className="code-inline">lines</code>
      </footer>
    </div>
  )
}

export default App
