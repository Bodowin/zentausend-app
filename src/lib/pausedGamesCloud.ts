import { checkCliqueCode } from './cloudAccess'
import { hasCliqueCode } from './cliqueCode'
import type { Database, Json } from './database.types'
import {
  mergePausedGameStores,
  normalizePausedGameStore,
  parsePausedGameStore,
  type PausedGameStore,
} from './pausedGames'
import { getSupabase } from './supabase'

const STATE_KEY = 'paused_games'
const CLOUD_TIMEOUT_MS = 3500
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

type StateRow = Database['public']['Tables']['clique_state']['Row']

type PausedGamesEnvelope = {
  schemaVersion: 1
  updatedAt: string
  store: PausedGameStore
}

export type PausedGamesCloudStatus = 'saved' | 'unchanged' | 'offline' | 'denied' | 'conflict'

export interface PausedGamesCloudResult {
  status: PausedGamesCloudStatus
  store: PausedGameStore
  version?: number
}

interface CloudSnapshot {
  version: number
  store: PausedGameStore
}

function envelope(store: PausedGameStore): PausedGamesEnvelope {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    store: normalizePausedGameStore(store),
  }
}

function parseEnvelope(payload: Json): PausedGameStore | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const value = payload as Record<string, Json | undefined>
  if (value.schemaVersion !== 1) return null
  return parsePausedGameStore(JSON.stringify(value.store ?? null))
}

function snapshotFromRow(row: StateRow | null): CloudSnapshot | null {
  if (!row) return null
  const store = parseEnvelope(row.payload)
  return store ? { version: row.version, store } : null
}

async function fetchState(): Promise<{ ok: boolean; row: StateRow | null; snapshot: CloudSnapshot | null }> {
  const supabase = getSupabase()
  if (!supabase || isOffline() || !hasCliqueCode()) return { ok: false, row: null, snapshot: null }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from('clique_state')
      .select('*')
      .eq('state_key', STATE_KEY)
      .limit(1)
      .abortSignal(controller.signal)
    if (error) {
      console.warn('Pausierte Cloud-Spiele konnten nicht geladen werden:', error.message)
      return { ok: false, row: null, snapshot: null }
    }
    const row = data?.[0] ?? null
    return { ok: true, row, snapshot: snapshotFromRow(row) }
  } catch (error) {
    console.warn('Pausierte Cloud-Spiele konnten nicht geladen werden:', error)
    return { ok: false, row: null, snapshot: null }
  } finally {
    window.clearTimeout(timer)
  }
}

async function classifyEmptyWrite(): Promise<'denied' | 'offline' | 'conflict'> {
  const code = await checkCliqueCode()
  if (code === 'invalid' || code === 'missing') return 'denied'
  if (code === 'offline') return 'offline'
  return 'conflict'
}

async function insertStore(store: PausedGameStore): Promise<PausedGamesCloudResult> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return { status: 'offline', store }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from('clique_state')
      .insert({ state_key: STATE_KEY, version: 1, payload: envelope(store) as unknown as Json })
      .select('*')
      .abortSignal(controller.signal)
    if (error) {
      if (error.code === '23505') return { status: 'conflict', store }
      const denied = error.code === '42501' || /policy|permission|row-level/i.test(error.message)
      if (!denied) console.warn('Pausenbibliothek konnte nicht angelegt werden:', error.message)
      return { status: denied ? 'denied' : 'offline', store }
    }
    const snapshot = snapshotFromRow(data?.[0] ?? null)
    return snapshot
      ? { status: 'saved', store: snapshot.store, version: snapshot.version }
      : { status: 'offline', store }
  } catch (error) {
    console.warn('Pausenbibliothek konnte nicht angelegt werden:', error)
    return { status: 'offline', store }
  } finally {
    window.clearTimeout(timer)
  }
}

async function compareAndSwap(version: number, store: PausedGameStore): Promise<PausedGamesCloudResult> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return { status: 'offline', store }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from('clique_state')
      .update({ version: version + 1, payload: envelope(store) as unknown as Json })
      .eq('state_key', STATE_KEY)
      .eq('version', version)
      .select('*')
      .abortSignal(controller.signal)
    if (error) {
      const denied = error.code === '42501' || /policy|permission|row-level/i.test(error.message)
      if (!denied) console.warn('Pausenbibliothek konnte nicht gespeichert werden:', error.message)
      return { status: denied ? 'denied' : 'offline', store }
    }
    const snapshot = snapshotFromRow(data?.[0] ?? null)
    if (snapshot) return { status: 'saved', store: snapshot.store, version: snapshot.version }
    return { status: await classifyEmptyWrite(), store }
  } catch (error) {
    console.warn('Pausenbibliothek konnte nicht gespeichert werden:', error)
    return { status: 'offline', store }
  } finally {
    window.clearTimeout(timer)
  }
}

function sameStore(a: PausedGameStore, b: PausedGameStore): boolean {
  return JSON.stringify(normalizePausedGameStore(a)) === JSON.stringify(normalizePausedGameStore(b))
}

/**
 * Vereinigt lokale und Cloud-Bibliothek pro Sitzungs-ID. Die jüngste Änderung
 * gewinnt; Löschungen bleiben als zeitlich begrenzte Tombstones erhalten, damit
 * ein altes Gerät gelöschte Spiele nicht wieder erscheinen lässt.
 */
export async function syncPausedGamesToCloud(local: PausedGameStore): Promise<PausedGamesCloudResult> {
  const normalizedLocal = normalizePausedGameStore(local)
  if (!hasCliqueCode()) return { status: 'unchanged', store: normalizedLocal }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const fetched = await fetchState()
    if (!fetched.ok) return { status: 'offline', store: normalizedLocal }

    if (!fetched.row || !fetched.snapshot) {
      const inserted = await insertStore(normalizedLocal)
      if (inserted.status !== 'conflict') return inserted
      continue
    }

    const merged = mergePausedGameStores(normalizedLocal, fetched.snapshot.store)
    if (sameStore(merged, fetched.snapshot.store)) {
      return { status: 'unchanged', store: merged, version: fetched.snapshot.version }
    }

    const written = await compareAndSwap(fetched.snapshot.version, merged)
    if (written.status !== 'conflict') return written
  }

  return { status: 'conflict', store: normalizedLocal }
}
