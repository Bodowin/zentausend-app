// Risiko-Engine: Konzentrations-Analyse (Sektor/Region/Anlageklasse),
// Diversifikations-Score, Warn-Flags und einfache Stress-Szenarien.

import type { PortfolioSummary, Position } from './types'

export interface ExposureSlice {
  label: string
  value: number
  weight: number // 0..1
}

function groupBy(positions: Position[], key: (p: Position) => string): ExposureSlice[] {
  const map = new Map<string, number>()
  let total = 0
  for (const p of positions) {
    map.set(key(p), (map.get(key(p)) ?? 0) + p.value)
    total += p.value
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value, weight: total > 0 ? value / total : 0 }))
    .sort((a, b) => b.value - a.value)
}

export function bySector(positions: Position[]): ExposureSlice[] {
  return groupBy(positions, (p) => p.instrument.sector)
}
export function byRegion(positions: Position[]): ExposureSlice[] {
  return groupBy(positions, (p) => p.instrument.region)
}
export function byAssetClass(positions: Position[]): ExposureSlice[] {
  return groupBy(positions, (p) =>
    p.instrument.assetClass === 'etf'
      ? 'ETF'
      : p.instrument.assetClass === 'stock'
        ? 'Einzelaktien'
        : p.instrument.assetClass,
  )
}

/** Herfindahl-Index (0..1): Summe der quadrierten Gewichte. */
export function hhi(slices: ExposureSlice[]): number {
  return slices.reduce((s, x) => s + x.weight * x.weight, 0)
}

export type FlagLevel = 'ok' | 'warn' | 'critical'

export interface RiskFlag {
  level: FlagLevel
  title: string
  detail: string
}

export function riskFlags(summary: PortfolioSummary): RiskFlag[] {
  const flags: RiskFlag[] = []
  const stocks = summary.positions.filter((p) => p.instrument.assetClass === 'stock')
  const etfWeight = summary.positions
    .filter((p) => p.instrument.assetClass === 'etf')
    .reduce((s, p) => s + p.weight, 0)

  for (const p of stocks) {
    if (p.weight > 0.15) {
      flags.push({
        level: 'critical',
        title: `Klumpenrisiko: ${p.instrument.name}`,
        detail: `${Math.round(p.weight * 100)} % des Depots in einer Aktie – Richtwert für Einzelwerte sind max. 5–10 %.`,
      })
    } else if (p.weight > 0.08) {
      flags.push({
        level: 'warn',
        title: `Hohe Einzelposition: ${p.instrument.name}`,
        detail: `${Math.round(p.weight * 100)} % Depotanteil. Beobachten oder bei Nachkäufen andere Werte bevorzugen.`,
      })
    }
  }

  const sectors = bySector(summary.positions).filter((s) => s.label !== 'Diversifiziert')
  for (const s of sectors) {
    if (s.weight > 0.35) {
      flags.push({
        level: 'warn',
        title: `Sektor-Konzentration: ${s.label}`,
        detail: `${Math.round(s.weight * 100)} % direktes Sektor-Gewicht (ohne breite ETFs gerechnet).`,
      })
    }
  }

  const regions = byRegion(summary.positions)
  const usa = regions.find((r) => r.label === 'USA')
  if (usa && usa.weight > 0.6) {
    flags.push({
      level: 'warn',
      title: 'USA-Übergewicht',
      detail: `${Math.round(usa.weight * 100)} % direktes USA-Gewicht – Welt-ETFs enthalten zusätzlich ~65 % USA.`,
    })
  }

  if (etfWeight < 0.3 && summary.positions.length > 0) {
    flags.push({
      level: 'warn',
      title: 'Wenig Basis-Investment',
      detail: `Nur ${Math.round(etfWeight * 100)} % in breiten ETFs. Ein stabiler Kern (Core) reduziert das Gesamtrisiko.`,
    })
  }

  if (stocks.length > 0 && stocks.length < 5) {
    flags.push({
      level: 'warn',
      title: 'Wenige Einzelwerte',
      detail: `${stocks.length} Einzelaktie(n) – unter ~8–10 Titeln wirkt Einzelwert-Risiko stark aufs Depot.`,
    })
  }

  if (flags.length === 0) {
    flags.push({
      level: 'ok',
      title: 'Keine auffälligen Klumpenrisiken',
      detail: 'Gewichtungen liegen innerhalb der üblichen Richtwerte.',
    })
  }
  return flags.sort((a, b) => levelRank(b.level) - levelRank(a.level))
}

function levelRank(l: FlagLevel): number {
  return l === 'critical' ? 2 : l === 'warn' ? 1 : 0
}

/** 0–100: kombiniert Positionszahl, größte Position, Sektor-/Regionen-HHI und ETF-Kern. */
export function diversificationScore(summary: PortfolioSummary): number {
  const positions = summary.positions
  if (positions.length === 0) return 0
  const maxWeight = Math.max(...positions.map((p) => p.weight))
  const etfWeight = positions
    .filter((p) => p.instrument.assetClass === 'etf')
    .reduce((s, p) => s + p.weight, 0)
  const countScore = Math.min(positions.length / 12, 1)
  const concentrationScore = 1 - Math.min(Math.max((maxWeight - 0.08) / 0.42, 0), 1)
  const sectorScore = 1 - Math.min(hhi(bySector(positions)), 1)
  const regionScore = 1 - Math.min(hhi(byRegion(positions)), 1)
  const coreScore = Math.min(etfWeight / 0.5, 1)
  const total =
    countScore * 0.2 +
    concentrationScore * 0.25 +
    sectorScore * 0.2 +
    regionScore * 0.15 +
    coreScore * 0.2
  return Math.round(total * 100)
}

export interface StressScenario {
  name: string
  description: string
  /** Verlust in EUR (negativ) */
  impact: number
  impactPct: number
}

/** Einfache Was-wäre-wenn-Szenarien auf Basis von Anlageklasse, Sektor und Beta. */
export function stressTests(summary: PortfolioSummary): StressScenario[] {
  const scenarios: StressScenario[] = []
  const total = summary.value
  if (total <= 0) return scenarios

  const impactOf = (fn: (p: Position) => number) =>
    summary.positions.reduce((s, p) => s + p.value * fn(p), 0)

  const crash = impactOf((p) => {
    if (p.instrument.assetClass === 'etf') return -0.32
    const beta = p.instrument.metrics?.beta ?? 1
    return Math.max(-0.7, -0.35 * beta)
  })
  scenarios.push({
    name: 'Globaler Bärenmarkt',
    description: 'Weltweiter Einbruch wie 2008/2020: Aktien −35 % (beta-gewichtet), breite ETFs −32 %.',
    impact: crash,
    impactPct: (crash / total) * 100,
  })

  const techCorrection = impactOf((p) => {
    const isTech =
      p.instrument.sector === 'Technologie' || p.instrument.sector === 'Kommunikation'
    if (p.instrument.assetClass === 'etf')
      return p.instrument.sector === 'Technologie' ? -0.25 : -0.08
    return isTech ? -0.25 : -0.05
  })
  scenarios.push({
    name: 'Tech-Korrektur',
    description: 'Bewertungs-Reset bei Tech/Kommunikation −25 %, Rest −5 %.',
    impact: techCorrection,
    impactPct: (techCorrection / total) * 100,
  })

  const rateShock = impactOf((p) => {
    if (p.instrument.sector === 'Immobilien' || p.instrument.sector === 'Versorger') return -0.18
    const m = p.instrument.metrics
    const growthHeavy = (m?.forwardPe ?? m?.pe ?? 20) > 30
    return growthHeavy ? -0.15 : -0.06
  })
  scenarios.push({
    name: 'Zinsschock (+2 %-Punkte)',
    description: 'Steigende Zinsen treffen REITs/Versorger und hoch bewertete Wachstumswerte am stärksten.',
    impact: rateShock,
    impactPct: (rateShock / total) * 100,
  })

  const euroStrength = impactOf((p) => {
    const usExposure =
      p.instrument.region === 'USA' ? 1 : p.instrument.region === 'Welt' ? 0.65 : 0
    return -0.1 * usExposure
  })
  scenarios.push({
    name: 'Euro-Stärke (+10 % vs. USD)',
    description: 'Währungseffekt auf USA-lastige Positionen (Welt-ETFs ~65 % USA).',
    impact: euroStrength,
    impactPct: (euroStrength / total) * 100,
  })

  return scenarios
}
