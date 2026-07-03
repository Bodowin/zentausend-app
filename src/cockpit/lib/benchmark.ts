// Benchmark-Vergleich: „Was wäre, wenn jeder Euro stattdessen in den
// MSCI World geflossen wäre?“ – gleiche Zahlungsströme (Käufe/Verkäufe),
// bewertet mit einer Benchmark-Kursreihe. Eingebaute Monatsreihe als
// Beispieldaten (grober Verlauf inkl. 2018-Delle, Corona-Crash, 2022-Bär);
// im Deployment kann sie später per /api/history ersetzt werden.

import type { Snapshot, Transaction } from './types'

export interface BenchmarkPoint {
  date: string // yyyy-mm (Monatsanfang)
  price: number
}

// Stützpunkte (EUNL.DE, EUR) – Beispieldaten, linear monatlich interpoliert
const ANCHORS: [string, number][] = [
  ['2015-01', 38],
  ['2016-01', 40],
  ['2016-07', 38.5],
  ['2017-01', 44],
  ['2018-01', 50],
  ['2019-01', 47],
  ['2020-01', 56],
  ['2020-03', 42],
  ['2020-12', 60],
  ['2021-12', 74],
  ['2022-09', 62],
  ['2023-01', 68],
  ['2024-01', 82],
  ['2025-01', 96],
  ['2025-07', 100],
  ['2026-01', 106],
  ['2026-12', 112],
]

function monthIndex(ym: string): number {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  return y * 12 + (m - 1)
}

function buildSeries(): BenchmarkPoint[] {
  const out: BenchmarkPoint[] = []
  for (let a = 0; a < ANCHORS.length - 1; a++) {
    const [d0, p0] = ANCHORS[a]
    const [d1, p1] = ANCHORS[a + 1]
    const i0 = monthIndex(d0)
    const i1 = monthIndex(d1)
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / (i1 - i0)
      const y = Math.floor(i / 12)
      const m = (i % 12) + 1
      out.push({
        date: `${y}-${String(m).padStart(2, '0')}`,
        price: Math.round((p0 + (p1 - p0) * t) * 100) / 100,
      })
    }
  }
  const [dLast, pLast] = ANCHORS[ANCHORS.length - 1]
  out.push({ date: dLast, price: pLast })
  return out
}

export const MSCI_WORLD = {
  name: 'MSCI World (EUNL)',
  note: 'Beispiel-Kursreihe, monatlich interpoliert',
  series: buildSeries(),
}

/** Benchmark-Kurs zu einem Datum (Monats-Auflösung, Ränder geklemmt). */
export function priceAt(series: BenchmarkPoint[], isoDate: string): number {
  const target = monthIndex(isoDate.slice(0, 7))
  const first = monthIndex(series[0].date)
  const last = monthIndex(series[series.length - 1].date)
  const clamped = Math.min(Math.max(target, first), last)
  return series[clamped - first].price
}

export interface BenchmarkComparison {
  labels: string[]
  depot: number[]
  benchmark: number[]
  invested: number[]
  depotReturnPct: number
  benchReturnPct: number
  /** Depot minus Benchmark, Prozentpunkte */
  alphaPct: number
}

/**
 * Gleiche Cashflows in den Benchmark spiegeln: Käufe kaufen Benchmark-Anteile
 * zum damaligen Kurs, Verkäufe entnehmen den gleichen EUR-Betrag. Bewertet
 * wird an den Schnappschuss-Terminen des Depots.
 */
export function compareWithBenchmark(
  transactions: Transaction[],
  snapshots: Snapshot[],
  current: { date: string; invested: number; value: number },
  series: BenchmarkPoint[] = MSCI_WORLD.series,
): BenchmarkComparison | null {
  const txs = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  if (txs.length === 0) return null

  const points = [...snapshots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((s) => s.date >= txs[0].date)
  const grid: { date: string; invested: number; depot: number }[] = points.map((s) => ({
    date: s.date,
    invested: s.invested,
    depot: s.totalValue,
  }))
  const last = grid[grid.length - 1]
  if (!last || last.date < current.date) {
    grid.push({ date: current.date, invested: current.invested, depot: current.value })
  } else {
    grid[grid.length - 1] = {
      date: current.date,
      invested: current.invested,
      depot: current.value,
    }
  }
  if (grid.length < 2) return null

  // Benchmark-Anteile entlang der Zeitachse fortschreiben
  let shares = 0
  let t = 0
  const benchmark: number[] = []
  for (const g of grid) {
    while (t < txs.length && txs[t].date <= g.date) {
      const tx = txs[t]
      const p = priceAt(series, tx.date)
      const amount = tx.shares * tx.price + (tx.fees ?? 0)
      if (tx.type === 'buy') {
        shares += amount / p
      } else {
        const proceeds = tx.shares * tx.price - (tx.fees ?? 0)
        shares = Math.max(0, shares - proceeds / p)
      }
      t++
    }
    benchmark.push(Math.round(shares * priceAt(series, g.date)))
  }

  const invested = grid.map((g) => g.invested)
  const depot = grid.map((g) => g.depot)
  const lastInvested = invested[invested.length - 1]
  const depotReturnPct =
    lastInvested > 0 ? ((depot[depot.length - 1] - lastInvested) / lastInvested) * 100 : 0
  const benchReturnPct =
    lastInvested > 0
      ? ((benchmark[benchmark.length - 1] - lastInvested) / lastInvested) * 100
      : 0

  return {
    labels: grid.map((g) => g.date),
    depot,
    benchmark,
    invested,
    depotReturnPct,
    benchReturnPct,
    alphaPct: depotReturnPct - benchReturnPct,
  }
}
