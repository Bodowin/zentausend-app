import { describe, expect, it } from 'vitest'
import { computeGameAwards, gameAwardNames } from './gameAwards'
import type { Player, Turn } from './types'

const players: Player[] = [
  { id: 'a', name: 'Gabi', score: 10_350, busts: 1 },
  { id: 'b', name: 'Mabi', score: 8_200, busts: 3 },
  { id: 'c', name: 'Bodo', score: 7_600, busts: 0 },
]

const turns: Turn[] = [
  { round: 1, player: 'Gabi', points: 500, bust: false },
  { round: 1, player: 'Mabi', points: 0, bust: true },
  { round: 1, player: 'Bodo', points: 400, bust: false },
  { round: 2, player: 'Gabi', points: 1_200, bust: false },
  { round: 2, player: 'Mabi', points: 300, bust: false },
  { round: 2, player: 'Bodo', points: 400, bust: false },
]

describe('computeGameAwards', () => {
  it('builds high-roller, efficiency and pechvogel awards deterministically', () => {
    const awards = computeGameAwards(players, turns)

    expect(awards.map((award) => award.id)).toEqual(['high-roller', 'efficiency', 'pechvogel'])
    expect(awards[0]).toMatchObject({ names: ['Gabi'], detail: '1.200 Punkte in einem Zug' })
    expect(awards[1]).toMatchObject({ names: ['Gabi'], detail: '850 Punkte Ø pro Zug' })
    expect(awards[2]).toMatchObject({ names: ['Mabi'], detail: '3 Nieten' })
  })

  it('keeps ties visible instead of choosing an arbitrary player', () => {
    const tiedTurns: Turn[] = [
      { round: 1, player: 'Gabi', points: 1_000, bust: false },
      { round: 1, player: 'Mabi', points: 1_000, bust: false },
    ]
    const tiedPlayers = players.map((player) => ({ ...player, busts: 1 }))
    const awards = computeGameAwards(tiedPlayers, tiedTurns)

    expect(awards[0].names).toEqual(['Gabi', 'Mabi'])
    expect(gameAwardNames(awards[0])).toBe('Gabi & Mabi')
    expect(awards[awards.length - 1]?.names).toEqual(['Gabi', 'Mabi', 'Bodo'])
  })

  it('omits turn-based awards when no turn history exists', () => {
    const awards = computeGameAwards(players, [])
    expect(awards.map((award) => award.id)).toEqual(['pechvogel'])
  })
})
