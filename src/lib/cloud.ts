import { getSupabase } from './supabase'
import { getHistory, removeGame, replaceHistory, setGameEvent } from './storage'
import type { GameRecord } from './types'
import type { Database } from './database.types'

type Row = Database['public']['Tables']['games']['Row']
type Insert = Database['public']['Tables']['games']['Insert']

const key = (g: GameRecord) => String(g.id)

function toRow(g: GameRecord): Insert {
  return {
    client_id: key(g),
    played_at: g.date,
    event: g.event ?? '',
    winner: g.winner,
    winner_score: g.winnerScore,
    players: g.players as unknown as Insert['players'],
    turns: (g.turns ?? []) as unknown as Insert['turns'],
  }
}

function fromRow(row: Row): GameRecord {
  return {
    id: Number(row.client_id) || Date.parse(row.played_at),
    date: row.played_at,
    event: row.event ?? '',
    winner: row.winner,
    winnerScore: row.winner_score,
    players: (Array.isArray(row.players) ? row.players : []) as GameRecord['players'],
    turns: (Array.isArray(row.turns) ? row.turns : undefined) as GameRecord['turns'],
  }
}

/** Meldet der Browser sicher „offline"? (true nur bei eindeutig getrennt.) */
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

// Wie lange auf die Cloud gewartet wird, bevor wir aufgeben. Wichtig auf See mit
// schwachem Signal: ein hängender fetch läuft sonst in den ~8s-Browser-Timeout,
// und die Statistik bliebe so lange auf „Synchronisiere…" stehen.
const CLOUD_TIMEOUT_MS = 3500

/** Schiebt ein einzelnes Spiel in die Cloud (idempotent über client_id). */
export async function pushGame(game: GameRecord): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase || isOffline()) return false
  const { error } = await supabase
    .from('games')
    .upsert(toRow(game), { onConflict: 'client_id', ignoreDuplicates: true })
  if (error) {
    console.warn('Cloud-Push fehlgeschlagen:', error.message)
    return false
  }
  return true
}

/**
 * Holt alle Spiele aus der Cloud (neueste zuerst).
 *
 * `ok` unterscheidet „Cloud leer" von „Cloud nicht erreichbar/Fehler", damit
 * der Aufrufer nicht fälschlich „synchronisiert" meldet.
 */
export async function fetchCloudGames(): Promise<{ games: GameRecord[]; ok: boolean }> {
  const supabase = getSupabase()
  if (!supabase) return { games: [], ok: false }
  // Eindeutig offline → gar nicht erst versuchen (spart den langen Timeout).
  if (isOffline()) return { games: [], ok: false }

  // Schwaches Netz: nach CLOUD_TIMEOUT_MS abbrechen, damit die Oberfläche
  // schnell auf die lokalen Daten zurückfällt statt sekundenlang zu warten.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
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
    return { games: (data ?? []).map(fromRow), ok: true }
  } catch (e) {
    console.warn('Cloud-Fetch abgebrochen (Timeout/offline):', e)
    return { games: [], ok: false }
  } finally {
    clearTimeout(timer)
  }
}

export type DeleteResult = 'ok' | 'denied' | 'offline'

/**
 * Löscht ein Spiel lokal und – falls vorhanden – in der Cloud.
 *
 * Das Cloud-Löschen ist durch den Clique-Code geschützt. Da RLS ein verwehrtes
 * DELETE nicht als Fehler, sondern als „0 Zeilen" meldet, prüfen wir danach, ob
 * der Datensatz noch existiert:
 *  - in der Cloud gelöscht → 'ok'
 *  - existiert noch in der Cloud (Code fehlt/falsch) → 'denied' (lokal bleibt)
 *  - war nie in der Cloud (nur lokal) → lokal entfernt, 'ok'
 */
export async function deleteGame(game: GameRecord): Promise<DeleteResult> {
  const supabase = getSupabase()
  if (!supabase) {
    removeGame(game.id)
    return 'offline'
  }

  const { data: deleted } = await supabase
    .from('games')
    .delete()
    .eq('client_id', key(game))
    .select('id')

  if (deleted && deleted.length > 0) {
    removeGame(game.id)
    return 'ok'
  }

  // Nichts gelöscht: liegt es noch in der Cloud (→ verweigert) oder war es nur lokal?
  const { data: still } = await supabase
    .from('games')
    .select('id')
    .eq('client_id', key(game))
    .limit(1)

  if (still && still.length > 0) return 'denied'

  removeGame(game.id)
  return 'ok'
}

export type EditResult = 'ok' | 'denied' | 'offline'

/**
 * Setzt nachträglich den Anlass eines Spiels – lokal SOFORT und synchron
 * (blockiert nie die Oberfläche), der Cloud-Abgleich läuft danach mit
 * Timeout-Schutz im Hintergrund (gleiches Muster wie `fetchCloudGames`: ohne
 * Guard könnte ein hängender Request bei schwachem Netz den Speichern-Vorgang
 * ewig blockieren). Ein verwehrtes UPDATE meldet 0 Zeilen statt eines Fehlers,
 * daher danach prüfen, ob der Datensatz noch existiert, um „verweigert" von
 * „nie in der Cloud" zu unterscheiden.
 */
export async function editGameEvent(game: GameRecord, event: string): Promise<EditResult> {
  setGameEvent(game.id, event)

  const supabase = getSupabase()
  if (!supabase || isOffline()) return 'offline'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data: updated } = await supabase
      .from('games')
      .update({ event: event.trim() })
      .eq('client_id', key(game))
      .select('id')
      .abortSignal(controller.signal)

    if (updated && updated.length > 0) return 'ok'

    // Nichts aktualisiert: liegt es noch unverändert in der Cloud (→ verweigert,
    // Code fehlt/falsch oder keine Update-Policy) oder war es nie dort (nur lokal)?
    const { data: still } = await supabase
      .from('games')
      .select('id')
      .eq('client_id', key(game))
      .limit(1)
      .abortSignal(controller.signal)

    return still && still.length > 0 ? 'denied' : 'offline'
  } catch (e) {
    console.warn('Cloud-Update abgebrochen (Timeout/offline):', e)
    return 'offline'
  } finally {
    clearTimeout(timer)
  }
}

export interface SyncResult {
  games: GameRecord[]
  online: boolean
}

/**
 * Synchronisiert beide Richtungen und liefert die zusammengeführte Liste:
 *  1. lädt die Cloud-Spiele,
 *  2. schiebt lokale Spiele hoch, die in der Cloud fehlen,
 *  3. merged beide Quellen dedupliziert über die Spiel-ID.
 *
 * Offline-first: Schlägt die Cloud fehl, kommen einfach die lokalen Spiele
 * zurück (online: false).
 */
export async function syncAndMerge(): Promise<SyncResult> {
  const local = getHistory()
  // Kein Cloud-Client oder sicher offline → sofort lokal, kein Warten.
  if (!getSupabase() || isOffline()) return { games: local, online: false }

  const { games: cloud, ok } = await fetchCloudGames()
  // Fetch fehlgeschlagen → ehrlich offline melden, nichts hochladen, lokal bleiben.
  if (!ok) return { games: local, online: false }

  const cloudIds = new Set(cloud.map(key))
  const missing = local.filter((g) => !cloudIds.has(key(g)))
  if (missing.length) await Promise.allSettled(missing.map(pushGame))

  const byId = new Map<string, GameRecord>()
  for (const g of [...cloud, ...local]) byId.set(key(g), g)
  const games = [...byId.values()].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date),
  )
  // Erfolgreich gemerged → lokal cachen, damit Offline-Start die Cloud-Spiele kennt.
  replaceHistory(games)
  return { games, online: true }
}
