import { getSupabase } from './supabase'
import { getHistory, recordHistoryValidation, removeGame, replaceHistory, setGameEvent } from './storage'
import { validateGameRecordArray } from './gameRecordValidation'
import { syncPlayerIdentityState } from './playerIdentityCloud'
import { exportPlayerIdentityState } from './playerIdentity'
import { playerIdentitySyncPendingCount } from './playerIdentitySyncMeta'
import type { GameRecord } from './types'
import type { Database } from './database.types'

type Row = Database['public']['Tables']['games']['Row']
type Insert = Database['public']['Tables']['games']['Insert']
type PendingEventEdits = Record<string, string>

const EVENT_EDIT_QUEUE_KEY = '10k_pending_event_edits_v1'
const CLOUD_TIMEOUT_MS = 3500
const key = (game: GameRecord) => String(game.id)
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

function toRow(game: GameRecord): Insert {
  return {
    client_id: key(game),
    played_at: game.date,
    event: game.event ?? '',
    winner: game.winner,
    winner_score: game.winnerScore,
    players: game.players as unknown as Insert['players'],
    turns: (game.turns ?? []) as unknown as Insert['turns'],
  }
}

function rowCandidate(row: Row): unknown {
  return {
    id: row.client_id,
    date: row.played_at,
    event: row.event ?? '',
    winner: row.winner,
    winnerScore: row.winner_score,
    players: row.players,
    turns: row.turns,
  }
}

function readPendingEventEdits(): PendingEventEdits {
  try {
    const parsed = JSON.parse(localStorage.getItem(EVENT_EDIT_QUEUE_KEY) || '{}') as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, event]) => typeof event === 'string')
        .map(([id, event]) => [id, (event as string).trim()]),
    )
  } catch {
    return {}
  }
}

function writePendingEventEdits(edits: PendingEventEdits): void {
  try {
    if (Object.keys(edits).length === 0) localStorage.removeItem(EVENT_EDIT_QUEUE_KEY)
    else localStorage.setItem(EVENT_EDIT_QUEUE_KEY, JSON.stringify(edits))
  } catch {
    /* local-only fallback remains in history */
  }
}

function queueEventEdit(clientId: string, event: string): void {
  const edits = readPendingEventEdits()
  edits[clientId] = event.trim()
  writePendingEventEdits(edits)
}

function clearEventEdit(clientId: string): void {
  const edits = readPendingEventEdits()
  if (!(clientId in edits)) return
  delete edits[clientId]
  writePendingEventEdits(edits)
}

export function pendingEventEditCount(): number {
  return (
    Object.keys(readPendingEventEdits()).length +
    playerIdentitySyncPendingCount(exportPlayerIdentityState())
  )
}

/**
 * Deterministischer Merge:
 * - Ohne offene lokale Änderung gewinnt die Cloud-Kopie derselben Spiel-ID.
 * - Eine noch nicht synchronisierte Anlass-Änderung wird anschließend darübergelegt.
 */
export function mergeHistories(
  local: GameRecord[],
  cloud: GameRecord[],
  pendingEdits: PendingEventEdits = {},
): GameRecord[] {
  const byId = new Map<string, GameRecord>()
  for (const game of local) byId.set(key(game), game)
  for (const game of cloud) byId.set(key(game), game)
  for (const [clientId, event] of Object.entries(pendingEdits)) {
    const game = byId.get(clientId)
    if (game) byId.set(clientId, { ...game, event })
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

/** Schiebt ein einzelnes Spiel idempotent in die Cloud. */
export async function pushGame(game: GameRecord): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return false

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { error } = await supabase
      .from('games')
      .upsert(toRow(game), { onConflict: 'client_id', ignoreDuplicates: true })
      .abortSignal(controller.signal)
    if (error) {
      console.warn('Cloud-Push fehlgeschlagen:', error.message)
      return false
    }
    return true
  } catch (error) {
    console.warn('Cloud-Push abgebrochen (Timeout/offline):', error)
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

/** Holt alle Cloud-Spiele; `ok` trennt eine leere Cloud von einem Netzfehler. */
export async function fetchCloudGames(): Promise<{ games: GameRecord[]; ok: boolean }> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return { games: [], ok: false }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('played_at', { ascending: false })
      .limit(500)
      .abortSignal(controller.signal)
    if (error) {
      console.warn('Cloud-Fetch fehlgeschlagen:', error.message)
      return { games: [], ok: false }
    }
    const validation = validateGameRecordArray((data ?? []).map(rowCandidate), 'cloud')
    recordHistoryValidation('cloud', validation)
    return { games: validation.games, ok: true }
  } catch (error) {
    console.warn('Cloud-Fetch abgebrochen (Timeout/offline):', error)
    return { games: [], ok: false }
  } finally {
    window.clearTimeout(timer)
  }
}

export type DeleteResult = 'ok' | 'denied' | 'offline'

/** Löscht lokal und – bei erreichbarer Cloud und gültigem Admin-Code – remote. */
export async function deleteGame(game: GameRecord): Promise<DeleteResult> {
  const supabase = getSupabase()
  if (!supabase) {
    removeGame(game.id)
    return 'ok'
  }
  if (isOffline()) return 'offline'

  const deleteController = new AbortController()
  const deleteTimer = window.setTimeout(() => deleteController.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data: deleted, error } = await supabase
      .from('games')
      .delete()
      .eq('client_id', key(game))
      .select('id')
      .abortSignal(deleteController.signal)
    if (error) {
      console.warn('Cloud-Löschen fehlgeschlagen:', error.message)
      return 'offline'
    }
    if (deleted && deleted.length > 0) {
      removeGame(game.id)
      return 'ok'
    }
  } catch (error) {
    console.warn('Cloud-Löschen abgebrochen (Timeout/offline):', error)
    return 'offline'
  } finally {
    window.clearTimeout(deleteTimer)
  }

  // RLS meldet ein verweigertes DELETE oft als erfolgreich mit 0 Zeilen.
  const checkController = new AbortController()
  const checkTimer = window.setTimeout(() => checkController.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data: still, error } = await supabase
      .from('games')
      .select('id')
      .eq('client_id', key(game))
      .limit(1)
      .abortSignal(checkController.signal)
    if (error) return 'offline'
    if (still && still.length > 0) return 'denied'
    removeGame(game.id)
    return 'ok'
  } catch (error) {
    console.warn('Cloud-Löschprüfung abgebrochen:', error)
    return 'offline'
  } finally {
    window.clearTimeout(checkTimer)
  }
}

export type EditResult = 'ok' | 'denied' | 'offline'

async function updateCloudEvent(clientId: string, event: string): Promise<EditResult> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return 'offline'

  const updateController = new AbortController()
  const updateTimer = window.setTimeout(() => updateController.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data: updated, error } = await supabase
      .from('games')
      .update({ event: event.trim() })
      .eq('client_id', clientId)
      .select('id')
      .abortSignal(updateController.signal)
    if (error) {
      console.warn('Cloud-Update fehlgeschlagen:', error.message)
      return 'offline'
    }
    if (updated && updated.length > 0) return 'ok'
  } catch (error) {
    console.warn('Cloud-Update abgebrochen (Timeout/offline):', error)
    return 'offline'
  } finally {
    window.clearTimeout(updateTimer)
  }

  const checkController = new AbortController()
  const checkTimer = window.setTimeout(() => checkController.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data: still, error } = await supabase
      .from('games')
      .select('id')
      .eq('client_id', clientId)
      .limit(1)
      .abortSignal(checkController.signal)
    if (error) return 'offline'
    return still && still.length > 0 ? 'denied' : 'offline'
  } catch (error) {
    console.warn('Cloud-Update-Prüfung abgebrochen:', error)
    return 'offline'
  } finally {
    window.clearTimeout(checkTimer)
  }
}

/**
 * Speichert den Anlass sofort lokal und merkt ihn als ausstehend, bis die Cloud
 * die Änderung bestätigt. Damit überlebt die Änderung Offline-Starts und wird
 * beim nächsten Statistik-Sync automatisch erneut versucht.
 */
export async function editGameEvent(game: GameRecord, event: string): Promise<EditResult> {
  const trimmed = event.trim()
  const clientId = key(game)
  setGameEvent(game.id, trimmed)
  queueEventEdit(clientId, trimmed)

  const result = await updateCloudEvent(clientId, trimmed)
  if (result === 'ok') clearEventEdit(clientId)
  return result
}

export interface SyncResult {
  games: GameRecord[]
  online: boolean
  /** Noch nicht bestätigte lokale Änderungen. */
  pending: number
  identityConflicts: number
  codeDenied: boolean
  /** Anzahl bestätigter Spiele in der Cloud; null, wenn nicht verlässlich abrufbar. */
  cloudCount: number | null
}

/**
 * Synchronisiert beide Richtungen. Cloud-Kopien gewinnen bei gleicher ID,
 * außer für explizit als ausstehend markierte lokale Anlass-Änderungen.
 */
export async function syncAndMerge(): Promise<SyncResult> {
  const local = getHistory()
  const initialPending = readPendingEventEdits()
  const initialIdentityPending = playerIdentitySyncPendingCount(exportPlayerIdentityState())
  if (!getSupabase() || isOffline()) {
    return {
      games: local,
      online: false,
      pending: Object.keys(initialPending).length + initialIdentityPending,
      identityConflicts: 0,
      codeDenied: false,
      cloudCount: null,
    }
  }

  const identity = await syncPlayerIdentityState()
  const fetched = await fetchCloudGames()
  if (!fetched.ok) {
    return {
      games: local,
      online: false,
      pending: Object.keys(initialPending).length + identity.pending,
      identityConflicts: identity.conflicts,
      codeDenied: identity.denied,
      cloudCount: null,
    }
  }

  let cloud = [...fetched.games]
  const cloudIds = new Set(cloud.map(key))

  let failedGameUploads = 0

  // Bereits vorhandene Cloud-Zeilen mit offenen lokalen Anlass-Änderungen aktualisieren.
  for (const [clientId, event] of Object.entries(initialPending)) {
    if (identity.denied) break
    if (!cloudIds.has(clientId)) continue
    const result = await updateCloudEvent(clientId, event)
    if (result === 'ok') {
      clearEventEdit(clientId)
      cloud = cloud.map((game) => (key(game) === clientId ? { ...game, event } : game))
    }
  }

  // Vollständig lokale Spiele hochladen. Der lokale Datensatz enthält bereits
  // einen gegebenenfalls offline bearbeiteten Anlass.
  const missing = local.filter((game) => !cloudIds.has(key(game)))
  for (const game of missing) {
    if (identity.denied) {
      failedGameUploads += 1
      continue
    }
    if (await pushGame(game)) {
      cloud.push(game)
      cloudIds.add(key(game))
      clearEventEdit(key(game))
    } else {
      failedGameUploads += 1
    }
  }

  const pending = readPendingEventEdits()
  const games = mergeHistories(local, cloud, pending)
  replaceHistory(games)
  return {
    games,
    online: true,
    pending: Object.keys(pending).length + identity.pending + failedGameUploads,
    identityConflicts: identity.conflicts,
    codeDenied: identity.denied,
    cloudCount: cloud.length,
  }
}
