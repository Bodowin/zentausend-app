import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  identityNameMap,
  legacyPlayerId,
  normalizePlayerName,
  playerIdForName,
  playerIdentityKey,
  resolveIdentitySelector,
  winnerIdentityKey,
} from './playerIdentity'
import type { GameRecord } from './types'

const oldGame: GameRecord = {
  id: 1,
  date: '2025-01-01T00:00:00.000Z',
  event: '',
  winner: 'Gabi',
  winnerScore: 10_000,
  players: [
    { name: 'Gabi', score: 10_000, busts: 1 },
    { name: 'Dana', score: 8_000, busts: 2 },
  ],
}

const renamedGame: GameRecord = {
  id: 2,
  date: '2026-01-01T00:00:00.000Z',
  event: '',
  winner: 'Gabriela',
  winnerScore: 10_500,
  players: [
    { playerId: legacyPlayerId('Gabi'), name: 'Gabriela', score: 10_500, busts: 0 },
    { playerId: legacyPlayerId('Dana'), name: 'Dana', score: 7_500, busts: 1 },
  ],
}

afterEach(() => vi.unstubAllGlobals())

describe('player identity helpers', () => {
  it('normalizes harmless name differences deterministically', () => {
    expect(normalizePlayerName('  GABI   B. ')).toBe('gabi b.')
    expect(legacyPlayerId('Gabi')).toBe(legacyPlayerId(' gabi '))
  })

  it('prefers an explicit stable player id', () => {
    expect(playerIdentityKey({ playerId: 'player-123', name: 'Beliebig' })).toBe('player-123')
  })

  it('keeps a renamed player on the old identity', () => {
    expect(playerIdentityKey(renamedGame.players[0])).toBe(playerIdentityKey(oldGame.players[0]))
    expect(identityNameMap([oldGame, renamedGame]).get(legacyPlayerId('Gabi'))).toBe('Gabriela')
  })

  it('resolves selectors by id or historical display name', () => {
    const history = [renamedGame, oldGame]
    expect(resolveIdentitySelector(legacyPlayerId('Gabi'), history)).toBe(legacyPlayerId('Gabi'))
    expect(resolveIdentitySelector('Gabi', history)).toBe(legacyPlayerId('Gabi'))
  })

  it('derives the winner identity from the matching game player', () => {
    expect(winnerIdentityKey(renamedGame)).toBe(legacyPlayerId('Gabi'))
  })

  it('learns an unambiguous explicit id from synced local history', () => {
    const history = JSON.stringify([renamedGame])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key === '10k_history_v3' ? history : null),
      setItem: () => undefined,
    })

    expect(playerIdForName('Gabriela')).toBe(legacyPlayerId('Gabi'))
  })

  it('does not infer an alias when the same name has conflicting ids', () => {
    const history = JSON.stringify([
      renamedGame,
      {
        ...renamedGame,
        id: 3,
        players: [{ playerId: 'different-id', name: 'Gabriela', score: 9_000, busts: 0 }],
      },
    ])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key === '10k_history_v3' ? history : null),
      setItem: () => undefined,
    })

    expect(playerIdForName('Gabriela')).toBe(legacyPlayerId('Gabriela'))
  })
})
