import { describe, expect, it } from 'vitest'
import type { Turn } from './types'
import { replayCompletedTurns, TurnReplayError } from './turnReplay'

const roster = [
  { id: 'player:a', name: 'Anna' },
  { id: 'player:b', name: 'Bert' },
  { id: 'player:c', name: 'Clara' },
]

const turn = (playerId: string, player: string, points: number, bust = false, round = 99): Turn => ({
  round,
  playerId,
  player,
  points,
  bust,
})

describe('replayCompletedTurns', () => {
  it('recalculates scores, busts, rounds and the next player from the full log', () => {
    const result = replayCompletedTurns(
      roster,
      [
        turn('player:a', 'Alter Name', 500),
        turn('player:b', 'Bert', 0, true),
        turn('player:c', 'Clara', 350),
        turn('player:a', 'Anna', 600),
        turn('player:b', 'Bert', 400),
      ],
      10_000,
      350,
    )

    expect(result.players).toEqual([
      { id: 'player:a', name: 'Anna', score: 1100, busts: 0 },
      { id: 'player:b', name: 'Bert', score: 400, busts: 1 },
      { id: 'player:c', name: 'Clara', score: 350, busts: 0 },
    ])
    expect(result.turns.map((item) => item.round)).toEqual([1, 1, 1, 2, 2])
    expect(result.turns[0].player).toBe('Anna')
    expect(result.idx).toBe(2)
    expect(result.round).toBe(2)
    expect(result.phase).toBe('active')
  })

  it('reconstructs the final round and winner when a correction reaches the target', () => {
    const result = replayCompletedTurns(
      roster.slice(0, 2),
      [turn('player:a', 'Anna', 1000), turn('player:b', 'Bert', 500)],
      1000,
      0,
    )

    expect(result.phase).toBe('finished')
    expect(result.target).toBe(1000)
    expect(result.winner?.name).toBe('Anna')
    expect(result.players.map((player) => player.score)).toEqual([1000, 500])
  })

  it('rejects later turns that could not exist after an earlier corrected finish', () => {
    expect(() =>
      replayCompletedTurns(
        roster.slice(0, 2),
        [
          turn('player:a', 'Anna', 1000),
          turn('player:b', 'Bert', 500),
          turn('player:a', 'Anna', 100),
        ],
        1000,
        0,
      ),
    ).toThrow(TurnReplayError)
  })

  it('enforces player order, entry minimum and 50-point increments', () => {
    expect(() => replayCompletedTurns(roster, [turn('player:b', 'Bert', 350)], 10_000, 350)).toThrow(
      'Spielerreihenfolge',
    )
    expect(() => replayCompletedTurns(roster, [turn('player:a', 'Anna', 300)], 10_000, 350)).toThrow(
      'mindestens 350',
    )
    expect(() => replayCompletedTurns(roster, [turn('player:a', 'Anna', 375)], 10_000, 0)).toThrow(
      '50er-Schritten',
    )
  })
})
