// Rebalancing-Rechner: Abweichung von der Ziel-Allokation und konkrete
// Handelsvorschläge – wahlweise steuerschonend nur mit frischem Geld
// (keine Verkäufe) oder als komplette Umschichtung.

import type { Position } from './types'

export interface RebalanceRow {
  position: Position
  currentPct: number // 0–100
  targetPct: number // 0–100
  driftPct: number // current - target (Prozentpunkte)
  /** EUR-Betrag: > 0 kaufen, < 0 verkaufen */
  trade: number
}

export interface RebalancePlan {
  rows: RebalanceRow[]
  targetSum: number // Summe der Ziel-% (sollte 100 sein)
  totalBuys: number
  totalSells: number
  /** größte absolute Abweichung in Prozentpunkten */
  maxDrift: number
}

/**
 * Umschichtungs-Modus: Zielwert = Ziel-% × Depotwert; Trade = Zielwert − Ist.
 * Positionen ohne Ziel (undefined) behalten implizit ihr aktuelles Gewicht.
 */
export function planRebalance(
  positions: Position[],
  targets: Record<string, number>,
): RebalancePlan {
  const total = positions.reduce((s, p) => s + p.value, 0)
  const rows: RebalanceRow[] = positions.map((p) => {
    const currentPct = total > 0 ? (p.value / total) * 100 : 0
    const targetPct = targets[p.instrument.id] ?? currentPct
    const trade = total > 0 ? (targetPct / 100) * total - p.value : 0
    return { position: p, currentPct, targetPct, driftPct: currentPct - targetPct, trade }
  })
  rows.sort((a, b) => Math.abs(b.driftPct) - Math.abs(a.driftPct))
  const targetSum = positions.reduce(
    (s, p) => s + (targets[p.instrument.id] ?? (total > 0 ? (p.value / total) * 100 : 0)),
    0,
  )
  return {
    rows,
    targetSum,
    totalBuys: rows.reduce((s, r) => s + Math.max(0, r.trade), 0),
    totalSells: rows.reduce((s, r) => s + Math.max(0, -r.trade), 0),
    maxDrift: rows.reduce((m, r) => Math.max(m, Math.abs(r.driftPct)), 0),
  }
}

/**
 * Frisches-Geld-Modus (steuerschonend, keine Verkäufe): der Betrag wird so auf
 * untergewichtete Positionen verteilt, dass die Abweichungen möglichst
 * verschwinden. Wenn das Geld nicht reicht, proportional zur Ziellücke.
 */
export function planFreshMoney(
  positions: Position[],
  targets: Record<string, number>,
  amount: number,
): RebalancePlan {
  const total = positions.reduce((s, p) => s + p.value, 0)
  const newTotal = total + amount
  const gaps = positions.map((p) => {
    const currentPct = total > 0 ? (p.value / total) * 100 : 0
    const targetPct = targets[p.instrument.id] ?? currentPct
    const targetValue = (targetPct / 100) * newTotal
    return { p, currentPct, targetPct, gap: Math.max(0, targetValue - p.value) }
  })
  const gapSum = gaps.reduce((s, g) => s + g.gap, 0)
  const rows: RebalanceRow[] = gaps.map(({ p, currentPct, targetPct, gap }) => {
    const trade = gapSum > 0 ? (gap / gapSum) * Math.min(amount, gapSum) : 0
    return { position: p, currentPct, targetPct, driftPct: currentPct - targetPct, trade }
  })
  // Restbetrag (falls alle Lücken kleiner als amount) proportional zu den Zielen
  const used = rows.reduce((s, r) => s + r.trade, 0)
  const rest = amount - used
  if (rest > 0.01) {
    const tSum = rows.reduce((s, r) => s + r.targetPct, 0)
    for (const r of rows) r.trade += tSum > 0 ? (r.targetPct / tSum) * rest : 0
  }
  rows.sort((a, b) => b.trade - a.trade)
  const targetSum = gaps.reduce((s, g) => s + g.targetPct, 0)
  return {
    rows,
    targetSum,
    totalBuys: rows.reduce((s, r) => s + Math.max(0, r.trade), 0),
    totalSells: 0,
    maxDrift: rows.reduce((m, r) => Math.max(m, Math.abs(r.driftPct)), 0),
  }
}

/** Startvorschlag für Ziele: aktuelle Gewichte, auf halbe Prozente gerundet. */
export function targetsFromCurrent(positions: Position[]): Record<string, number> {
  const total = positions.reduce((s, p) => s + p.value, 0)
  const out: Record<string, number> = {}
  for (const p of positions) {
    out[p.instrument.id] = total > 0 ? Math.round(((p.value / total) * 100) * 2) / 2 : 0
  }
  return out
}

/** Ziele proportional auf 100 % normieren (halbe Prozente). */
export function normalizeTargets(targets: Record<string, number>): Record<string, number> {
  const sum = Object.values(targets).reduce((s, v) => s + v, 0)
  if (sum <= 0) return targets
  const out: Record<string, number> = {}
  for (const [id, v] of Object.entries(targets)) {
    out[id] = Math.round(((v / sum) * 100) * 2) / 2
  }
  return out
}
