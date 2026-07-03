// Historischer Kurs-Chart eines Instruments (über /api/history, nur im
// Vercel-Deployment). Zeitraum-Umschalter 6M/1J/5J/Max + Perf-Badge.

import { useEffect, useState } from 'react'
import { fetchHistory, performancePct, type HistoryData, type HistoryRange } from '../lib/history'
import { fmtMonth, fmtNum, fmtPct } from '../lib/format'
import type { Instrument } from '../lib/types'
import { LineChart } from './charts'
import { Badge } from './ui'

const RANGES: { id: HistoryRange; label: string }[] = [
  { id: '6m', label: '6M' },
  { id: '1y', label: '1J' },
  { id: '5y', label: '5J' },
  { id: 'max', label: 'Max' },
]

export function HistoryChart({ instrument }: { instrument: Instrument }) {
  const [range, setRange] = useState<HistoryRange>('1y')
  const [data, setData] = useState<HistoryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const symbol = instrument.yahooSymbol

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchHistory(symbol, range)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled)
          setError(
            'Kurshistorie nicht erreichbar – verfügbar im Vercel-Deployment (Function /api/history).',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [symbol, range])

  if (!symbol) {
    return (
      <p className="rounded-xl bg-inset px-3 py-2 text-xs text-ink-mute">
        Kein Yahoo-Symbol hinterlegt – im Kennzahlen-Editor ergänzen, dann gibt es hier den Kurs-Chart.
      </p>
    )
  }

  const perf = data ? performancePct(data.points) : 0

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                range === r.id ? 'bg-aurum text-abyss' : 'bg-raised text-ink-soft hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {data && (
          <div className="flex items-center gap-2">
            <Badge tone={perf >= 0 ? 'gain' : 'loss'}>{fmtPct(perf, 1, true)}</Badge>
            <span className="text-[11px] text-ink-mute">
              {data.points.length} Punkte · in {data.currency}
            </span>
          </div>
        )}
      </div>
      {error && <p className="rounded-xl bg-inset px-3 py-3 text-xs text-ink-mute">{error}</p>}
      {loading && !data && (
        <p className="py-8 text-center text-xs text-ink-mute">Lade Kurshistorie…</p>
      )}
      {data && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
          <LineChart
            labels={data.points.map((p) => p.t)}
            series={[
              {
                name: instrument.ticker,
                color: 'var(--color-chart-1)',
                values: data.points.map((p) => p.c),
                area: true,
              },
            ]}
            height={200}
            formatY={(v) => `${fmtNum(v, v >= 100 ? 0 : 2)} ${data.currency === 'EUR' ? '€' : data.currency}`}
            formatLabel={(l) => fmtMonth(l)}
          />
        </div>
      )}
    </div>
  )
}
