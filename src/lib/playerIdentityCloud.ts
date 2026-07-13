import { checkCliqueCode } from './cloudAccess'
import { getSupabase } from './supabase'
import {
  exportPlayerIdentityState,
  replacePlayerIdentityState,
  type PlayerIdentityState,
} from './playerIdentity'
import {
  getPlayerIdentitySyncMeta,
  playerIdentitySyncPendingCount,
  setPlayerIdentitySyncBase,
} from './playerIdentitySyncMeta'
import {
  emptyPlayerIdentityState,
  mergePlayerIdentityStates,
  sanitizePlayerIdentityState,
} from './playerIdentityState'
import type { Database, Json } from './database.types'

const STATE_KEY = 'player_identity'
const CLOUD_TIMEOUT_MS = 3500
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

type StateRow = Database['public']['Tables']['clique_state']['Row']

export interface PlayerIdentityCloudResult {
  online: boolean
  pending: number
  conflicts: number
  version: number
  denied: boolean
}

interface FetchResult {
  ok: boolean
  row: StateRow | null
}

async function fetchState(): Promise<FetchResult> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return { ok: false, row: null }
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
      console.warn('Spieler-Cloud-State konnte nicht geladen werden:', error.message)
      return { ok: false, row: null }
    }
    return { ok: true, row: data?.[0] ?? null }
  } catch (error) {
    console.warn('Spieler-Cloud-State abgebrochen (Timeout/offline):', error)
    return { ok: false, row: null }
  } finally {
    window.clearTimeout(timer)
  }
}

async function insertInitialState(state: PlayerIdentityState): Promise<StateRow | null> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return null
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from('clique_state')
      .insert({ state_key: STATE_KEY, version: 1, payload: state as unknown as Json })
      .select('*')
      .abortSignal(controller.signal)
    if (error) return null
    return data?.[0] ?? null
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

async function compareAndSwapState(version: number, state: PlayerIdentityState): Promise<{
  row: StateRow | null
  denied: boolean
  offline: boolean
}> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return { row: null, denied: false, offline: true }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from('clique_state')
      .update({ version: version + 1, payload: state as unknown as Json })
      .eq('state_key', STATE_KEY)
      .eq('version', version)
      .select('*')
      .abortSignal(controller.signal)
    if (error) {
      const denied = error.code === '42501' || /policy|permission|row-level/i.test(error.message)
      if (!denied) console.warn('Spieler-Zuordnungen konnten nicht gespeichert werden:', error.message)
      return { row: null, denied, offline: !denied }
    }
    return { row: data?.[0] ?? null, denied: false, offline: false }
  } catch (error) {
    console.warn('Spieler-Zuordnungen konnten nicht gespeichert werden:', error)
    return { row: null, denied: false, offline: true }
  } finally {
    window.clearTimeout(timer)
  }
}

/**
 * Synchronisiert die reversible Spieler-Identität mit optimistischer Versionierung.
 * Ein CAS-Konflikt wird einmal neu geladen und als Drei-Wege-Merge wiederholt.
 */
export async function syncPlayerIdentityState(): Promise<PlayerIdentityCloudResult> {
  let local = sanitizePlayerIdentityState(exportPlayerIdentityState())
  let meta = getPlayerIdentitySyncMeta(local)
  if (!getSupabase() || isOffline()) {
    return {
      online: false,
      pending: playerIdentitySyncPendingCount(local),
      conflicts: 0,
      version: meta.baseVersion,
      denied: false,
    }
  }

  let fetched = await fetchState()
  if (!fetched.ok) {
    return {
      online: false,
      pending: playerIdentitySyncPendingCount(local),
      conflicts: 0,
      version: meta.baseVersion,
      denied: false,
    }
  }

  let cloudVersion = fetched.row?.version ?? 0
  let cloud = sanitizePlayerIdentityState(fetched.row?.payload ?? emptyPlayerIdentityState())
  const codeStatus = await checkCliqueCode()
  const codeDenied = codeStatus === 'invalid' || codeStatus === 'missing'

  if (!meta.dirty) {
    replacePlayerIdentityState(cloud, false)
    setPlayerIdentitySyncBase(cloudVersion, cloud, false)
    return {
      online: codeStatus !== 'offline',
      pending: 0,
      conflicts: 0,
      version: cloudVersion,
      denied: codeDenied,
    }
  }

  let merged = mergePlayerIdentityStates(meta.baseState, local, cloud)
  replacePlayerIdentityState(merged.state, false)
  setPlayerIdentitySyncBase(cloudVersion, cloud, true)

  if (codeStatus !== 'valid') {
    return {
      online: codeStatus !== 'offline',
      pending: 1,
      conflicts: merged.conflicts,
      version: cloudVersion,
      denied: codeDenied,
    }
  }

  if (!fetched.row) {
    const inserted = await insertInitialState(merged.state)
    if (inserted) {
      const saved = sanitizePlayerIdentityState(inserted.payload)
      replacePlayerIdentityState(saved, false)
      setPlayerIdentitySyncBase(inserted.version, saved, false)
      return {
        online: true,
        pending: 0,
        conflicts: merged.conflicts,
        version: inserted.version,
        denied: false,
      }
    }
    fetched = await fetchState()
    if (!fetched.ok || !fetched.row) {
      return {
        online: fetched.ok,
        pending: 1,
        conflicts: merged.conflicts,
        version: cloudVersion,
        denied: fetched.ok,
      }
    }
    cloudVersion = fetched.row.version
    cloud = sanitizePlayerIdentityState(fetched.row.payload)
    local = sanitizePlayerIdentityState(exportPlayerIdentityState())
    meta = getPlayerIdentitySyncMeta(local)
    merged = mergePlayerIdentityStates(meta.baseState, local, cloud)
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const written = await compareAndSwapState(cloudVersion, merged.state)
    if (written.row) {
      const saved = sanitizePlayerIdentityState(written.row.payload)
      replacePlayerIdentityState(saved, false)
      setPlayerIdentitySyncBase(written.row.version, saved, false)
      return {
        online: true,
        pending: 0,
        conflicts: merged.conflicts,
        version: written.row.version,
        denied: false,
      }
    }
    if (written.denied || written.offline) {
      return {
        online: !written.offline,
        pending: 1,
        conflicts: merged.conflicts,
        version: cloudVersion,
        denied: written.denied,
      }
    }

    const refreshed = await fetchState()
    if (!refreshed.ok || !refreshed.row) break
    const refreshedCloud = sanitizePlayerIdentityState(refreshed.row.payload)
    const currentLocal = sanitizePlayerIdentityState(exportPlayerIdentityState())
    merged = mergePlayerIdentityStates(cloud, currentLocal, refreshedCloud)
    replacePlayerIdentityState(merged.state, false)
    setPlayerIdentitySyncBase(refreshed.row.version, refreshedCloud, true)
    cloud = refreshedCloud
    cloudVersion = refreshed.row.version
  }

  return {
    online: true,
    pending: 1,
    conflicts: merged.conflicts,
    version: cloudVersion,
    denied: false,
  }
}
