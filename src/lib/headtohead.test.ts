import { describe, expect, it } from 'vitest'
import { computeHeadToHead, computeNemesis } from './storage'
import type { GameRecord } from './types'

function game(id: number, winner: string, players: [string, number][], event = ''): GameRecord {
  return {
    id,
    date: new Date(2026, 0, id).toISOString(),
    event,
    winner,
    winnerScore: players.find(([n]) => n === winner)?.[1] ?? 0,
    players: players.map(([name, score]) => ({ name, score, busts: 0 })),
    turns: [],
  }
}

const history: GameRecord[] = [
  game(1, 'Bodo', [['Bodo', 10000], ['Dana', 8200], ['Gabi', 6000]]),
  game(2, 'Dana', [['Dana', 10000], ['Bodo', 9500]]),
  game(3, 'Dana', [['Dana', 10000], ['Bodo', 4000], ['Gabi', 9000]], 'Skiurlaub'),
]

describe('computeHeadToHead', () => {
  it('zählt gemeinsame Spiele, Vorsprünge und Siege korrekt', () => {
    const h = computeHeadToHead('Bodo', 'Dana', history)
    expect(h.games).toBe(3)
    expect(h.aWins).toBe(1)
    expect(h.bWins).toBe(2)
    // Bodo lag nur im 1. Spiel vor Dana
    expect(h.aAhead).toBe(1)
    expect(h.bAhead).toBe(2)
    expect(h.aBest).toBe(10000)
    expect(h.bBest).toBe(10000)
  })

  it('ignoriert Spiele, in denen einer fehlt, und respektiert den Event-Filter', () => {
    const h = computeHeadToHead('Bodo', 'Gabi', history)
    expect(h.games).toBe(2) // Spiel 2 hat kein Gabi
    const ev = computeHeadToHead('Bodo', 'Dana', history, 'Skiurlaub')
    expect(ev.games).toBe(1)
  })

  it('liefert leeres Ergebnis für identische Spieler', () => {
    expect(computeHeadToHead('Bodo', 'Bodo', history).games).toBe(0)
  })
})

describe('computeNemesis', () => {
  it('findet den Gegner, der am häufigsten vor einem landet', () => {
    // Dana lag in 2 von 3 gemeinsamen Spielen vor Bodo (Spiel 1 gewann Bodo).
    const n = computeNemesis('Bodo', history)
    expect(n?.name).toBe('Dana')
    expect(n?.ahead).toBe(2)
    expect(n?.of).toBe(3)
  })

  it('wählt bei Gleichstand die höhere Quote', () => {
    // Gabi: gegen Dana 2/2 vorn, gegen Bodo 1/2 → Dana ist Angstgegner.
    const n = computeNemesis('Gabi', history)
    expect(n?.name).toBe('Dana')
    expect(n?.ahead).toBe(2)
  })

  it('gibt null zurück, wenn es keinen passenden Gegner gibt', () => {
    expect(computeNemesis('Mabi', history)).toBeNull()
  })
})
