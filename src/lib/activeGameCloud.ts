import { checkCliqueCode } from './cloudAccess'
import { parseActiveGame, type ActiveGame } from './activeGame'
import { getSupabase } from './supabase'
import type { Database, Json } from './database.types'

const STATE_KEY = 'active_game'
const DEVICE_KEY = '10k_device_id_v1'
const CLOUD_TIMEOUT_MS = 3500
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

type StateRow = Database['public']['Tables']['clique_state']['Row']

type ActiveGameCloudEnvelope = {
  schemaVersion: 1
  status: 'active' | 'cleared'
  sessionId: string
  ownerDeviceId: string
  savedAt: string
  game: ActiveGame | null
}

export interface ActiveGameCloudSnapshot extends ActiveGameCloudEnvelope {
  version: number
  updatedAt: string
}

export type ActiveGameCloudReason =
  | 'available'
  | 'cloud-newer'
  | 'different-game'
  | 'taken-over'
  | 'cloud-cleared'

export interface ActiveGameCloudPrompt {
  reason: ActiveGameCloudReason
  local: ActiveGame | null
  snapshot: ActiveGameCloudSnapshot
}

export type ActiveGameCloudDecision =
  | 'push-local'
  | 'unchanged'
  | 'use-cloud'
  | 'different-game'
  | 'taken-over'
  | 'cloud-cleared'

export type ActiveGameCloudStatus = 'saved' | 'unchanged' | 'offline' | 'denied' | 'conflict'

export interface ActiveGameCloudResult {
  status: ActiveGameCloudStatus
  prompt?: ActiveGameCloudPrompt
  snapshot?: ActiveGameCloudSnapshot
}

interface FetchResult {
  ok: boolean
  row: StateRow | null
  snapshot: ActiveGameCloudSnapshot | null
}

interface WriteResult {
  status: Exclude<ActiveGameCloudStatus, 'unchanged'>
  snapshot?: ActiveGameCloudSnapshot
}

function time(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    /* fallback below */
  }
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function activeGameDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_KEY)
    if (stored) return stored
    const created = randomId()
    localStorage.setItem(DEVICE_KEY, created)
    return created
  } catch {
    return randomId()
  }
}

function parseEnvelope(payload: Json): ActiveGameCloudEnvelope | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const value = payload as Record<string, Json | undefined>
  if (value.schemaVersion !== 1) return null
  if (value.status !== 'active' && value.status !== 'cleared') return null

  const sessionId = typeof value.sessionId === 'string' ? value.sessionId : ''
  const ownerDeviceId = typeof value.ownerDeviceId === 'string' ? value.ownerDeviceId : ''
  const savedAt = typeof value.savedAt === 'string' ? value.savedAt : new Date(0).toISOString()

  if (value.status === 'cleared') {
    return { schemaVersion: 1, status: 'cleared', sessionId, ownerDeviceId, savedAt, game: null }
  }

  const game = parseActiveGame(JSON.stringify(value.game ?? null))
  if (!game || !sessionId || game.sessionId !== sessionId || !ownerDeviceId) return null
  return { schemaVersion: 1, status: 'active', sessionId, ownerDeviceId, savedAt, game }
}

function snapshotFromRow(row: StateRow | null): ActiveGameCloudSnapshot | null {
  if (!row) return null
  const envelope = parseEnvelope(row.payload)
  if (!envelope) return null
  return { ...envelope, version: row.version, updatedAt: row.updated_at }
}

function activeEnvelope(game: ActiveGame, ownerDeviceId = activeGameDeviceId()): ActiveGameCloudEnvelope {
  return {
    schemaVersion: 1,
    status: 'active',
    sessionId: game.sessionId,
    ownerDeviceId,
    savedAt: game.savedAt,
    game,
  }
}

function clearedEnvelope(sessionId: string, ownerDeviceId: string): ActiveGameCloudEnvelope {
  return {
    schemaVersion: 1,
    status: 'cleared',
    sessionId,
    ownerDeviceId,
    savedAt: new Date().toISOString(),
    game: null,
  }
}

async function fetchState(): Promise<FetchResult> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return { ok: false, row: null, snapshot: null }

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
      console.warn('Laufendes Cloud-Spiel konnte nicht geladen werden:', error.message)
      return { ok: false, row: null, snapshot: null }
    }
    const row = data?.[0] ?? null
    return { ok: true, row, snapshot: snapshotFromRow(row) }
  } catch (error) {
    console.warn('Cloud-Spielstand konnte nicht geladen werden (Timeout/offline):', error)
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

async function insertState(envelope: ActiveGameCloudEnvelope): Promise<WriteResult> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return { status: 'offline' }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from('clique_state')
      .insert({ state_key: STATE_KEY, version: 1, payload: envelope as unknown as Json })
      .select('*')
      .abortSignal(controller.signal)
    if (error) {
      if (error.code === '23505') return { status: 'conflict' }
      const denied = error.code === '42501' || /policy|permission|row-level/i.test(error.message)
      if (!denied) console.warn('Cloud-Spielstand konnte nicht angelegt werden:', error.message)
      return { status: denied ? 'denied' : 'offline' }
    }
    const snapshot = snapshotFromRow(data?.[0] ?? null)
    return snapshot ? { status: 'saved', snapshot } : { status: 'offline' }
  } catch (error) {
    console.warn('Cloud-Spielstand konnte nicht angelegt werden:', error)
    return { status: 'offline' }
  } finally {
    window.clearTimeout(timer)
  }
}

async function compareAndSwap(version: number, envelope: ActiveGameCloudEnvelope): Promise<WriteResult> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return { status: 'offline' }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from('clique_state')
      .update({ version: version + 1, payload: envelope as unknown as Json })
      .eq('state_key', STATE_KEY)
      .eq('version', version)
      .select('*')
      .abortSignal(controller.signal)
    if (error) {
      const denied = error.code === '42501' || /policy|permission|row-level/i.test(error.message)
      if (!denied) console.warn('Laufender Cloud-Spielstand konnte nicht gespeichert werden:', error.message)
      return { status: denied ? 'denied' : 'offline' }
    }
    const snapshot = snapshotFromRow(data?.[0] ?? null)
    if (snapshot) return { status: 'saved', snapshot }
    return { status: await classifyEmptyWrite() }
  } catch (error) {
    console.warn('Laufender Cloud-Spielstand konnte nicht gespeichert werden:', error)
    return { status: 'offline' }
  } finally {
    window.clearTimeout(timer)
  }
}

export function planActiveGameCloudSync(
  local: ActiveGame,
  cloud: ActiveGameCloudSnapshot | null,
  deviceId: string,
): ActiveGameCloudDecision {
  if (!cloud) return 'push-local'
  if (cloud.status === 'cleared') {
    return cloud.sessionId && cloud.sessionId === local.sessionId ? 'cloud-cleared' : 'push-local'
  }
  if (!cloud.game) return 'push-local'
  if (cloud.sessionId !== local.sessionId) return 'different-game'
  if (cloud.ownerDeviceId !== deviceId) return 'taken-over'
  if (time(cloud.game.savedAt) > time(local.savedAt)) return 'use-cloud'
  if (time(local.savedAt) > time(cloud.game.savedAt)) return 'push-local'
  return 'unchanged'
}

function promptFor(
  decision: Exclude<ActiveGameCloudDecision, 'push-local' | 'unchanged'>,
  local: ActiveGame | null,
  snapshot: ActiveGameCloudSnapshot,
): ActiveGameCloudPrompt {
  const reason: ActiveGameCloudReason =
    decision === 'use-cloud'
      ? 'cloud-newer'
      : decision === 'different-game'
        ? 'different-game'
        : decision === 'cloud-cleared'
          ? 'cloud-cleared'
          : 'taken-over'
  return { reason, local, snapshot }
}

async function latestPrompt(local: ActiveGame): Promise<ActiveGameCloudPrompt | undefined> {
  const refreshed = await fetchState()
  if (!refreshed.ok || !refreshed.snapshot) return undefined
  const decision = planActiveGameCloudSync(local, refreshed.snapshot, activeGameDeviceId())
  if (decision === 'push-local' || decision === 'unchanged') return undefined
  return promptFor(decision, local, refreshed.snapshot)
}

/** Speichert einen lokalen laufenden Stand nur, wenn dieses Gerät ihn weiterhin besitzt. */
export async function syncActiveGameToCloud(game: ActiveGame): Promise<ActiveGameCloudResult> {
  const fetched = await fetchState()
  if (!fetched.ok) return { status: 'offline' }

  const deviceId = activeGameDeviceId()
  const decision = planActiveGameCloudSync(game, fetched.snapshot, deviceId)
  if (decision === 'unchanged') return { status: 'unchanged', snapshot: fetched.snapshot ?? undefined }
  if (decision !== 'push-local' && fetched.snapshot) {
    return { status: 'conflict', prompt: promptFor(decision, game, fetched.snapshot), snapshot: fetched.snapshot }
  }

  const written = fetched.row
    ? await compareAndSwap(fetched.row.version, activeEnvelope(game, deviceId))
    : await insertState(activeEnvelope(game, deviceId))
  if (written.status !== 'conflict') return written
  return { status: 'conflict', prompt: await latestPrompt(game) }
}

/** Prüft beim App-Start, ob ein anderer oder neuerer Cloud-Stand Aufmerksamkeit braucht. */
export async function inspectActiveGameCloud(local: ActiveGame | null): Promise<ActiveGameCloudPrompt | null> {
  if (local) {
    const result = await syncActiveGameToCloud(local)
    return result.prompt ?? null
  }

  const fetched = await fetchState()
  if (!fetched.ok || !fetched.snapshot || fetched.snapshot.status !== 'active' || !fetched.snapshot.game) return null
  return { reason: 'available', local: null, snapshot: fetched.snapshot }
}

/** Übernimmt den sichtbaren Cloud-Stand per CAS auf dieses Gerät. */
export async function takeOverCloudActiveGame(snapshot: ActiveGameCloudSnapshot): Promise<ActiveGameCloudResult> {
  if (snapshot.status !== 'active' || !snapshot.game) return { status: 'conflict' }
  const written = await compareAndSwap(snapshot.version, activeEnvelope(snapshot.game, activeGameDeviceId()))
  if (written.status !== 'conflict') return written
  const refreshed = await fetchState()
  return {
    status: 'conflict',
    snapshot: refreshed.snapshot ?? undefined,
    prompt:
      refreshed.snapshot && refreshed.snapshot.status === 'active'
        ? { reason: 'taken-over', local: null, snapshot: refreshed.snapshot }
        : undefined,
  }
}

/** Überschreibt einen bekannten Cloud-Konflikt ausschließlich nach ausdrücklicher Nutzerwahl. */
export async function replaceCloudActiveGame(
  local: ActiveGame,
  expectedVersion: number,
): Promise<ActiveGameCloudResult> {
  const written = await compareAndSwap(expectedVersion, activeEnvelope(local, activeGameDeviceId()))
  if (written.status !== 'conflict') return written
  return { status: 'conflict', prompt: await latestPrompt(local) }
}

/** Markiert nur den von diesem Gerät besessenen, passenden Stand als beendet. */
export async function clearCloudActiveGame(sessionId: string): Promise<ActiveGameCloudResult> {
  if (!sessionId) return { status: 'unchanged' }
  const fetched = await fetchState()
  if (!fetched.ok) return { status: 'offline' }
  const snapshot = fetched.snapshot
  if (!fetched.row || !snapshot || snapshot.status === 'cleared') return { status: 'unchanged', snapshot: snapshot ?? undefined }
  if (snapshot.sessionId !== sessionId || snapshot.ownerDeviceId !== activeGameDeviceId()) {
    return { status: 'conflict', snapshot }
  }
  return compareAndSwap(fetched.row.version, clearedEnvelope(sessionId, snapshot.ownerDeviceId))
}
