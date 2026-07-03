// Was-wäre-wenn-Rechner: einen geplanten Kauf simulieren und die Wirkung
// auf Gewichte, Diversifikation, Dividenden und Risiko-Flags VOR dem
// Kauf sichtbar machen.

import { computePortfolio } from './calc'
import { buildDividendCalendar } from './dividends'
import { bySector, byRegion, diversificationScore, riskFlags, type RiskFlag } from './risk'
import { todayIso, uid } from './format'
import type { Instrument, Transaction } from './types'

export interface SimSnapshot {
  totalValue: number
  positionWeightPct: number // Gewicht des gekauften Titels
  sectorWeightPct: number // Gewicht des Sektors des Titels
  regionWeightPct: number
  diversificationScore: number
  annualDividend: number
}

export interface SimulationResult {
  instrument: Instrument
  amount: number
  shares: number
  before: SimSnapshot
  after: SimSnapshot
  /** Flags, die durch den Kauf NEU entstehen */
  newFlags: RiskFlag[]
  /** Flags, die durch den Kauf verschwinden */
  resolvedFlags: RiskFlag[]
}

function snapshotFor(
  instruments: Instrument[],
  transactions: Transaction[],
  target: Instrument,
): SimSnapshot & { flags: RiskFlag[] } {
  const summary = computePortfolio(instruments, transactions)
  const position = summary.positions.find((p) => p.instrument.id === target.id)
  const sectors = bySector(summary.positions)
  const regions = byRegion(summary.positions)
  const calendar = buildDividendCalendar(summary.positions)
  return {
    totalValue: summary.value,
    positionWeightPct: (position?.weight ?? 0) * 100,
    sectorWeightPct: (sectors.find((s) => s.label === target.sector)?.weight ?? 0) * 100,
    regionWeightPct: (regions.find((r) => r.label === target.region)?.weight ?? 0) * 100,
    diversificationScore: diversificationScore(summary),
    annualDividend: calendar.yearTotal,
    flags: summary.positions.length > 0 ? riskFlags(summary) : [],
  }
}

export function simulateBuy(
  instruments: Instrument[],
  transactions: Transaction[],
  instrumentId: string,
  amount: number,
): SimulationResult | null {
  const instrument = instruments.find((i) => i.id === instrumentId)
  if (!instrument || instrument.price <= 0 || !(amount > 0)) return null

  const shares = amount / instrument.price
  const hypothetical: Transaction = {
    id: uid(),
    instrumentId,
    type: 'buy',
    date: todayIso(),
    shares,
    price: instrument.price,
    fees: 0,
  }

  const before = snapshotFor(instruments, transactions, instrument)
  const after = snapshotFor(instruments, [...transactions, hypothetical], instrument)

  const beforeTitles = new Set(before.flags.map((f) => f.title))
  const afterTitles = new Set(after.flags.map((f) => f.title))
  const isReal = (f: RiskFlag) => f.level !== 'ok'
  const newFlags = after.flags.filter((f) => isReal(f) && !beforeTitles.has(f.title))
  const resolvedFlags = before.flags.filter((f) => isReal(f) && !afterTitles.has(f.title))

  const strip = ({ flags: _flags, ...rest }: SimSnapshot & { flags: RiskFlag[] }): SimSnapshot =>
    rest
  return {
    instrument,
    amount,
    shares,
    before: strip(before),
    after: strip(after),
    newFlags,
    resolvedFlags,
  }
}
