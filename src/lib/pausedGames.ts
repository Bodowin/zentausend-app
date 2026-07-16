import { parseActiveGame, type ActiveGame } from './activeGame'

const STORAGE_KEY = '10k_paused_games_v1'
const DAY_MS = 24 * 60 * 60 * 1000
export const PAUSE_ARCHIVE_AFTER_DAYS = 14
const TOMBSTONE_RETENTION_DAYS = 90

export type PausedGameStatus = 'paused' | 'archived' | 'deleted'

export interface PausedGameItem {
  sessionId: string
  status: PausedGameStatus
  /** Letzte fachliche Änderung für konfliktfreies Zusammenführen mehrerer Geräte. */
  changedAt: string
  /** Zeitpunkt, an dem das Spiel aus dem aktiven Slot in die Bibliothek verschoben wurde. */
  pausedAt: string
  /** Ab 14 Tagen automatisch gesetzt; das Spiel bleibt wiederherstellbar. */
  archivedAt?: string
  game: ActiveGame | null
}

export interface PausedGameStore {
  schemaVersion: 1
  items: PausedGameItem[]
}

export interface PausedGameLists {
  paused: PausedGameItem[]
  archived: PausedGameItem[]
}

const emptyStore = (): PausedGameStore => ({ schemaVersion: 1, items: [] })

function timestamp(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function statusRank(status: PausedGameStatus): number {
  return status === 'deleted' ? 3 : status === 'archived' ? 2 : 1
}

function newerItem(a: PausedGameItem, b: PausedGameItem): PausedGameItem {
  const aTime = timestamp(a.changedAt)
  const bTime = timestamp(b.changedAt)
  if (aTime !== bTime) return aTime > bTime ? a : b
  if (statusRank(a.status) !== statusRank(b.status)) return statusRank(a.status) > statusRank(b.status) ? a : b
  const aSaved = a.game ? timestamp(a.game.savedAt) : 0
  const bSaved = b.game ? timestamp(b.game.savedAt) : 0
  return aSaved >= bSaved ? a : b
}

function parseItem(value: unknown): PausedGameItem | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<PausedGameItem>
  if (typeof item.sessionId !== 'string' || !item.sessionId.trim()) return null
  if (item.status !== 'paused' && item.status !== 'archived' && item.status !== 'deleted') return null
  if (typeof item.changedAt !== 'string' || !timestamp(item.changedAt)) return null
  if (typeof item.pausedAt !== 'string' || !timestamp(item.pausedAt)) return null

  if (item.status === 'deleted') {
    return {
      sessionId: item.sessionId,
      status: 'deleted',
      changedAt: item.changedAt,
      pausedAt: item.pausedAt,
      archivedAt: typeof item.archivedAt === 'string' ? item.archivedAt : undefined,
      game: null,
    }
  }

  const game = parseActiveGame(JSON.stringify(item.game ?? null))
  if (!game || game.sessionId !== item.sessionId) return null
  return {
    sessionId: item.sessionId,
    status: item.status,
    changedAt: item.changedAt,
    pausedAt: item.pausedAt,
    archivedAt: typeof item.archivedAt === 'string' ? item.archivedAt : undefined,
    game,
  }
}

export function normalizePausedGameStore(store: PausedGameStore, now = Date.now()): PausedGameStore {
  const nowIso = new Date(now).toISOString()
  const bySession = new Map<string, PausedGameItem>()

  for (const raw of store.items) {
    const item = parseItem(raw)
    if (!item) continue
    const existing = bySession.get(item.sessionId)
    bySession.set(item.sessionId, existing ? newerItem(existing, item) : item)
  }

  const normalized: PausedGameItem[] = []
  for (const item of bySession.values()) {
    if (item.status === 'deleted') {
      if (now - timestamp(item.changedAt) <= TOMBSTONE_RETENTION_DAYS * DAY_MS) normalized.push(item)
      continue
    }

    if (item.status === 'paused' && now - timestamp(item.pausedAt) >= PAUSE_ARCHIVE_AFTER_DAYS * DAY_MS) {
      normalized.push({ ...item, status: 'archived', archivedAt: nowIso, changedAt: nowIso })
      continue
    }
    normalized.push(item)
  }

  normalized.sort((a, b) => a.sessionId.localeCompare(b.sessionId))
  return { schemaVersion: 1, items: normalized }
}

export function parsePausedGameStore(raw: string | null, now = Date.now()): PausedGameStore | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<PausedGameStore>
    if (value.schemaVersion !== 1 || !Array.isArray(value.items)) return null
    return normalizePausedGameStore({ schemaVersion: 1, items: value.items as PausedGameItem[] }, now)
  } catch {
    return null
  }
}

export function persistPausedGameStore(store: PausedGameStore, now = Date.now()): PausedGameStore | null {
  const normalized = normalizePausedGameStore(store, now)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    return normalized
  } catch {
    return null
  }
}

export function loadPausedGameStore(now = Date.now()): PausedGameStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = parsePausedGameStore(raw, now) ?? emptyStore()
    if (raw !== JSON.stringify(parsed)) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      } catch {
        /* Die gelesene Bibliothek bleibt trotzdem nutzbar. */
      }
    }
    return parsed
  } catch {
    return emptyStore()
  }
}

export function pauseActiveGame(game: ActiveGame, now = Date.now()): PausedGameStore | null {
  const validated = parseActiveGame(JSON.stringify(game))
  if (!validated) return null
  const nowIso = new Date(now).toISOString()
  const current = loadPausedGameStore(now)
  const next: PausedGameStore = {
    schemaVersion: 1,
    items: [
      ...current.items.filter((item) => item.sessionId !== validated.sessionId),
      {
        sessionId: validated.sessionId,
        status: 'paused',
        changedAt: nowIso,
        pausedAt: nowIso,
        game: validated,
      },
    ],
  }
  return persistPausedGameStore(next, now)
}

export function consumePausedGame(
  sessionId: string,
  now = Date.now(),
): { game: ActiveGame; store: PausedGameStore } | null {
  const current = loadPausedGameStore(now)
  const item = current.items.find((candidate) => candidate.sessionId === sessionId)
  if (!item || item.status === 'deleted' || !item.game) return null
  const nowIso = new Date(now).toISOString()
  const next: PausedGameStore = {
    schemaVersion: 1,
    items: current.items.map((candidate) =>
      candidate.sessionId === sessionId
        ? { ...candidate, status: 'deleted' as const, changedAt: nowIso, game: null }
        : candidate,
    ),
  }
  const stored = persistPausedGameStore(next, now)
  return stored ? { game: item.game, store: stored } : null
}

export function deletePausedGame(sessionId: string, now = Date.now()): PausedGameStore | null {
  const current = loadPausedGameStore(now)
  const item = current.items.find((candidate) => candidate.sessionId === sessionId)
  if (!item || item.status === 'deleted') return current
  const nowIso = new Date(now).toISOString()
  return persistPausedGameStore(
    {
      schemaVersion: 1,
      items: current.items.map((candidate) =>
        candidate.sessionId === sessionId
          ? { ...candidate, status: 'deleted' as const, changedAt: nowIso, game: null }
          : candidate,
      ),
    },
    now,
  )
}

export function mergePausedGameStores(
  local: PausedGameStore,
  remote: PausedGameStore,
  now = Date.now(),
): PausedGameStore {
  const merged = new Map<string, PausedGameItem>()
  for (const item of [...local.items, ...remote.items]) {
    const parsed = parseItem(item)
    if (!parsed) continue
    const current = merged.get(parsed.sessionId)
    merged.set(parsed.sessionId, current ? newerItem(current, parsed) : parsed)
  }
  return normalizePausedGameStore({ schemaVersion: 1, items: [...merged.values()] }, now)
}

export function listPausedGames(store: PausedGameStore): PausedGameLists {
  const live = store.items.filter((item) => item.status !== 'deleted' && item.game)
  const newestFirst = (a: PausedGameItem, b: PausedGameItem) => timestamp(b.pausedAt) - timestamp(a.pausedAt)
  return {
    paused: live.filter((item) => item.status === 'paused').sort(newestFirst),
    archived: live.filter((item) => item.status === 'archived').sort(newestFirst),
  }
}

export function pausedGameStorageKey(): string {
  return STORAGE_KEY
}
