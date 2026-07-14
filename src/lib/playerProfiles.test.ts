import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameRecord } from './types'
import { computePlayerProfile } from './playerProfiles'

const games: GameRecord[] = [
  {
    id: 1,
    date: '2026-01-01T18:00:00.000Z',
    event: 'Urlaub',
    winner: 'Bodo',
    winnerScore: 10500,
    players: [
      { playerId: 'player-bodo', name: 'Bodo', score: 10500, busts: 1 },
      { playerId: 'player-gabi', name: 'Gabi', score: 8000, busts: 2 },
    ],
    turns: [
      { round: 1, player: 'Bodo', playerId: 'player-bodo', points: 1000, bust: false },
      { round: 2, player: 'Bodo', playerId: 'player-bodo', points: 0, bust: true },
      { round: 3, player: 'Bodo', playerId: 'player-bodo', points: 2000, bust: false },
      { round: 4, player: 'Bodo', playerId: 'player-bodo', points: 7500, bust: false },
      { round: 4, player: 'Gabi', playerId: 'player-gabi', points: 8000, bust: false },
    ],
  },
  {
    id: 2,
    date: '2026-01-02T18:00:00.000Z',
    event: 'Urlaub',
    winner: 'Gabi',
    winnerScore: 10000,
    players: [
      { playerId: 'player-bodo', name: 'Bodo', score: 9000, busts: 2 },
      { playerId: 'player-gabi', name: 'Gabi', score: 10000, busts: 0 },
    ],
  },
  {
    id: 3,
    date: '2026-02-01T18:00:00.000Z',
    event: 'Familie',
    winner: 'Bodowin',
    winnerScore: 11000,
    players: [
      { playerId: 'player-bodo', name: 'Bodowin', score: 11000, busts: 0 },
      { playerId: 'player-gabi', name: 'Gabi', score: 7000, busts: 1 },
    ],
    turns: [
      { round: 1, player: 'Bodowin', playerId: 'player-bodo', points: 5000, bust: false },
      { round: 3, player: 'Bodowin', playerId: 'player-bodo', points: 6000, bust: false },
    ],
  },
  {
    id: 4,
    date: '2026-02-02T18:00:00.000Z',
    event: 'Familie',
    winner: 'Bodowin',
    winnerScore: 12000,
    players: [
      { playerId: 'player-bodo', name: 'Bodowin', score: 12000, busts: 0 },
      { playerId: 'player-gabi', name: 'Gabi', score: 9000, busts: 0 },
    ],
    turns: [
      { round: 1, player: 'Bodowin', playerId: 'player-bodo', points: 4000, bust: false },
      { round: 2, player: 'Bodowin', playerId: 'player-bodo', points: 8000, bust: false },
    ],
  },
]

describe('computePlayerProfile', () => {
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

  it('aggregates stable identities, streaks and recent results', () => {
    const profile = computePlayerProfile('player-bodo', games, undefined, 3)

    expect(profile).toMatchObject({
      id: 'player-bodo',
      name: 'Bodowin',
      games: 4,
      wins: 3,
      winRate: 0.75,
      totalScore: 42500,
      avgScore: 10625,
      bestScore: 12000,
      busts: 3,
      bustsPerGame: 0.75,
      longestWinStreak: 2,
      currentWinStreak: 2,
      gamesWithTurnData: 3,
      successfulTurns: 7,
      bustTurns: 1,
      avgSuccessfulTurn: 4786,
      avgRounds: 3,
      fastestWinRounds: 2,
    })
    expect(profile?.bestTurn).toMatchObject({ points: 8000, round: 2 })
    expect(profile?.recentResults.map((result) => result.gameId)).toEqual([4, 3, 2])
    expect(profile?.recentResults.map((result) => result.won)).toEqual([true, true, false])
  })

  it('keeps older games without turns in core metrics and reports turn coverage honestly', () => {
    const profile = computePlayerProfile('Bodo', games)

    expect(profile?.games).toBe(4)
    expect(profile?.gamesWithTurnData).toBe(3)
    expect(profile?.successfulTurns).toBe(7)
    expect(profile?.events).toEqual([
      { event: 'Familie', games: 2, wins: 2, winRate: 1, avgScore: 11500 },
      { event: 'Urlaub', games: 2, wins: 1, winRate: 0.5, avgScore: 9750 },
    ])
  })

  it('respects an event filter without changing the stable identity', () => {
    const profile = computePlayerProfile('player-bodo', games, 'Urlaub')

    expect(profile).toMatchObject({ id: 'player-bodo', games: 2, wins: 1, avgScore: 9750 })
    expect(profile?.events).toEqual([
      { event: 'Urlaub', games: 2, wins: 1, winRate: 0.5, avgScore: 9750 },
    ])
  })

  it('returns null for players without matching games', () => {
    expect(computePlayerProfile('player-unknown', games)).toBeNull()
  })
})
