import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveGame } from './activeGame'
import {
  deletePausedGame,
  isArchivedPausedGame,
  loadPausedGames,
  mergePausedGameRecords,
  readPausedGameRecords,
  savePausedGame,
  splitPausedGames,
  takePausedGame,
} from './pausedGames'

const game = (sessionId: string, savedAt: string, score = 500): ActiveGame => ({
  sessionId,
  players: [
    { id: 'a', name: 'Gabi', score, busts: 0 },
    { id: 'b', name: 'Mabi', score: 50, busts: 1 },
  ],
  idx: 0,
  round: 2,
  phase: 'active',
  target: 0,
  event: sessionId,
  testMode: false,
  diceMode: 'real',
  goalScore: 10000,
  entryMin: 350,
  kept: [],
  dice: [],
  accumulated: 0,
  turns: [
    { round: 1, player: 'Gabi', playerId: 'a', points: score, bust: false },
    { round: 1, player: 'Mabi', playerId: 'b', points: 0, bust: true },
  ],
  rolled: [],
  thrown: [],
  throwSeq: 0,
  savedAt,
})

describe('paused games library', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    const storage = {
      get length() { return values.size },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => { values.delete(key) },
      setItem: (key: string, value: string) => { values.set(key, value) },
    } satisfies Storage
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('keeps multiple paused games and deduplicates by session id', () => {
    savePausedGame(game('urlaub', '2026-07-15T10:00:00.000Z', 500), Date.parse('2026-07-15T10:01:00.000Z'))
    savePausedGame(game('familie', '2026-07-14T10:00:00.000Z', 350), Date.parse('2026-07-15T10:02:00.000Z'))
    savePausedGame(game('urlaub', '2026-07-15T11:00:00.000Z', 700), Date.parse('2026-07-15T11:01:00.000Z'))

    expect(loadPausedGames()).toHaveLength(2)
    expect(loadPausedGames().find((entry) => entry.sessionId === 'urlaub')?.players[0].score).toBe(700)
  })

  it('moves games to the archive view after fourteen days without deleting them', () => {
    const now = Date.parse('2026-07-16T12:00:00.000Z')
    const recent = game('recent', '2026-07-03T12:00:01.000Z')
    const archived = game('archived', '2026-07-02T12:00:00.000Z')

    expect(isArchivedPausedGame(recent, now)).toBe(false)
    expect(isArchivedPausedGame(archived, now)).toBe(true)
    expect(splitPausedGames([recent, archived], now)).toEqual({ paused: [recent], archived: [archived] })
  })

  it('marks resumed or deleted games with a tombstone so another device cannot revive them', () => {
    const saved = game('urlaub', '2026-07-15T10:00:00.000Z')
    savePausedGame(saved, Date.parse('2026-07-15T10:01:00.000Z'))

    expect(takePausedGame('urlaub', Date.parse('2026-07-15T10:02:00.000Z'))?.sessionId).toBe('urlaub')
    expect(loadPausedGames()).toEqual([])
    expect(readPausedGameRecords()[0]).toMatchObject({ sessionId: 'urlaub', status: 'deleted' })
  })

  it('lets the newest cloud tombstone win over an older paused copy', () => {
    const pausedAt = '2026-07-15T10:01:00.000Z'
    const deletedAt = '2026-07-15T10:02:00.000Z'
    const merged = mergePausedGameRecords(
      [{ sessionId: 'urlaub', status: 'paused', updatedAt: pausedAt, game: game('urlaub', pausedAt) }],
      [{ sessionId: 'urlaub', status: 'deleted', updatedAt: deletedAt, game: null }],
      Date.parse('2026-07-15T10:03:00.000Z'),
    )

    expect(merged).toEqual([{ sessionId: 'urlaub', status: 'deleted', updatedAt: deletedAt, game: null }])
  })

  it('can explicitly delete one game without touching the others', () => {
    savePausedGame(game('one', '2026-07-15T10:00:00.000Z'), Date.parse('2026-07-15T10:01:00.000Z'))
    savePausedGame(game('two', '2026-07-15T10:00:00.000Z'), Date.parse('2026-07-15T10:02:00.000Z'))
    deletePausedGame('one', Date.parse('2026-07-15T10:03:00.000Z'))

    expect(loadPausedGames().map((entry) => entry.sessionId)).toEqual(['two'])
    expect(readPausedGameRecords().find((entry) => entry.sessionId === 'one')?.status).toBe('deleted')
  })
})
