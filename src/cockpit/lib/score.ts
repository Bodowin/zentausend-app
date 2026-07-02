// Qualitäts-Score-Engine: verdichtet die Kennzahlen einer Aktie zu fünf
// Teil-Scores (0–100) und einem gewichteten Gesamt-Score. Fehlende Kennzahlen
// werden übersprungen und die Gewichte neu normiert – so bleiben auch Banken/
// REITs mit lückigen Kennzahlen vergleichbar.

import type { Instrument, RiskProfile, StockMetrics } from './types'

export interface ScoreBreakdown {
  valuation: number | null // Bewertung (günstig = hoch)
  growth: number | null // Wachstum
  quality: number | null // Profitabilität & Burggraben
  balance: number | null // Bilanz & Verschuldung
  dividend: number | null // Dividende
  total: number // gewichteter Gesamt-Score 0–100
  grade: string // A+ … F
}

export const SCORE_AXES: { key: keyof Omit<ScoreBreakdown, 'total' | 'grade'>; label: string }[] = [
  { key: 'valuation', label: 'Bewertung' },
  { key: 'growth', label: 'Wachstum' },
  { key: 'quality', label: 'Qualität' },
  { key: 'balance', label: 'Bilanz' },
  { key: 'dividend', label: 'Dividende' },
]

/**
 * Linear zwischen worst→best interpolieren (0–100). Funktioniert in beide
 * Richtungen (worst > best = „kleiner ist besser“).
 */
export function scale(value: number, worst: number, best: number): number {
  const t = (value - worst) / (best - worst)
  return Math.round(Math.min(1, Math.max(0, t)) * 100)
}

function avgDefined(parts: Array<number | null>): number | null {
  const vals = parts.filter((v): v is number => v !== null)
  if (vals.length === 0) return null
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
}

function n(v: number | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function valuationScore(m: StockMetrics): number | null {
  const pe = n(m.forwardPe) ?? n(m.pe)
  return avgDefined([
    pe !== null ? scale(pe, 45, 12) : null,
    n(m.peg) !== null ? scale(m.peg!, 3.5, 0.8) : null,
    n(m.ps) !== null ? scale(m.ps!, 15, 1.5) : null,
  ])
}

export function growthScore(m: StockMetrics): number | null {
  return avgDefined([
    n(m.revenueGrowth5y) !== null ? scale(m.revenueGrowth5y!, 0, 20) : null,
    n(m.epsGrowth5y) !== null ? scale(m.epsGrowth5y!, 0, 25) : null,
  ])
}

export function qualityScore(m: StockMetrics): number | null {
  // ROE nach oben gedeckelt, damit Rückkauf-verzerrte Werte nicht explodieren
  const roe = n(m.roe) !== null ? Math.min(m.roe!, 60) : null
  return avgDefined([
    n(m.grossMargin) !== null ? scale(m.grossMargin!, 20, 70) : null,
    n(m.operatingMargin) !== null ? scale(m.operatingMargin!, 5, 35) : null,
    n(m.fcfMargin) !== null ? scale(m.fcfMargin!, 2, 30) : null,
    roe !== null ? scale(roe, 5, 30) : null,
    n(m.roic) !== null ? scale(m.roic!, 4, 25) : null,
    m.moat !== undefined ? Math.round((m.moat / 3) * 100) : null,
  ])
}

export function balanceScore(m: StockMetrics): number | null {
  return avgDefined([
    n(m.debtToEquity) !== null ? scale(m.debtToEquity!, 2.5, 0.2) : null,
    n(m.netDebtToEbitda) !== null ? scale(m.netDebtToEbitda!, 4, 0) : null,
    n(m.interestCoverage) !== null ? scale(Math.min(m.interestCoverage!, 40), 2, 15) : null,
  ])
}

export function dividendScore(m: StockMetrics): number | null {
  const y = n(m.dividendYield)
  if (y === null) return null
  if (y === 0) return 0
  const yieldScore = scale(Math.min(y, 6), 0.2, 4)
  // Payout-Sweetspot 30–60 %: darunter Luft nach oben, darüber Risiko
  const p = n(m.payoutRatio)
  const payoutScore =
    p === null ? null : p <= 60 ? scale(p, 0, 40) : scale(p, 110, 60)
  const streak = n(m.dividendGrowthYears)
  return avgDefined([
    yieldScore,
    payoutScore,
    streak !== null ? scale(Math.min(streak, 30), 0, 25) : null,
  ])
}

/** Gewichtung der Teil-Scores je Anlegerprofil. */
export function profileWeights(profile: RiskProfile): Record<string, number> {
  switch (profile) {
    case 'defensiv':
      return { valuation: 0.25, growth: 0.05, quality: 0.25, balance: 0.25, dividend: 0.2 }
    case 'ausgewogen':
      return { valuation: 0.25, growth: 0.15, quality: 0.25, balance: 0.2, dividend: 0.15 }
    case 'wachstum':
      return { valuation: 0.2, growth: 0.3, quality: 0.3, balance: 0.12, dividend: 0.08 }
    case 'aggressiv':
      return { valuation: 0.15, growth: 0.4, quality: 0.3, balance: 0.1, dividend: 0.05 }
  }
}

export function gradeFor(total: number): string {
  if (total >= 85) return 'A+'
  if (total >= 75) return 'A'
  if (total >= 65) return 'B'
  if (total >= 55) return 'C'
  if (total >= 45) return 'D'
  return 'F'
}

export function scoreStock(m: StockMetrics, profile: RiskProfile): ScoreBreakdown {
  const parts = {
    valuation: valuationScore(m),
    growth: growthScore(m),
    quality: qualityScore(m),
    balance: balanceScore(m),
    dividend: dividendScore(m),
  }
  const weights = profileWeights(profile)
  let weightSum = 0
  let sum = 0
  for (const axis of SCORE_AXES) {
    const v = parts[axis.key]
    if (v === null) continue
    const w = weights[axis.key]
    sum += v * w
    weightSum += w
  }
  const total = weightSum > 0 ? Math.round(sum / weightSum) : 0
  return { ...parts, total, grade: gradeFor(total) }
}

export function scoreInstrument(
  instrument: Instrument,
  profile: RiskProfile,
): ScoreBreakdown | null {
  if (instrument.assetClass !== 'stock' || !instrument.metrics) return null
  return scoreStock(instrument.metrics, profile)
}

export const MOAT_LABELS = ['Keiner', 'Schwach', 'Mittel', 'Stark'] as const
