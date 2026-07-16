import { describe, expect, it } from 'vitest'
import type { Player, RiskAttempt, Turn } from './types'
import {
  computeProbabilityPerformance,
  findStatisticsDefiers,
  summarizeRiskAttempts,
} from './probabilityPerformance'

const players: Player[] = [
  { id: 'gabi', name: 'Gabi', score: 10_000, busts: 1 },
  { id: 'mabi', name: 'Mabi', score: 8_000, busts: 2 },
]

const attempt = (successPct: number, success: boolean): RiskAttempt => ({
  successPct,
  dice: successPct < 40 ? 1 : 2,
  scenarioB: false,
  pot: 500,
  success,
})

describe('probability performance', () => {
  it('expresses the balance as actual successes minus expected successes', () => {
    const summary = summarizeRiskAttempts('Gabi', [
      attempt(33.33, true),
      attempt(55.56, true),
      attempt(72.22, true),
      attempt(84.26, false),
    ])

    expect(summary).not.toBeNull()
    expect(summary?.attempts).toBe(4)
    expect(summary?.successes).toBe(3)
    expect(summary?.expectedSuccesses).toBeCloseTo(2.4537, 4)
    expect(summary?.balance).toBeCloseTo(0.5463, 4)
    expect(summary?.actualRate).toBe(0.75)
  })

  it('does not award one lucky throw as repeated defiance', () => {
    const turns: Turn[] = [
      { round: 1, player: 'Gabi', playerId: 'gabi', points: 500, bust: false, riskAttempts: [attempt(33.33, true)] },
    ]
    expect(findStatisticsDefiers(players, turns)).toEqual([])
  })

  it('finds the player who repeatedly beats the summed probabilities', () => {
    const turns: Turn[] = [
      {
        round: 1,
        player: 'Gabi',
        playerId: 'gabi',
        points: 1_000,
        bust: false,
        riskAttempts: [attempt(33.33, true), attempt(55.56, true), attempt(33.33, true)],
      },
      {
        round: 1,
        player: 'Mabi',
        playerId: 'mabi',
        points: 0,
        bust: true,
        riskAttempts: [attempt(84.26, false), attempt(72.22, true), attempt(55.56, false)],
      },
    ]

    const performance = computeProbabilityPerformance(players, turns)
    expect(performance[0].name).toBe('Gabi')
    expect(performance[0].successes).toBe(3)
    expect(performance[0].expectedSuccesses).toBeCloseTo(1.2222, 4)
    expect(performance[0].balance).toBeCloseTo(1.7778, 4)
    expect(findStatisticsDefiers(players, turns).map((entry) => entry.name)).toEqual(['Gabi'])
  })

  it('keeps exact ties shared', () => {
    const shared = [attempt(33.33, true), attempt(55.56, true), attempt(33.33, true)]
    const turns: Turn[] = [
      { round: 1, player: 'Gabi', playerId: 'gabi', points: 900, bust: false, riskAttempts: shared },
      { round: 1, player: 'Mabi', playerId: 'mabi', points: 900, bust: false, riskAttempts: shared },
    ]

    expect(findStatisticsDefiers(players, turns).map((entry) => entry.name)).toEqual(['Gabi', 'Mabi'])
  })
})
