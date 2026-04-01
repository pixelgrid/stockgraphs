export type IntradayRange = '1d' | '5d' | '7d'

type YahooChartJson = {
  chart?: {
    error?: { description?: string }
    result?: Array<{
      timestamp: number[]
      indicators?: { quote?: Array<{ close?: (number | null)[] }> }
    }>
  }
}

function parseChart(json: YahooChartJson): { time: number; value: number }[] {
  const err = json.chart?.error
  if (err) {
    throw new Error(err.description ?? 'Yahoo Finance error')
  }
  const result = json.chart?.result?.[0]
  if (!result?.timestamp?.length) {
    throw new Error('No chart data returned')
  }
  const closes = result.indicators?.quote?.[0]?.close
  if (!closes || closes.length !== result.timestamp.length) {
    throw new Error('Invalid quote data')
  }
  // Yahoo `timestamp` entries are Unix seconds (UTC); matches lightweight-charts UTCTimestamp.
  const out: { time: number; value: number }[] = []
  for (let i = 0; i < result.timestamp.length; i++) {
    const c = closes[i]
    const t = result.timestamp[i]
    if (c != null && Number.isFinite(c) && Number.isFinite(t)) {
      out.push({ time: t, value: c })
    }
  }
  if (!out.length) {
    throw new Error('No valid price points')
  }
  return out
}

/**
 * 1m bars from Yahoo Finance, entirely from the browser.
 * Tries Yahoo directly, then a public CORS relay (Yahoo usually omits CORS headers).
 */
export async function fetchYahooIntraday(
  symbol: string,
  range: IntradayRange,
): Promise<{ time: number; value: number }[]> {
  const qs = new URLSearchParams({ interval: '1m', range })
  const path = `/v8/finance/chart/${encodeURIComponent(symbol.trim())}?${qs}`
  const yahooUrl = `https://query1.finance.yahoo.com${path}`

  const urls: string[] = [
    yahooUrl,
    `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`,
  ]

  let lastMessage = 'Failed to load data'
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        lastMessage = `HTTP ${res.status}`
        continue
      }
      const json = (await res.json()) as YahooChartJson
      return parseChart(json)
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(
    `${lastMessage}. Yahoo blocks most browser requests (CORS); the relay may be down or rate-limited.`,
  )
}
