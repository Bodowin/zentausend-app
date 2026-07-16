import { checkCliqueCode } from './cloudAccess'
import { hasCliqueCode } from './cliqueCode'
import type { Database, Json } from './database.types'
import {
  mergePausedGameRecords,
  normalizePausedGameRecords,
  readPausedGameRecords,
  replacePausedGameRecords,
  type PausedGameRecord,
} from './pausedGames'
import { getSupabase } from './supabase'

const STATE_KEY = 'paused_games'
const CLOUD_TIMEOUT_MS = 3500
const MAX_ATTEMPTS = 3
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

type StateRow = Database['public']['Tables']['clique_state']['Row']

type PausedGamesCloudEnvelope = {
  schemaVersion: 1
  records: PausedGameRecord[]
}

export type PausedGamesCloudStatus = 'synced' | 'unchanged' | 'offline' | 'denied' | 'conflict' | 'disabled'

export interface PausedGamesCloudResult {
  status: PausedGamesCloudStatus
  records: PausedGameRecord[]
}

function parseEnvelope(payload: Json): PausedGameRecord[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const value = payload as Record<string, Json | undefined>
  if (value.schemaVersion !== 1) return []
  return normalizePausedGameRecords(value.records)
}

function envelope(records: PausedGameRecord[]): PausedGamesCloudEnvelope {
  return { schemaVersion: 1, records: normalizePausedGameRecords(records) }
}

function sameRecords(a: PausedGameRecord[], b: PausedGameRecord[]): boolean {
  return JSON.stringify(normalizePausedGameRecords(a)) === JSON.stringify(normalizePausedGameRecords(b))
}

async function fetchState(): Promise<{ ok: boolean; row: StateRow | null; records: PausedGameRecord[] }> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return { ok: false, row: null, records: [] }

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
      return { ok: false, row: null, records: [] }
    }

    const row = data?.[0] ?? null
    return { ok: true, row, records: row ? parseEnvelope(row.payload) : [] }
  } catch (error) {
    console.warn('Pausierte Cloud-Spiele konnten nicht geladen werden (Timeout/offline):', error)
    return { ok: false, row: null, records: [] }
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

async function insertState(records: PausedGameRecord[]): Promise<PausedGamesCloudStatus> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return 'offline'

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { error } = await supabase
      .from('clique_state')
      .insert({ state_key: STATE_KEY, version: 1, payload: envelope(records) as unknown as Json })
      .abortSignal(controller.signal)

    if (!error) return 'synced'
    if (error.code === '23505') return 'conflict'
    const denied = error.code === '42501' || /policy|permission|row-level/i.test(error.message)
    if (!denied) console.warn('Pausierte Cloud-Spiele konnten nicht angelegt werden:', error.message)
    return denied ? 'denied' : 'offline'
  } catch (error) {
    console.warn('Pausierte Cloud-Spiele konnten nicht angelegt werden:', error)
    return 'offline'
  } finally {
    window.clearTimeout(timer)
  }
}

async function compareAndSwap(version: number, records: PausedGameRecord[]): Promise<PausedGamesCloudStatus> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return 'offline'

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from('clique_state')
      .update({ version: version + 1, payload: envelope(records) as unknown as Json })
      .eq('state_key', STATE_KEY)
      .eq('version', version)
      .select('version')
      .abortSignal(controller.signal)

    if (error) {
      const denied = error.code === '42501' || /policy|permission|row-level/i.test(error.message)
      if (!denied) console.warn('Pausierte Cloud-Spiele konnten nicht gespeichert werden:', error.message)
      return denied ? 'denied' : 'offline'
    }
    if ((data?.length ?? 0) > 0) return 'synced'
    return classifyEmptyWrite()
  } catch (error) {
    console.warn('Pausierte Cloud-Spiele konnten nicht gespeichert werden:', error)
    return 'offline'
  } finally {
    window.clearTimeout(timer)
  }
}

/**
 * Vereinigt lokale und geräteübergreifende Pausenstände nach sessionId. Neuere
 * Änderungen gewinnen; Lösch-Tombstones verhindern eine Wiederbelebung auf
 * einem zweiten Gerät.
 */
export async function syncPausedGamesCloud(): Promise<PausedGamesCloudResult> {
  const localStart = readPausedGameRecords()
  if (!hasCliqueCode()) return { status: 'disabled', records: localStart }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const fetched = await fetchState()
    if (!fetched.ok) return { status: 'offline', records: readPausedGameRecords() }

    const local = readPausedGameRecords()
    const merged = mergePausedGameRecords(local, fetched.records)
    replacePausedGameRecords(merged)

    if (fetched.row && sameRecords(merged, fetched.records)) {
      return { status: 'unchanged', records: merged }
    }
    if (!fetched.row && merged.length === 0) {
      return { status: 'unchanged', records: merged }
    }

    const status = fetched.row
      ? await compareAndSwap(fetched.row.version, merged)
      : await insertState(merged)

    if (status === 'conflict') continue
    return { status, records: merged }
  }

  return { status: 'conflict', records: readPausedGameRecords() }
}
