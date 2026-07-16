import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveGame } from './activeGame'
import {
  consumePausedGame,
  deletePausedGame,
  listPausedGames,
  loadPausedGameStore,
  mergePausedGameStores,
  pauseActiveGame,
  persistPausedGameStore,
  type PausedGameStore,
} from './pausedGames'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-07-16T10:00:00.000Z')

function game(sessionId: string, savedAt = '2026-07-16T09:00:00.000Z'): ActiveGame {
  return {
    sessionId,
    players: [
      { id: 'a', name: 'Gabi', score: 800, busts: 1 },
      { id: 'b', name: 'Mabi', score: 450, busts: 0 },
    ],
    idx: 1,
    round: 3,
    phase: 'active',
    target: 0,
    event: 'Familienabend',
    testMode: false,
    diceMode: 'real',
    goalScore: 10000,
    entryMin: 350,
    kept: [],
    dice: [],
    accumulated: 0,
    turns: [],
    rolled: [],
    thrown: [],
    throwSeq: 0,
    savedAt,
  }
}

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe('paused-game library', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('keeps several paused games instead of replacing the previous one', () => {
    expect(pauseActiveGame(game('game-a'), NOW)).not.toBeNull()
    expect(pauseActiveGame(game('game-b'), NOW + 1000)).not.toBeNull()

    const lists = listPausedGames(loadPausedGameStore(NOW + 2000))
    expect(lists.paused.map((item) => item.sessionId)).toEqual(['game-b', 'game-a'])
    expect(lists.archived).toHaveLength(0)
  })

  it('moves a game to the archive after 14 days without deleting it', () => {
    pauseActiveGame(game('game-a'), NOW)

    const lists = listPausedGames(loadPausedGameStore(NOW + 14 * DAY + 1))
    expect(lists.paused).toHaveLength(0)
    expect(lists.archived).toHaveLength(1)
    expect(lists.archived[0].game?.players[0].score).toBe(800)
  })

  it('consumes an archived game safely and leaves a tombstone against resurrection', () => {
    pauseActiveGame(game('game-a'), NOW)
    const consumed = consumePausedGame('game-a', NOW + 15 * DAY)
    expect(consumed?.game.sessionId).toBe('game-a')
    expect(listPausedGames(consumed!.store).archived).toHaveLength(0)

    const staleRemote: PausedGameStore = {
      schemaVersion: 1,
      items: [
        {
          sessionId: 'game-a',
          status: 'paused',
          changedAt: new Date(NOW).toISOString(),
          pausedAt: new Date(NOW).toISOString(),
          game: game('game-a'),
        },
      ],
    }
    const merged = mergePausedGameStores(consumed!.store, staleRemote, NOW + 15 * DAY)
    expect(listPausedGames(merged).paused).toHaveLength(0)
    expect(merged.items.find((item) => item.sessionId === 'game-a')?.status).toBe('deleted')
  })

  it('merges independent games from two devices', () => {
    const local = persistPausedGameStore(
      {
        schemaVersion: 1,
        items: [
          {
            sessionId: 'game-a',
            status: 'paused',
            changedAt: new Date(NOW).toISOString(),
            pausedAt: new Date(NOW).toISOString(),
            game: game('game-a'),
          },
        ],
      },
      NOW,
    )!
    const remote: PausedGameStore = {
      schemaVersion: 1,
      items: [
        {
          sessionId: 'game-b',
          status: 'paused',
          changedAt: new Date(NOW + 1000).toISOString(),
          pausedAt: new Date(NOW + 1000).toISOString(),
          game: game('game-b'),
        },
      ],
    }

    const merged = mergePausedGameStores(local, remote, NOW + 2000)
    expect(listPausedGames(merged).paused.map((item) => item.sessionId)).toEqual(['game-b', 'game-a'])
  })

  it('keeps a deletion newer than an older copy on another device', () => {
    pauseActiveGame(game('game-a'), NOW)
    const deleted = deletePausedGame('game-a', NOW + 2000)!
    const older: PausedGameStore = {
      schemaVersion: 1,
      items: [
        {
          sessionId: 'game-a',
          status: 'archived',
          changedAt: new Date(NOW + 1000).toISOString(),
          pausedAt: new Date(NOW).toISOString(),
          archivedAt: new Date(NOW + 1000).toISOString(),
          game: game('game-a'),
        },
      ],
    }

    const merged = mergePausedGameStores(deleted, older, NOW + 3000)
    expect(merged.items[0].status).toBe('deleted')
    expect(listPausedGames(merged).archived).toHaveLength(0)
  })
})
