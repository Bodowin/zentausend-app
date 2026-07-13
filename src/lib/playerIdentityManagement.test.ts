import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aggregateStats } from './storage'
import {
  aliasesForIdentity,
  exportPlayerIdentityState,
  getPlayerIdentityRecoveryCount,
  importPlayerIdentityState,
  mergePlayerIdentities,
  playerIdentityKey,
  undoLastPlayerIdentityMerge,
} from './playerIdentity'
import type { GameRecord } from './types'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value))
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  clear() {
    this.data.clear()
  }
}

const history: GameRecord[] = [
  {
    id: 2,
    date: '2026-01-01T00:00:00.000Z',
    event: '',
    winner: 'Bodowin',
    winnerScore: 10_500,
    players: [
      { playerId: 'player-bodowin', name: 'Bodowin', score: 10_500, busts: 0 },
      { playerId: 'player-dana', name: 'Dana', score: 8_000, busts: 1 },
    ],
  },
  {
    id: 1,
    date: '2025-01-01T00:00:00.000Z',
    event: '',
    winner: 'Bodo',
    winnerScore: 10_000,
    players: [
      { playerId: 'player-bodo', name: 'Bodo', score: 10_000, busts: 1 },
      { playerId: 'player-dana', name: 'Dana', score: 7_000, busts: 2 },
    ],
  },
]

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
})

describe('reversible player identity management', () => {
  it('combines two explicit ids while keeping the selected target name', () => {
    const result = mergePlayerIdentities('player-bodowin', 'player-bodo', history)
    const stats = aggregateStats(history)

    expect(result).toEqual({ sourceNames: ['Bodowin'], targetName: 'Bodo' })
    expect(stats).toHaveLength(2)
    expect(stats[0]).toMatchObject({ id: 'player-bodo', name: 'Bodo', games: 2, wins: 2 })
    expect(playerIdentityKey(history[0].players[0])).toBe('player-bodo')
    expect(aliasesForIdentity('player-bodo', history)).toEqual(['Bodo', 'Bodowin'])
    expect(getPlayerIdentityRecoveryCount()).toBe(1)
  })

  it('restores the previous identity state with one undo', () => {
    mergePlayerIdentities('player-bodowin', 'player-bodo', history)
    expect(undoLastPlayerIdentityMerge()).toBe(true)

    const stats = aggregateStats(history)
    expect(stats).toHaveLength(3)
    expect(playerIdentityKey(history[0].players[0])).toBe('player-bodowin')
    expect(getPlayerIdentityRecoveryCount()).toBe(0)
  })

  it('exports and imports identity state without overwriting conflicts', () => {
    mergePlayerIdentities('player-bodowin', 'player-bodo', history)
    const portable = exportPlayerIdentityState()

    vi.stubGlobal('localStorage', new MemoryStorage())
    const imported = importPlayerIdentityState(portable)
    expect(imported.imported).toBeGreaterThan(0)
    expect(imported.conflicts).toBe(0)
    expect(playerIdentityKey(history[0].players[0])).toBe('player-bodo')

    const conflict = importPlayerIdentityState({
      aliases: {},
      redirects: { 'player-bodowin': 'another-player' },
      preferredNames: {},
    })
    expect(conflict.conflicts).toBe(1)
    expect(playerIdentityKey(history[0].players[0])).toBe('player-bodo')
  })
})
