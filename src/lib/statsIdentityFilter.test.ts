import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameRecord } from './types'
import { aggregateStats } from './storage'

const history: GameRecord[] = [
  {
    id: 1,
    date: '2026-01-01T18:00:00.000Z',
    event: 'Urlaub',
    winner: 'Bodo',
    winnerScore: 10000,
    players: [
      { playerId: 'player-bodo', name: 'Bodo', score: 10000, busts: 0 },
      { playerId: 'player-gabi', name: 'Gabi', score: 8000, busts: 1 },
    ],
  },
  {
    id: 2,
    date: '2026-02-01T18:00:00.000Z',
    event: 'Familie',
    winner: 'Bodowin',
    winnerScore: 11000,
    players: [
      { playerId: 'player-bodo', name: 'Bodowin', score: 11000, busts: 0 },
      { playerId: 'player-gabi', name: 'Gabi', score: 9000, busts: 0 },
    ],
  },
]

describe('aggregateStats identity display names', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      get length() { return values.size },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => { values.delete(key) },
      setItem: (key: string, value: string) => { values.set(key, value) },
    } satisfies Storage)
  })

  it('keeps the newest global display name while filtering statistics by event', () => {
    const stats = aggregateStats(history, 'Urlaub')
    expect(stats.find((player) => player.id === 'player-bodo')).toMatchObject({
      name: 'Bodowin',
      games: 1,
      wins: 1,
    })
  })
})
