import type { Player, RiskAttempt, Turn } from './types'

export const MIN_STATISTICS_DEFIANCE_ATTEMPTS = 3
export const MIN_STATISTICS_DEFIANCE_BALANCE = 0.75
export const MIN_STATISTICS_DEFIANCE_RATE_GAP = 0.1

export interface ProbabilityPerformance {
  name: string
  attempts: number
  successes: number
  expectedSuccesses: number
  actualRate: number
  expectedRate: number
  /** Tatsächlich geschaffte Würfe minus statistisch erwartete geschaffte Würfe. */
  balance: number
  /** Standardisierte Abweichung; nur zur stabilen Rangfolge bei ähnlicher Bilanz. */
  zScore: number
}

function isValidAttempt(attempt: RiskAttempt): boolean {
  return (
    Number.isFinite(attempt.successPct) &&
    attempt.successPct >= 0 &&
    attempt.successPct <= 100 &&
    Number.isInteger(attempt.dice) &&
    attempt.dice >= 1 &&
    attempt.dice <= 6 &&
    Number.isFinite(attempt.pot) &&
    attempt.pot >= 0 &&
    typeof attempt.success === 'boolean'
  )
}

export function summarizeRiskAttempts(name: string, attempts: RiskAttempt[]): ProbabilityPerformance | null {
  const valid = attempts.filter(isValidAttempt)
  if (valid.length === 0) return null

  const successes = valid.filter((attempt) => attempt.success).length
  const expectedSuccesses = valid.reduce((sum, attempt) => sum + attempt.successPct / 100, 0)
  const variance = valid.reduce((sum, attempt) => {
    const p = attempt.successPct / 100
    return sum + p * (1 - p)
  }, 0)
  const balance = successes - expectedSuccesses

  return {
    name,
    attempts: valid.length,
    successes,
    expectedSuccesses,
    actualRate: successes / valid.length,
    expectedRate: expectedSuccesses / valid.length,
    balance,
    zScore: variance > 0 ? balance / Math.sqrt(variance) : 0,
  }
}

/**
 * Vergleicht pro Spieler die tatsächlich überstandenen bewussten Weiterwürfe mit
 * der Summe ihrer exakten Erfolgswahrscheinlichkeiten. +1,8 bedeutet damit:
 * 1,8 Würfe mehr geschafft, als über genau diese Risikosituationen zu erwarten war.
 */
export function computeProbabilityPerformance(players: Player[], turns: Turn[]): ProbabilityPerformance[] {
  return players
    .map((player) => {
      const attempts = turns
        .filter((turn) => turn.playerId ? turn.playerId === player.id : turn.player === player.name)
        .flatMap((turn) => turn.riskAttempts ?? [])
      return summarizeRiskAttempts(player.name, attempts)
    })
    .filter((entry): entry is ProbabilityPerformance => Boolean(entry))
    .sort((a, b) => b.balance - a.balance || b.zScore - a.zScore || b.attempts - a.attempts || a.name.localeCompare(b.name, 'de'))
}

/**
 * Der Award verlangt mehrere Beobachtungen und eine materielle positive Abweichung.
 * So reicht kein einzelner glücklicher 1-Würfel-Wurf für „immer wieder getrotzt“.
 */
export function findStatisticsDefiers(players: Player[], turns: Turn[]): ProbabilityPerformance[] {
  const eligible = computeProbabilityPerformance(players, turns).filter(
    (entry) =>
      entry.attempts >= MIN_STATISTICS_DEFIANCE_ATTEMPTS &&
      entry.balance >= MIN_STATISTICS_DEFIANCE_BALANCE &&
      entry.actualRate - entry.expectedRate >= MIN_STATISTICS_DEFIANCE_RATE_GAP,
  )
  if (eligible.length === 0) return []

  const best = eligible[0]
  return eligible.filter(
    (entry) => Math.abs(entry.balance - best.balance) < 0.01 && Math.abs(entry.zScore - best.zScore) < 0.01,
  )
}
