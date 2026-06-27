import { getSupabase } from './supabase'
import { getHistory, removeGame, replaceHistory } from './storage'
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

/** Schiebt ein einzelnes Spiel in die Cloud (idempotent über client_id). */
export async function pushGame(game: GameRecord): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
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
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('played_at', { ascending: false })
    .limit(500)
  if (error) {
    console.warn('Cloud-Fetch fehlgeschlagen:', error.message)
    return { games: [], ok: false }
  }
  return { games: (data ?? []).map(fromRow), ok: true }
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
  if (!getSupabase()) return { games: local, online: false }

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
