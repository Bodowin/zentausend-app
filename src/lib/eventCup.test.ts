import { describe, expect, it } from 'vitest'
import { computeEventCup } from './eventCup'
import type { GameRecord, RiskAttempt } from './types'

const player = (playerId: string, name: string, score: number, busts = 0) => ({ playerId, name, score, busts })

function game(
  id: number,
  date: string,
  event: string,
  winner: string,
  players: GameRecord['players'],
  risk?: { playerId: string; name: string; attempts: RiskAttempt[] },
): GameRecord {
  return {
    id,
    date,
    event,
    winner,
    winnerScore: Math.max(...players.map((entry) => entry.score)),
    players,
    turns: risk
      ? [
          {
            round: 1,
            player: risk.name,
            playerId: risk.playerId,
            points: players.find((entry) => entry.playerId === risk.playerId)?.score ?? 0,
            bust: false,
            riskAttempts: risk.attempts,
          },
        ]
      : [],
  }
}


describe('computeEventCup', () => {
  it('ranks by wins, win rate, average placement and then direct comparison', () => {
    const history: GameRecord[] = [
      game(1, '2026-08-01T18:00:00.000Z', 'Sommerurlaub', 'Anna', [
        player('a', 'Anna', 5_100),
        player('b', 'Bodo', 4_500),
      ]),
      game(2, '2026-08-02T18:00:00.000Z', 'Sommerurlaub', 'Clara', [
        player('c', 'Clara', 10_100),
        player('a', 'Anna', 9_500),
        player('b', 'Bodo', 9_000),
      ]),
      game(3, '2026-08-03T18:00:00.000Z', 'Sommerurlaub', 'Bodo', [
        player('b', 'Bodo', 15_050),
        player('c', 'Clara', 14_500),
        player('a', 'Anna', 13_800),
      ]),
    ]

    const cup = computeEventCup(history, 'Sommerurlaub')
    expect(cup).not.toBeNull()
    expect(cup!.standings.map((entry) => entry.name)).toEqual(['Clara', 'Anna', 'Bodo'])
    expect(cup!.standings.map((entry) => entry.wins)).toEqual([1, 1, 1])
    expect(cup!.standings[0].winRate).toBe(0.5)
    expect(cup!.standings[1].averagePlacement).toBe(2)
    expect(cup!.standings[2].averagePlacement).toBe(2)
    expect(cup!.standings[1].headToHeadPoints).toBe(2)
    expect(cup!.standings[2].headToHeadPoints).toBe(1)
    expect(cup!.standings[2].bestScore).toBe(15_050)
  })

  it('does not reward raw point sums across different target scores', () => {
    const history: GameRecord[] = [
      game(1, '2026-08-01T18:00:00.000Z', 'Cup', 'Anna', [player('a', 'Anna', 5_050), player('b', 'Bodo', 4_900)]),
      game(2, '2026-08-02T18:00:00.000Z', 'Cup', 'Bodo', [player('a', 'Anna', 14_000), player('b', 'Bodo', 20_050)]),
      game(3, '2026-08-03T18:00:00.000Z', 'Cup', 'Anna', [player('a', 'Anna', 10_100), player('b', 'Bodo', 9_900)]),
    ]

    const cup = computeEventCup(history, 'Cup')!
    expect(cup.champions.map((entry) => entry.name)).toEqual(['Anna'])
    expect(cup.standings[0].wins).toBe(2)
    expect(cup.standings[1].totalScore).toBeGreaterThan(cup.standings[0].totalScore)
  })

  it('aggregates event records, risk performance, leader changes and unassigned games', () => {
    const attempts: RiskAttempt[] = [
      { successPct: 33.33, dice: 1, scenarioB: false, pot: 300, success: true },
      { successPct: 55.56, dice: 2, scenarioB: false, pot: 500, success: true },
      { successPct: 33.33, dice: 1, scenarioB: false, pot: 700, success: true },
    ]
    const history: GameRecord[] = [
      game(1, '2026-08-01T18:00:00.000Z', 'Meer 2026', 'Anna', [player('a', 'Anna', 10_100), player('b', 'Bodo', 8_000, 3)], {
        playerId: 'a',
        name: 'Anna',
        attempts,
      }),
      game(2, '2026-08-02T18:00:00.000Z', 'Meer 2026', 'Bodo', [player('a', 'Anna', 8_900, 2), player('b', 'Bodo', 10_200)]),
      game(3, '2026-08-03T18:00:00.000Z', 'Meer 2026', 'Bodo', [player('a', 'Anna', 7_500, 4), player('b', 'Bodo', 10_350)]),
      game(4, '2026-08-04T18:00:00.000Z', '', 'Anna', [player('a', 'Anna', 10_000), player('b', 'Bodo', 9_000)]),
    ]

    const cup = computeEventCup(history, 'Meer 2026')!
    expect(cup.records.find((record) => record.key === 'score')).toMatchObject({ name: 'Bodo', detail: '10.350 Punkte' })
    expect(cup.records.find((record) => record.key === 'risk')).toMatchObject({ name: 'Anna' })
    expect(cup.records.find((record) => record.key === 'streak')).toMatchObject({ name: 'Anna', detail: '2 Spiele ohne Sieg' })
    expect(cup.progress).toHaveLength(3)
    expect(cup.progress.some((entry) => entry.leaderChanged)).toBe(true)
    expect(cup.unassignedGames.map((entry) => entry.id)).toEqual([4])
    expect(cup.hasRiskData).toBe(true)
  })

  it('shares exact ties instead of inventing a champion', () => {
    const history: GameRecord[] = [
      game(1, '2026-08-01T18:00:00.000Z', 'Tie Cup', 'Anna', [player('a', 'Anna', 10_000), player('b', 'Bodo', 9_000)]),
      game(2, '2026-08-02T18:00:00.000Z', 'Tie Cup', 'Bodo', [player('a', 'Anna', 9_000), player('b', 'Bodo', 10_000)]),
    ]

    const cup = computeEventCup(history, 'Tie Cup')!
    expect(cup.champions.map((entry) => entry.name)).toEqual(['Anna', 'Bodo'])
    expect(cup.standings.map((entry) => entry.rank)).toEqual([1, 1])
  })
})
