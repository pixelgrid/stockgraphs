import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Logical,
  type UTCTimestamp,
} from 'lightweight-charts'

export type ChartPoint = { time: number; value: number }

export type ThemeChart = {
  bg: string
  text: string
  grid: string
  border: string
  line: string
  crosshair: string
  vline: string
}

type Props = {
  data: ChartPoint[]
  lineTimes: number[]
  theme: ThemeChart
}

export function StockChart({ data, lineTimes, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const lineTimesRef = useRef(lineTimes)
  lineTimesRef.current = lineTimes

  const [vCoords, setVCoords] = useState<(number | null)[]>([])

  const updateVLineCoords = useCallback(() => {
    const chart = chartRef.current
    const times = lineTimesRef.current
    if (!chart || !times.length) {
      setVCoords([])
      return
    }
    const ts = chart.timeScale()
    setVCoords(
      times.map((t) => {
        // timeToCoordinate() uses exact timeToIndex only; user timestamps rarely
        // match Yahoo 1m bar times exactly. Nearest index + logicalToCoordinate works.
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
      },
      localization: {
        locale: navigator.language,
      },
    })

    const series = chart.addSeries(LineSeries, {
      color: theme.line,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: true,
    })

    chartRef.current = chart
    seriesRef.current = series

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chart is created once; theme updates via applyOptions
  }, [updateVLineCoords])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return

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
      },
    })
    series.applyOptions({ color: theme.line })
    updateVLineCoords()
  }, [theme, updateVLineCoords])

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
