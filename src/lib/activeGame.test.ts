import { describe, expect, it } from 'vitest'
import { parseActiveGame } from './activeGame'

const base = {
  players: [
    { id: 'a', name: 'Bodo', score: 500, busts: 1 },
    { id: 'b', name: 'Dana', score: 350, busts: 0 },
  ],
  idx: 0,
  round: 2,
  phase: 'active' as const,
  target: 0,
  event: 'Urlaub',
  testMode: false,
  diceMode: 'virtual' as const,
  goalScore: 10000,
  entryMin: 350,
  kept: [1],
  dice: [5],
  accumulated: 0,
  turns: [{ round: 1, player: 'Bodo', points: 500, bust: false }],
  rolled: [2, 3, 4, 6],
  thrown: [2, 3, 4, 5, 6],
  throwSeq: 4,
  savedAt: '2026-07-13T12:00:00.000Z',
}

describe('parseActiveGame', () => {
  it('behält das unveränderliche Ergebnis eines virtuellen Wurfs', () => {
    const parsed = parseActiveGame(JSON.stringify(base))
    expect(parsed?.thrown).toEqual([2, 3, 4, 5, 6])
    expect(parsed?.dice).toEqual([5])
    expect(parsed?.rolled).toEqual([2, 3, 4, 6])
    expect(parsed?.throwSeq).toBe(4)
  })

  it('verwirft virtuelle Stände mit duplizierten oder verschwundenen Würfeln', () => {
    const corrupted = { ...base, rolled: [2, 3, 4, 4] }
    expect(parseActiveGame(JSON.stringify(corrupted))).toBeNull()
  })

  it('akzeptiert Legacy-Stände ohne thrown für eine sichere Rekonstruktion', () => {
    const { thrown: _thrown, throwSeq: _throwSeq, ...legacy } = base
    const parsed = parseActiveGame(JSON.stringify(legacy))
    expect(parsed).not.toBeNull()
    expect(parsed?.thrown).toEqual([])
  })

  it('verwirft ungültige Spieler- und Rundendaten früh', () => {
    expect(parseActiveGame(JSON.stringify({ ...base, idx: 9 }))).toBeNull()
    expect(parseActiveGame(JSON.stringify({ ...base, round: 0 }))).toBeNull()
    expect(parseActiveGame(JSON.stringify({ ...base, players: [{ id: '', name: '', score: -1, busts: -1 }] }))).toBeNull()
  })
})
