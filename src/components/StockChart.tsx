import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BaselineSeries,
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Logical,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import {
  exchangeTickMarkFormatter,
  exchangeTimeFormatter,
} from '../lib/exchangeTimeFormat'
import type { ChartSeriesKind } from '../types/chart'

export type ChartPoint = { time: number; value: number }
export type { ChartSeriesKind }

export type ThemeChart = {
  bg: string
  text: string
  grid: string
  border: string
  line: string
  crosshair: string
  vline: string
  baselineTopFill1: string
  baselineTopFill2: string
  baselineBottomFill1: string
  baselineBottomFill2: string
  baselineBelowLine: string
}

type Props = {
  data: ChartPoint[]
  lineTimes: number[]
  theme: ThemeChart
  seriesKind: ChartSeriesKind
  /** Horizontal baseline price; used when `seriesKind === 'baseline'`. */
  baselinePrice: number
  /** Resolved IANA zone for axis labels (see `resolveChartTimeZone`). */
  chartTimeZone: string
}

export function StockChart({
  data,
  lineTimes,
  theme,
  seriesKind,
  baselinePrice,
  chartTimeZone,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | ISeriesApi<'Baseline'> | null>(
    null,
  )
  const dataRef = useRef(data)
  dataRef.current = data

  const lineTimesRef = useRef(lineTimes)
  lineTimesRef.current = lineTimes

  const tzRef = useRef(chartTimeZone)
  tzRef.current = chartTimeZone

  const [vCoords, setVCoords] = useState<(number | null)[]>([])

  const updateVLineCoords = useCallback(() => {
    const chart = chartRef.current
    const times = lineTimesRef.current
    const bars = dataRef.current
    if (!chart || !times.length) {
      setVCoords([])
      return
    }
    const firstT = bars[0]?.time
    const lastT = bars[bars.length - 1]?.time
    const ts = chart.timeScale()
    setVCoords(
      times.map((t) => {
        if (
          firstT == null ||
          lastT == null ||
          t < firstT ||
          t > lastT
        ) {
          return null
        }
        const idx = ts.timeToIndex(t as UTCTimestamp, true)
        if (idx === null) return null
        return ts.logicalToCoordinate(idx as unknown as Logical)
      }),
    )
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: theme.bg },
        textColor: theme.text,
        fontSize: 12,
        fontFamily: 'system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      crosshair: {
        vertLine: { color: theme.crosshair, labelBackgroundColor: theme.bg },
        horzLine: { color: theme.crosshair, labelBackgroundColor: theme.bg },
      },
      rightPriceScale: { borderColor: theme.border },
      timeScale: {
        borderColor: theme.border,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (t: Time, tt: number) =>
          exchangeTickMarkFormatter(tzRef.current, t, Number(tt)),
      },
      localization: {
        locale: 'en-US',
        timeFormatter: (t: Time) => exchangeTimeFormatter(tzRef.current, t),
      },
    })

    chartRef.current = chart

    const onLogical = () => updateVLineCoords()
    const onTime = () => updateVLineCoords()
    const onScaleSize = () => updateVLineCoords()
    chart.timeScale().subscribeVisibleLogicalRangeChange(onLogical)
    chart.timeScale().subscribeVisibleTimeRangeChange(onTime)
    chart.timeScale().subscribeSizeChange(onScaleSize)

    const ro = new ResizeObserver(() => {
      const r = containerRef.current?.getBoundingClientRect()
      if (r && r.width > 0 && r.height > 0) {
        chart.resize(r.width, r.height)
        updateVLineCoords()
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onLogical)
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onTime)
      chart.timeScale().unsubscribeSizeChange(onScaleSize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chart shell once; series swapped separately
  }, [updateVLineCoords])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const prev = seriesRef.current
    if (prev) {
      chart.removeSeries(prev)
      seriesRef.current = null
    }

    const price =
      Number.isFinite(baselinePrice) && baselinePrice > 0
        ? baselinePrice
        : dataRef.current[0]?.value ?? 0

    let series: ISeriesApi<'Line'> | ISeriesApi<'Baseline'>
    if (seriesKind === 'line') {
      series = chart.addSeries(LineSeries, {
        color: theme.line,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        lastValueVisible: true,
        priceLineVisible: true,
      })
    } else {
      series = chart.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price },
        relativeGradient: false,
        lineWidth: 2,
        topLineColor: theme.line,
        topFillColor1: theme.baselineTopFill1,
        topFillColor2: theme.baselineTopFill2,
        bottomLineColor: theme.baselineBelowLine,
        bottomFillColor1: theme.baselineBottomFill1,
        bottomFillColor2: theme.baselineBottomFill2,
        crosshairMarkerVisible: true,
        lastValueVisible: true,
        priceLineVisible: true,
      })
    }
    seriesRef.current = series

    const points = dataRef.current
    if (points.length) {
      series.setData(
        points.map((d) => ({
          time: d.time as UTCTimestamp,
          value: d.value,
        })),
      )
      chart.timeScale().fitContent()
      requestAnimationFrame(() => updateVLineCoords())
    }

    return () => {
      if (chartRef.current && seriesRef.current) {
        chartRef.current.removeSeries(seriesRef.current)
        seriesRef.current = null
      }
    }
  }, [
    seriesKind,
    baselinePrice,
    theme,
    updateVLineCoords,
  ])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: theme.bg },
        textColor: theme.text,
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      crosshair: {
        vertLine: { color: theme.crosshair, labelBackgroundColor: theme.bg },
        horzLine: { color: theme.crosshair, labelBackgroundColor: theme.bg },
      },
      rightPriceScale: { borderColor: theme.border },
      timeScale: {
        borderColor: theme.border,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (t: Time, tt: number) =>
          exchangeTickMarkFormatter(tzRef.current, t, Number(tt)),
      },
      localization: {
        locale: 'en-US',
        timeFormatter: (t: Time) => exchangeTimeFormatter(tzRef.current, t),
      },
    })
    updateVLineCoords()
  }, [theme, chartTimeZone, updateVLineCoords])

  useEffect(() => {
    const series = seriesRef.current
    if (!series || !data.length) return
    series.setData(
      data.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
      })),
    )
    chartRef.current?.timeScale().fitContent()
    requestAnimationFrame(() => updateVLineCoords())
  }, [data, updateVLineCoords])

  useEffect(() => {
    updateVLineCoords()
  }, [lineTimes, updateVLineCoords])

  return (
    <div className="chart-shell">
      <div ref={containerRef} className="chart-canvas" />
      <div className="chart-vlines" aria-hidden="true">
        {vCoords.map((x, i) =>
          x != null ? (
            <div
              key={`${lineTimes[i]}-${i}`}
              className="chart-vline"
              style={{ left: x, backgroundColor: theme.vline }}
            />
          ) : null,
        )}
      </div>
    </div>
  )
}
