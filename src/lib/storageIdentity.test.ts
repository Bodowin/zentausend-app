import { describe, expect, it } from 'vitest'
import { aggregateStats, computeForm, computeHeadToHead, computeNemesis } from './storage'
import { legacyPlayerId } from './playerIdentity'
import type { GameRecord } from './types'

const gabiId = legacyPlayerId('Gabi')
const danaId = legacyPlayerId('Dana')

const history: GameRecord[] = [
  {
    id: 2,
    date: '2026-01-01T00:00:00.000Z',
    event: 'Urlaub',
    winner: 'Gabriela',
    winnerScore: 10_500,
    players: [
      { playerId: gabiId, name: 'Gabriela', score: 10_500, busts: 0 },
      { playerId: danaId, name: 'Dana', score: 7_500, busts: 1 },
    ],
  },
  {
    id: 1,
    date: '2025-01-01T00:00:00.000Z',
    event: 'Urlaub',
    winner: 'Gabi',
    winnerScore: 10_000,
    players: [
      { name: 'Gabi', score: 10_000, busts: 1 },
      { name: 'Dana', score: 8_000, busts: 2 },
    ],
  },
]

describe('identity-aware historical statistics', () => {
  it('combines old and renamed records under one stable identity', () => {
    const stats = aggregateStats(history)
    expect(stats).toHaveLength(2)
    expect(stats[0]).toMatchObject({ id: gabiId, name: 'Gabriela', games: 2, wins: 2, bestScore: 10_500 })
  })

  it('combines current form across a rename', () => {
    const form = computeForm(history)
    expect(form).toContainEqual({ id: gabiId, name: 'Gabriela', results: [true, true], games: 2 })
  })

  it('computes a duel by stable ids', () => {
    const duel = computeHeadToHead(gabiId, danaId, history)
    expect(duel).toMatchObject({ games: 2, aAhead: 2, bAhead: 0, aWins: 2, bWins: 0 })
  })

  it('keeps the newest display name for nemesis output', () => {
    const nemesis = computeNemesis(danaId, history)
    expect(nemesis).toEqual({ id: gabiId, name: 'Gabriela', ahead: 2, of: 2 })
  })
})
