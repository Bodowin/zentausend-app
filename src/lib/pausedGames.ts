import { parseActiveGame, type ActiveGame } from './activeGame'

const KEY = '10k_paused_games_v1'
const SCHEMA_VERSION = 1
const DAY_MS = 24 * 60 * 60 * 1000
const TOMBSTONE_RETENTION_MS = 180 * DAY_MS

export const PAUSED_GAME_ARCHIVE_AFTER_DAYS = 14

export type PausedGameRecord = {
  sessionId: string
  status: 'paused' | 'deleted'
  updatedAt: string
  game: ActiveGame | null
}

type PausedGamesEnvelope = {
  schemaVersion: 1
  records: PausedGameRecord[]
}

function timestamp(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isoNow(now = Date.now()): string {
  return new Date(now).toISOString()
}

function parseRecord(value: unknown): PausedGameRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Partial<PausedGameRecord>
  if (typeof record.sessionId !== 'string' || !record.sessionId.trim()) return null
  if (record.status !== 'paused' && record.status !== 'deleted') return null
  if (typeof record.updatedAt !== 'string' || timestamp(record.updatedAt) <= 0) return null

  if (record.status === 'deleted') {
    return {
      sessionId: record.sessionId,
      status: 'deleted',
      updatedAt: record.updatedAt,
      game: null,
    }
  }

  const game = parseActiveGame(JSON.stringify(record.game ?? null))
  if (!game || game.sessionId !== record.sessionId) return null
  return {
    sessionId: record.sessionId,
    status: 'paused',
    updatedAt: record.updatedAt,
    game,
  }
}

export function normalizePausedGameRecords(values: unknown, now = Date.now()): PausedGameRecord[] {
  if (!Array.isArray(values)) return []
  const newest = new Map<string, PausedGameRecord>()

  for (const candidate of values) {
    const record = parseRecord(candidate)
    if (!record) continue
    const previous = newest.get(record.sessionId)
    if (!previous) {
      newest.set(record.sessionId, record)
      continue
    }

    const nextTime = timestamp(record.updatedAt)
    const previousTime = timestamp(previous.updatedAt)
    if (nextTime > previousTime || (nextTime === previousTime && record.status === 'deleted')) {
      newest.set(record.sessionId, record)
    }
  }

  return [...newest.values()]
    .filter(
      (record) =>
        record.status === 'paused' || now - timestamp(record.updatedAt) <= TOMBSTONE_RETENTION_MS,
    )
    .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
}

function parseEnvelope(raw: string | null): PausedGameRecord[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw) as Partial<PausedGamesEnvelope> | PausedGameRecord[]
    if (Array.isArray(value)) return normalizePausedGameRecords(value)
    if (value.schemaVersion !== SCHEMA_VERSION) return []
    return normalizePausedGameRecords(value.records)
  } catch {
    return []
  }
}

export function readPausedGameRecords(): PausedGameRecord[] {
  try {
    return parseEnvelope(localStorage.getItem(KEY))
  } catch {
    return []
  }
}

export function replacePausedGameRecords(records: PausedGameRecord[]): PausedGameRecord[] {
  const normalized = normalizePausedGameRecords(records)
  const envelope: PausedGamesEnvelope = { schemaVersion: SCHEMA_VERSION, records: normalized }
  try {
    localStorage.setItem(KEY, JSON.stringify(envelope))
  } catch {
    /* Eine volle Gerätespeicherung darf das laufende Spiel nicht blockieren. */
  }
  return normalized
}

export function mergePausedGameRecords(
  local: PausedGameRecord[],
  remote: PausedGameRecord[],
  now = Date.now(),
): PausedGameRecord[] {
  return normalizePausedGameRecords([...local, ...remote], now)
}

export function loadPausedGames(): ActiveGame[] {
  return readPausedGameRecords()
    .filter((record): record is PausedGameRecord & { status: 'paused'; game: ActiveGame } =>
      record.status === 'paused' && Boolean(record.game),
    )
    .map((record) => record.game)
    .sort((a, b) => timestamp(b.savedAt) - timestamp(a.savedAt))
}

export function savePausedGame(game: ActiveGame, now = Date.now()): ActiveGame | null {
  const validated = parseActiveGame(JSON.stringify(game))
  if (!validated) return null
  const records = readPausedGameRecords().filter((record) => record.sessionId !== validated.sessionId)
  replacePausedGameRecords([
    {
      sessionId: validated.sessionId,
      status: 'paused',
      updatedAt: isoNow(now),
      game: validated,
    },
    ...records,
  ])
  return validated
}

export function deletePausedGame(sessionId: string, now = Date.now()): void {
  if (!sessionId) return
  const records = readPausedGameRecords().filter((record) => record.sessionId !== sessionId)
  replacePausedGameRecords([
    {
      sessionId,
      status: 'deleted',
      updatedAt: isoNow(now),
      game: null,
    },
    ...records,
  ])
}

export function takePausedGame(sessionId: string, now = Date.now()): ActiveGame | null {
  const game = loadPausedGames().find((candidate) => candidate.sessionId === sessionId) ?? null
  if (game) deletePausedGame(sessionId, now)
  return game
}

export function isArchivedPausedGame(game: ActiveGame, now = Date.now()): boolean {
  const saved = timestamp(game.savedAt)
  if (saved <= 0) return true
  return now - saved >= PAUSED_GAME_ARCHIVE_AFTER_DAYS * DAY_MS
}

export function splitPausedGames(
  games: ActiveGame[],
  now = Date.now(),
): { paused: ActiveGame[]; archived: ActiveGame[] } {
  const paused: ActiveGame[] = []
  const archived: ActiveGame[] = []
  for (const game of games) {
    ;(isArchivedPausedGame(game, now) ? archived : paused).push(game)
  }
  return { paused, archived }
}
