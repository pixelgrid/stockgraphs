export type IntradayRange = '1d' | '5d' | '7d'

export type ChartInstrumentMeta = {
  symbol: string
  shortName: string | null
  longName: string | null
  currency: string | null
  exchangeName: string | null
  fullExchangeName: string | null
  /** IANA zone used to interpret Finviz CSV datetimes when no offset is present. */
  exchangeTimezoneName: string | null
  exchangeTimezoneShort: string | null
}

export type IntradayChartResult = {
  bars: { time: number; value: number }[]
  meta: ChartInstrumentMeta
}
