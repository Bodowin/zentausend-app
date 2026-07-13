import type { GameRecord, Turn } from './types'

const ALIAS_KEY = '10k_player_aliases_v1'
const HISTORY_KEY = '10k_history_v3'

/** Namen nur für Identitätsabgleich normalisieren, niemals für die Anzeige. */
export function normalizePlayerName(name: string): string {
  return name.trim().normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')
}

function readStoredAliases(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(ALIAS_KEY) || '{}') as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([name, id]) => Boolean(normalizePlayerName(name)) && typeof id === 'string' && id.trim(),
      ),
    ) as Record<string, string>
  } catch {
    return {}
  }
}

/**
 * Cloud- und Backup-Spiele tragen ihre stabile ID bereits im Spieler-JSON. Ein
 * neues Gerät darf diese Zuordnung lernen, aber nur wenn ein Name im gesamten
 * lokalen Verlauf eindeutig genau einer ID zugeordnet ist.
 */
function inferAliasesFromHistory(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as unknown
    if (!Array.isArray(parsed)) return {}
    const candidates = new Map<string, Set<string>>()
    for (const game of parsed) {
      if (!game || typeof game !== 'object' || Array.isArray(game)) continue
      const players = (game as { players?: unknown }).players
      if (!Array.isArray(players)) continue
      for (const player of players) {
        if (!player || typeof player !== 'object' || Array.isArray(player)) continue
        const name = (player as { name?: unknown }).name
        const playerId = (player as { playerId?: unknown }).playerId
        if (typeof name !== 'string' || typeof playerId !== 'string' || !playerId.trim()) continue
        const normalized = normalizePlayerName(name)
        if (!normalized) continue
        const ids = candidates.get(normalized) ?? new Set<string>()
        ids.add(playerId.trim())
        candidates.set(normalized, ids)
      }
    }
    return Object.fromEntries(
      [...candidates.entries()]
        .filter(([, ids]) => ids.size === 1)
        .map(([name, ids]) => [name, [...ids][0]]),
    )
  } catch {
    return {}
  }
}

function readAliases(): Record<string, string> {
  return { ...inferAliasesFromHistory(), ...readStoredAliases() }
}

function writeAliases(aliases: Record<string, string>): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(ALIAS_KEY, JSON.stringify(aliases))
  } catch {
    /* Die deterministische Namens-ID bleibt als sicherer Fallback erhalten. */
  }
}

/**
 * Deterministische Altformat-ID: gleiche Schreibweise (ohne Groß-/Kleinschreibung
 * und Mehrfach-Leerzeichen) ergibt auf jedem Gerät dieselbe Identität.
 */
export function legacyPlayerId(name: string): string {
  return `player:name:${encodeURIComponent(normalizePlayerName(name))}`
}

export function playerIdForName(name: string): string {
  const normalized = normalizePlayerName(name)
  return readAliases()[normalized] ?? legacyPlayerId(name)
}

/**
 * Explizite Kader-Umbenennung: alter und neuer Name zeigen danach auf dieselbe ID.
 * Historische Spiele werden nicht verändert; die Zuordnung bleibt reversibel.
 */
export function linkPlayerNames(oldName: string, newName: string): string {
  const oldKey = normalizePlayerName(oldName)
  const newKey = normalizePlayerName(newName)
  const aliases = readAliases()
  const id = aliases[oldKey] ?? legacyPlayerId(oldName)
  if (oldKey) aliases[oldKey] = id
  if (newKey) aliases[newKey] = id
  writeAliases(aliases)
  return id
}

export function playerIdentityKey(player: { playerId?: string; name: string }): string {
  return player.playerId?.trim() || playerIdForName(player.name)
}

export function winnerIdentityKey(game: GameRecord): string | null {
  const winnerName = normalizePlayerName(game.winner)
  const named = game.players.find((player) => normalizePlayerName(player.name) === winnerName)
  if (named) return playerIdentityKey(named)

  const best = Math.max(...game.players.map((player) => player.score))
  const leaders = game.players.filter((player) => player.score === best)
  return leaders.length === 1 ? playerIdentityKey(leaders[0]) : null
}

/** Neueste bekannte Anzeige je Identität; alte Datensätze bleiben unverändert. */
export function identityNameMap(history: GameRecord[]): Map<string, string> {
  const names = new Map<string, string>()
  const newestFirst = [...history].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  for (const game of newestFirst) {
    for (const player of game.players) {
      const id = playerIdentityKey(player)
      if (!names.has(id)) names.set(id, player.name)
    }
  }
  return names
}

/** Akzeptiert sowohl eine stabile ID als auch einen historischen Anzeigenamen. */
export function resolveIdentitySelector(selector: string, history: GameRecord[]): string {
  for (const game of history) {
    for (const player of game.players) {
      if (playerIdentityKey(player) === selector) return selector
    }
  }
  const normalized = normalizePlayerName(selector)
  for (const game of history) {
    const player = game.players.find((candidate) => normalizePlayerName(candidate.name) === normalized)
    if (player) return playerIdentityKey(player)
  }
  return playerIdForName(selector)
}

export function turnIdentityKey(turn: Turn, game: GameRecord): string {
  if (turn.playerId?.trim()) return turn.playerId.trim()
  const normalized = normalizePlayerName(turn.player)
  const player = game.players.find((candidate) => normalizePlayerName(candidate.name) === normalized)
  return player ? playerIdentityKey(player) : playerIdForName(turn.player)
}
