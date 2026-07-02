// Portfolio-Mathematik: Positionen aus Transaktionen (Durchschnittskosten-
// Methode), Zusammenfassung, Zeitreihen und Sparplan-Projektion.

import type {
  Instrument,
  PortfolioSummary,
  Position,
  SavingsPlan,
  Snapshot,
  Transaction,
} from './types'

interface Lot {
  shares: number
  cost: number // Kostenbasis der offenen Stücke inkl. Gebühren
  realized: number
}

/** Offene Stücke + Kostenbasis je Instrument (Durchschnittskosten-Methode). */
export function computeLots(transactions: Transaction[]): Map<string, Lot> {
  const lots = new Map<string, Lot>()
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  for (const t of sorted) {
    const lot = lots.get(t.instrumentId) ?? { shares: 0, cost: 0, realized: 0 }
    const fees = t.fees ?? 0
    if (t.type === 'buy') {
      lot.shares += t.shares
      lot.cost += t.shares * t.price + fees
    } else {
      const sellShares = Math.min(t.shares, lot.shares)
      const avg = lot.shares > 0 ? lot.cost / lot.shares : 0
      lot.realized += sellShares * (t.price - avg) - fees
      lot.cost -= sellShares * avg
      lot.shares -= sellShares
      if (lot.shares < 1e-9) {
        lot.shares = 0
        lot.cost = 0
      }
    }
    lots.set(t.instrumentId, lot)
  }
  return lots
}

export function computePortfolio(
  instruments: Instrument[],
  transactions: Transaction[],
): PortfolioSummary {
  const byId = new Map(instruments.map((i) => [i.id, i]))
  const lots = computeLots(transactions)

  const positions: Position[] = []
  let value = 0
  let invested = 0
  let realized = 0

  for (const [id, lot] of lots) {
    const instrument = byId.get(id)
    realized += lot.realized
    if (!instrument) continue
    if (lot.shares <= 0) continue
    const posValue = lot.shares * instrument.price
    value += posValue
    invested += lot.cost
    positions.push({
      instrument,
      shares: lot.shares,
      invested: lot.cost,
      avgCost: lot.cost / lot.shares,
      value: posValue,
      gain: posValue - lot.cost,
      gainPct: lot.cost > 0 ? ((posValue - lot.cost) / lot.cost) * 100 : 0,
      realized: lot.realized,
      weight: 0,
    })
  }

  for (const p of positions) p.weight = value > 0 ? p.value / value : 0
  positions.sort((a, b) => b.value - a.value)

  // Gewichtete Dividenden-/Ausschüttungsrendite
  let divSum = 0
  for (const p of positions) {
    const y =
      p.instrument.assetClass === 'etf'
        ? (p.instrument.etf?.distributionYield ?? 0)
        : (p.instrument.metrics?.dividendYield ?? 0)
    divSum += p.value * y
  }

  return {
    value,
    invested,
    gain: value - invested,
    gainPct: invested > 0 ? ((value - invested) / invested) * 100 : 0,
    realized,
    dividendYieldPct: value > 0 ? divSum / value : 0,
    positions,
  }
}

export interface SeriesPoint {
  date: string
  invested: number
  value: number
}

/** Verlaufs-Kurve: historische Schnappschüsse + aktueller Live-Punkt. */
export function valueSeries(
  snapshots: Snapshot[],
  current: { invested: number; value: number },
): SeriesPoint[] {
  const points: SeriesPoint[] = snapshots
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ date: s.date, invested: s.invested, value: s.totalValue }))
  const today = new Date().toISOString().slice(0, 10)
  const last = points[points.length - 1]
  if (!last || last.date < today) {
    points.push({ date: today, invested: current.invested, value: current.value })
  } else {
    points[points.length - 1] = { date: today, invested: current.invested, value: current.value }
  }
  return points
}

export interface ProjectionYear {
  year: number
  contributions: number // kumulierte Einzahlungen
  value: number // Depotwert mit Zinseszins
}

/**
 * Sparplan-Projektion mit monatlichem Zinseszins.
 * startValue wächst mit, monatliche Rate wird jeweils zum Monatsanfang investiert.
 */
export function projectSavings(
  startValue: number,
  monthlyAmount: number,
  years: number,
  annualReturnPct: number,
): ProjectionYear[] {
  const monthlyRate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1
  const out: ProjectionYear[] = []
  let value = startValue
  let contributions = startValue
  out.push({ year: 0, contributions, value })
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      value = (value + monthlyAmount) * (1 + monthlyRate)
      contributions += monthlyAmount
    }
    out.push({ year: y, contributions: Math.round(contributions), value: Math.round(value) })
  }
  return out
}

/** Summe aller aktiven Sparpläne pro Monat. */
export function monthlyPlanTotal(plans: SavingsPlan[]): number {
  return plans.filter((p) => p.active).reduce((s, p) => s + p.monthlyAmount, 0)
}
